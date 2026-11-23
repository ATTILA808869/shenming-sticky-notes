import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GameError, limitAttempts } from "./session";
import { handleWhisperReport, renameGamePlayer } from "./moderation";

export const gmPath = "/games/nezha/gm";
export const gmCookie = "nezha_gm";
export const gmSessionSeconds = 45 * 60;
const pageSize = 25;
const muteDurations = [10, 60, 1440, 10080];
const hash = (value: string) => createHash("sha256").update(value).digest();
function gmCredentials(request: NextRequest) {
  const username = process.env.NEZHA_GM_USERNAME?.trim().toLowerCase() ?? "";
  const secret = process.env.NEZHA_GM_SECRET?.trim();
  const localPreview = process.env.NODE_ENV === "development" && !process.env.VERCEL &&
    process.env.NEZHA_GM_ALLOW_SHORT_LOCAL_KEY === "1" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  return /^[a-z0-9_]{3,24}$/.test(username) && secret && secret.length >= (localPreview ? 10 : 32) && secret.length <= 256
    ? { username, secret } : null;
}
const sign = (credentials: { username: string; secret: string }, token: string) =>
  createHmac("sha256", credentials.secret).update(`nezha-gm:${credentials.username}:${token}`).digest();

export function gmAuthorized(request: NextRequest) {
  const credentials = gmCredentials(request);
  const value = request.cookies.get(gmCookie)?.value ?? "";
  if (!credentials || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, nonce, mac] = value.split(".");
  return Number(expires) > Date.now() / 1000 && timingSafeEqual(sign(credentials, `${expires}.${nonce}`), Buffer.from(mac, "hex"));
}

export async function loginGm(request: NextRequest, username: unknown, password: unknown) {
  const credentials = gmCredentials(request);
  if (!credentials) throw new GameError(503, "GM 後台尚未設定登入帳號與金鑰。");
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.slice(0, 64) : null;
  if (await limitAttempts(`nezha-gm:${ip ?? "local"}`, 6)) throw new GameError(429, "嘗試次數過多，請稍後再試。");
  const suppliedName = typeof username === "string" && username.length <= 24 ? username.trim().toLowerCase() : "";
  const suppliedKey = typeof password === "string" && password.length <= 256 ? password.trim() : "";
  const nameMatches = timingSafeEqual(hash(credentials.username), hash(suppliedName));
  const keyMatches = timingSafeEqual(hash(credentials.secret), hash(suppliedKey));
  if (!nameMatches || !keyMatches) {
    throw new GameError(401, "GM 帳號或登入金鑰不正確。");
  }
  const token = `${Math.floor(Date.now() / 1000) + gmSessionSeconds}.${randomBytes(16).toString("hex")}`;
  return `${token}.${sign(credentials, token).toString("hex")}`;
}

export async function listGmRecords(section: string, searchParams: URLSearchParams) {
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);
  const rawPage = Number(searchParams.get("page") ?? 1);
  if (!Number.isSafeInteger(rawPage) || rawPage < 1 || rawPage > 400) throw new GameError(400, "頁碼不正確。");
  const base = { take: pageSize + 1, skip: (rawPage - 1) * pageSize };
  const contains = { contains: q, mode: "insensitive" as const };
  const accountSearch = { OR: [
    { username: contains }, { nickname: contains }, { id: q },
    { nicknameChanges: { some: { OR: [{ previousNickname: contains }, { nickname: contains }] } } }
  ] };
  const user = { nickname: true, username: true } as const;
  const page = <T>(rows: T[]) => ({ rows: rows.slice(0, pageSize), more: rows.length > pageSize && rawPage < 400 });
  if (section === "chat") return page(await prisma.nezhaChatMessage.findMany({
    ...base, orderBy: { id: "desc" },
    where: q ? { OR: [{ body: { contains: q, mode: "insensitive" } }, { account: accountSearch }] } : undefined,
    select: { id: true, body: true, createdAt: true, hiddenAt: true, account: { select: { ...user, id: true, chatMutedUntil: true } } }
  }));
  if (section === "comments") return page(await prisma.nezhaScore.findMany({
    ...base, orderBy: [{ recordedAt: "desc" }, { accountId: "asc" }],
    where: { message: { not: null }, ...(q ? { OR: [{ message: { contains: q, mode: "insensitive" } }, { account: accountSearch }] } : {}) },
    select: { accountId: true, account: { select: user }, cleared: true, message: true, messageHiddenAt: true }
  }));
  if (section === "reports") return page(await prisma.nezhaWhisperReport.findMany({
    ...base,
    orderBy: [{ handledAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }, { whisperId: "desc" }],
    where: q ? { whisper: { OR: [{ body: contains }, { sender: accountSearch }, { recipient: accountSearch }] } } : undefined,
    select: {
      whisperId: true, reason: true, createdAt: true, decision: true, handledAt: true, handledBy: true,
      whisper: { select: {
        body: true, createdAt: true, sender: { select: { ...user, id: true, chatMutedUntil: true } },
        recipient: { select: user }
      } }
    }
  }));
  if (section === "accounts") return page(await prisma.nezhaAccount.findMany({
    ...base, orderBy: { id: "desc" }, where: q ? accountSearch : undefined,
    select: { id: true, ...user, suspendedAt: true, chatMutedUntil: true, jigongUnlockedAt: true, jigongGrantedAt: true, score: { select: { cleared: true } },
      nicknameChanges: { orderBy: { id: "desc" }, take: 5, select: { nickname: true, previousNickname: true, createdAt: true, changedBy: true } }
    }
  }));
  throw new GameError(404, "找不到管理項目。");
}

export async function updateGmRecord(section: string, data: Record<string, unknown>) {
  const { id, action } = data;
  if (section === "reports") return handleWhisperReport(id, action, process.env.NEZHA_GM_USERNAME?.trim().toLowerCase() ?? "gm");
  if (section === "chat" && typeof id === "number" && Number.isSafeInteger(id) && id > 0 && id <= 2147483647 &&
      (action === "hide" || action === "restore" || action === "delete")) {
    const result = action === "delete" ? await prisma.nezhaChatMessage.deleteMany({ where: { id } }) :
      await prisma.nezhaChatMessage.updateMany({ where: { id }, data: { hiddenAt: action === "hide" ? new Date() : null } });
    if (!result.count) throw new GameError(404, "找不到聊天訊息。");
    return;
  }
  if (typeof id === "string" && /^[a-z0-9]{20,40}$/.test(id)) {
    if (section === "comments" && action === "delete") {
      const { message } = data;
      if (typeof message !== "string" || !message || message.length > 80) throw new GameError(400, "請先選擇要刪除的留言。");
      const result = await prisma.nezhaScore.updateMany({
        where: { accountId: id, message }, data: { message: null, messageHiddenAt: null }
      });
      if (!result.count) throw new GameError(409, "這則留言已變更，請重新整理後再確認。");
      return;
    }
    if (section === "comments" && (action === "hide" || action === "restore")) {
      const result = await prisma.nezhaScore.updateMany({ where: { accountId: id, message: { not: null } }, data: { messageHiddenAt: action === "hide" ? new Date() : null } });
      if (!result.count) throw new GameError(404, "找不到榜單留言。");
      return;
    }
    if (section === "accounts" && (action === "suspend" || action === "restore" || action === "revoke")) {
      await prisma.$transaction(async (tx) => {
        if (action !== "revoke") {
          const result = await tx.nezhaAccount.updateMany({ where: { id }, data: { suspendedAt: action === "suspend" ? new Date() : null } });
          if (!result.count) throw new GameError(404, "找不到帳號。");
        }
        if (action !== "restore") await tx.nezhaSession.deleteMany({ where: { accountId: id } });
        if (action === "suspend") await tx.nezhaParty.deleteMany({ where: { OR: [{ leaderId: id }, { guestId: id }] } });
      });
      return;
    }
    if (section === "accounts" && action === "rename") {
      await renameGamePlayer(id, data.nickname, "gm");
      return;
    }
    if (section === "accounts" && (action === "mute" || action === "unmute" || action === "grant-jigong" || action === "remove-jigong-grant")) {
      let changes;
      if (action === "mute") {
        const { minutes } = data;
        if (typeof minutes !== "number" || !muteDurations.includes(minutes)) throw new GameError(400, "請選擇有效的禁言時間。");
        changes = { chatMutedUntil: new Date(Date.now() + minutes * 60_000) };
      } else if (action === "unmute") changes = { chatMutedUntil: null };
      else changes = { jigongGrantedAt: action === "grant-jigong" ? new Date() : null };
      await prisma.$transaction(async (tx) => {
        const result = await tx.nezhaAccount.updateMany({ where: { id }, data: changes });
        if (!result.count) throw new GameError(404, "找不到帳號。");
        if (action === "remove-jigong-grant") await tx.nezhaAccount.updateMany({
          where: { id, selectedCharacter: "jigong", jigongUnlockedAt: null, OR: [{ score: null }, { score: { cleared: { lt: 1 } } }] },
          data: { selectedCharacter: "nezha" }
        });
      });
      return;
    }
  }
  throw new GameError(400, "無效的管理操作。");
}
