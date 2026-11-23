import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { GameError, limitAttempts } from "./session";

export function battleConnection() {
  const secret = process.env.NEZHA_BATTLE_SECRET;
  const raw = process.env.NEZHA_BATTLE_URL;
  if (process.env.NEZHA_COOP !== "1" || !secret || secret.length < 32 || !raw) return null;
  try {
    const url = new URL(raw);
    const loopback = process.env.NODE_ENV === "development" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "wss:" && !(loopback && url.protocol === "ws:")) return null;
    if (url.username || url.password || url.pathname !== "/room" || url.search || url.hash) return null;
    return { url: url.href, origin: url.origin, secret };
  } catch { return null; }
}

export async function battleTicket(accountId: string) {
  const connection = battleConnection();
  if (!connection || process.env.NEZHA_PARTIES === "0") throw new GameError(404, "雙人戰鬥尚未開放。");
  if (await limitAttempts(`battle-ticket:${accountId}`, 20)) throw new GameError(429, "連線過於頻繁，請稍後再試。");
  const member = { id: true, nickname: true, selectedCharacter: true } as const;
  const party = await prisma.nezhaParty.findFirst({
    where: {
      OR: [{ leaderId: accountId }, { guestId: accountId }],
      joinedAt: { not: null }, leaderReady: true, guestReady: true, expiresAt: { gt: new Date() },
      leader: { suspendedAt: null, nickname: { not: null } }, guest: { suspendedAt: null, nickname: { not: null } }
    },
    select: { id: true, leader: { select: member }, guest: { select: member } }
  });
  if (!party) throw new GameError(409, "請先組隊，並確認雙方都已準備。");
  const roster = [party.leader, party.guest].map(p => ({
    id: p.id, name: p.nickname, character: p.selectedCharacter === "jigong" ? "jigong" : "nezha"
  }));
  const payload = Buffer.from(JSON.stringify({ party: party.id, player: accountId, roster, expires: Date.now() + 60_000 })).toString("base64url");
  const mac = createHmac("sha256", connection.secret).update("nezha-battle:" + payload).digest("base64url");
  return { url: connection.url, ticket: payload + "." + mac };
}
