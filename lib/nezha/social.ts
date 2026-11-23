import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GameError, limitAttempts, parseNickname } from "./session";
import { renameGamePlayer, reportWhisper } from "./moderation";
import { battleConnection } from "./battle";

const minute = 60_000;
const invitationLifetime = 2 * minute;
const partyLifetime = 24 * 60 * minute;
const inboxLimit = 60;
const person = { id: true, nickname: true } as const;

export function socialRelease() {
  const enabled = (name: string) => {
    const value = process.env[name];
    const defaultOn = process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV);
    return value === undefined ? defaultOn : value === "1";
  };
  return {
    version: "0.112301",
    features: {
      profile: enabled("NEZHA_PROFILE"),
      friends: enabled("NEZHA_FRIENDS"),
      whispers: enabled("NEZHA_WHISPERS"),
      parties: enabled("NEZHA_PARTIES"),
      battle: enabled("NEZHA_PARTIES") && Boolean(battleConnection())
    }
  };
}

type Feature = keyof ReturnType<typeof socialRelease>["features"];
const gates: Record<string, Feature> = {
  "profile": "profile", "friends": "friends", "whispers": "whispers", "party": "parties"
};

function requireSocialFeature(name: string) {
  const feature = gates[name];
  if (!feature || !socialRelease().features[feature]) throw new GameError(404, "此功能目前未開放。");
}

function playerId(value: unknown) {
  if (typeof value !== "string" || !/^[a-z0-9]{1,32}$/.test(value)) {
    throw new GameError(400, "找不到這位玩家。");
  }
  return value;
}

function friendship(a: string, b: string) {
  return a < b ? { playerAId: a, playerBId: b } : { playerAId: b, playerBId: a };
}

async function lockPlayers(tx: Prisma.TransactionClient, a: string, b: string) {
  if (a === b) throw new GameError(400, "不能對自己執行這項操作。");
  const rows = await tx.$queryRaw<{ id: string; nickname: string | null; suspendedAt: Date | null; chatMutedUntil: Date | null }[]>`
    SELECT "id", "nickname", "suspendedAt", "chatMutedUntil"
    FROM "NezhaAccount" WHERE "id" IN (${a}, ${b}) ORDER BY "id" FOR UPDATE
  `;
  if (rows.length !== 2 || rows.some(row => !row.nickname || row.suspendedAt)) {
    throw new GameError(404, "找不到可聯絡的玩家。");
  }
  return rows.find(row => row.id === a)!;
}

async function requireContact(tx: Prisma.TransactionClient, a: string, b: string) {
  const blocked = await tx.nezhaPlayerBlock.findFirst({
    where: { OR: [{ ownerId: a, targetId: b }, { ownerId: b, targetId: a }] },
    select: { ownerId: true }
  });
  if (blocked) throw new GameError(403, "目前無法聯絡這位玩家。");
}

async function resolvePlayer(value: unknown, nickname: unknown) {
  if (value !== undefined) return playerId(value);
  const name = parseNickname(nickname);
  const matches = await prisma.nezhaAccount.findMany({
    where: { nickname: { equals: name, mode: "insensitive" }, suspendedAt: null },
    take: 2, select: { id: true }
  });
  if (!matches.length) throw new GameError(404, "找不到這個暱稱。");
  if (matches.length > 1) throw new GameError(409, "有玩家使用相同暱稱，請從聊天室或好友名單選擇對方。");
  return matches[0].id;
}

async function getFriends(id: string) {
  const [friends, blocks] = await Promise.all([
    prisma.nezhaFriend.findMany({
      where: { OR: [{ playerAId: id }, { playerBId: id }], playerA: { suspendedAt: null }, playerB: { suspendedAt: null } },
      orderBy: { createdAt: "desc" }, take: 100,
      select: { playerA: { select: person }, playerB: { select: person }, acceptedAt: true, requestedBy: true }
    }),
    prisma.nezhaPlayerBlock.findMany({
      where: { ownerId: id }, take: 100, orderBy: { targetId: "asc" }, select: { target: { select: person } }
    })
  ]);
  return {
    friends: friends.map(row => ({
      ...(row.playerA.id === id ? row.playerB : row.playerA),
      status: row.acceptedAt ? "friend" : row.requestedBy === id ? "sent" : "received"
    })),
    blocked: blocks.map(row => row.target)
  };
}

async function updateFriends(id: string, data: Record<string, unknown>) {
  const { action } = data;
  const target = await resolvePlayer(data.targetId, data.targetNickname);
  const pair = friendship(id, target);
  await prisma.$transaction(async tx => {
    if (id === target) throw new GameError(400, "不能對自己執行這項操作。");
    if (action === "unblock") {
      await tx.nezhaPlayerBlock.deleteMany({ where: { ownerId: id, targetId: target } });
      return;
    }
    await lockPlayers(tx, id, target);
    if (action === "block") {
      await tx.nezhaPlayerBlock.upsert({ where: { ownerId_targetId: { ownerId: id, targetId: target } }, create: { ownerId: id, targetId: target }, update: {} });
      await tx.nezhaFriend.deleteMany({ where: pair });
      await tx.nezhaParty.deleteMany({ where: { OR: [{ leaderId: id, guestId: target }, { leaderId: target, guestId: id }] } });
      return;
    }
    if (action === "remove") {
      await tx.nezhaFriend.deleteMany({ where: pair });
      return;
    }
    await requireContact(tx, id, target);
    const row = await tx.nezhaFriend.findUnique({ where: { playerAId_playerBId: pair } });
    if (action === "accept") {
      if (!row || row.requestedBy !== target || row.acceptedAt) throw new GameError(409, "這個好友邀請已失效。");
      await tx.nezhaFriend.update({ where: { playerAId_playerBId: pair }, data: { acceptedAt: new Date() } });
    } else if (action === "request") {
      if (row) throw new GameError(409, row.requestedBy === target && !row.acceptedAt ? "對方已送出邀請，請到好友頁接受。" : "已是好友或已有待處理的邀請。");
      const count = await tx.nezhaFriend.count({ where: { OR: [{ playerAId: id }, { playerBId: id }, { playerAId: target }, { playerBId: target }] } });
      if (count >= 100) {
        const counts = await Promise.all([id, target].map(player =>
          tx.nezhaFriend.count({ where: { OR: [{ playerAId: player }, { playerBId: player }] } })));
        if (counts.some(value => value >= 100)) throw new GameError(409, "好友與待處理邀請已達上限。");
      }
      await tx.nezhaFriend.create({ data: { ...pair, requestedBy: id } });
    } else {
      throw new GameError(400, "找不到這個好友操作。");
    }
  });
}

async function getWhispers(id: string) {
  const [messages, unread] = await Promise.all([
    prisma.nezhaWhisper.findMany({
      where: { OR: [{ senderId: id }, { recipientId: id }] },
      orderBy: { id: "desc" }, take: inboxLimit,
      select: { id: true, sender: { select: person }, recipient: { select: person }, body: true, createdAt: true, readAt: true,
        report: { select: { whisperId: true } } }
    }),
    prisma.nezhaWhisper.count({ where: { recipientId: id, readAt: null } })
  ]);
  return {
    messages: messages.reverse().map(({ report, ...message }) => ({
      ...message, ...(message.recipient.id === id ? { reported: Boolean(report) } : {})
    })),
    unread
  };
}

async function updateWhispers(id: string, data: Record<string, unknown>) {
  if (data.action === "report") return reportWhisper(id, data.messageId, data.reason);
  if (data.action === "read") {
    const { throughId } = data;
    if (typeof throughId !== "number" || !Number.isInteger(throughId) || throughId < 1 || throughId > 2147483647) {
      throw new GameError(400, "找不到這筆密語。");
    }
    await prisma.nezhaWhisper.updateMany({ where: { recipientId: id, id: { lte: throughId }, readAt: null }, data: { readAt: new Date() } });
    return;
  }
  if (data.action !== "send") throw new GameError(400, "找不到這個密語操作。");
  const body = typeof data.message === "string"
    ? data.message.normalize("NFC").replace(/[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu, " ").trim()
    : "";
  if (!body || [...body].length > 140) throw new GameError(400, "密語須為 1～140 個字。");
  const target = await resolvePlayer(data.targetId, data.targetNickname);
  await prisma.$transaction(async tx => {
    const sender = await lockPlayers(tx, id, target);
    if (sender.chatMutedUntil && sender.chatMutedUntil.getTime() > Date.now()) {
      throw new GameError(403, "禁言期間無法發送密語。");
    }
    await requireContact(tx, id, target);
    await tx.nezhaWhisper.create({ data: { senderId: id, recipientId: target, body } });
  });
}

function activeParty(id: string) {
  return { OR: [{ leaderId: id }, { guestId: id }], expiresAt: { gt: new Date() } };
}

async function getParty(id: string) {
  const member = { ...person, selectedCharacter: true } as const;
  const party = await prisma.nezhaParty.findFirst({
    where: { ...activeParty(id), leader: { suspendedAt: null }, guest: { suspendedAt: null } },
    select: { id: true, leader: { select: member }, guest: { select: member }, joinedAt: true, leaderReady: true, guestReady: true, expiresAt: true }
  });
  return { party };
}

async function updateParty(id: string, data: Record<string, unknown>) {
  const { action } = data;
  if (action === "invite") {
    const target = playerId(data.targetId);
    await prisma.$transaction(async tx => {
      await lockPlayers(tx, id, target);
      await requireContact(tx, id, target);
      const involved = await tx.nezhaParty.findFirst({ where: {
        expiresAt: { gt: new Date() }, OR: [{ leaderId: { in: [id, target] } }, { guestId: { in: [id, target] } }]
      }, select: { id: true } });
      if (involved) throw new GameError(409, "其中一方已有隊伍或待回覆的邀請。");
      await tx.nezhaParty.create({ data: { leaderId: id, guestId: target, expiresAt: new Date(Date.now() + invitationLifetime) } });
    });
    return;
  }
  const where = { ...activeParty(id), id: playerId(data.partyId) };
  if (action === "leave") {
    await prisma.nezhaParty.deleteMany({ where });
    return;
  }
  const party = await prisma.nezhaParty.findFirst({ where, select: { leaderId: true, guestId: true } });
  if (!party) throw new GameError(409, "隊伍或邀請已失效。");
  const peer = party.leaderId === id ? party.guestId : party.leaderId;
  await prisma.$transaction(async tx => {
    await lockPlayers(tx, id, peer);
    await requireContact(tx, id, peer);
    let result;
    if (action === "accept") {
      result = await tx.nezhaParty.updateMany({
        where: { ...where, guestId: id, joinedAt: null },
        data: { joinedAt: new Date(), expiresAt: new Date(Date.now() + partyLifetime) }
      });
    } else if (action === "ready" && typeof data.ready === "boolean") {
      result = await tx.nezhaParty.updateMany({
        where: { ...where, joinedAt: { not: null } },
        data: party.leaderId === id ? { leaderReady: data.ready } : { guestReady: data.ready }
      });
    } else {
      throw new GameError(400, "找不到這個組隊操作。");
    }
    if (!result.count) throw new GameError(409, "隊伍或邀請已失效。");
  });
}

export async function getSocialState(id: string) {
  const { features } = socialRelease();
  const [unread, invitations, party] = await Promise.all([
    features.whispers ? prisma.nezhaWhisper.count({ where: { recipientId: id, readAt: null } }) : 0,
    features.friends ? prisma.nezhaFriend.count({ where: { OR: [{ playerAId: id }, { playerBId: id }], acceptedAt: null, requestedBy: { not: id } } }) : 0,
    features.parties ? getParty(id) : { party: null }
  ]);
  return { unread, invitations, party: party.party };
}

export async function readSocial(id: string, path: string) {
  if (path === "state") return getSocialState(id);
  requireSocialFeature(path);
  if (path === "friends") return getFriends(id);
  if (path === "whispers") return getWhispers(id);
  if (path === "party") return getParty(id);
  return prisma.nezhaAccount.findUniqueOrThrow({ where: { id }, select: person });
}

export async function writeSocial(id: string, path: string, data: Record<string, unknown>) {
  requireSocialFeature(path);
  const kind = path === "whispers" && (data.action === "read" || data.action === "report") ? data.action : "write";
  const cap = path === "profile" ? 3 : kind === "read" ? 30 : kind === "report" ? 4 : 12;
  if (await limitAttempts(`social:${path}:${kind}:${id}`, cap)) {
    throw new GameError(429, "操作太頻繁，請稍後再試。");
  }
  if (path === "profile") return renameGamePlayer(id, data.nickname, "player");
  if (path === "friends") await updateFriends(id, data);
  if (path === "whispers") await updateWhispers(id, data);
  if (path === "party") await updateParty(id, data);
  return { ok: true };
}
