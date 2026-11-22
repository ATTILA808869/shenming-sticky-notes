import { prisma } from "@/lib/prisma";
import { GameError, limitAttempts } from "@/lib/nezha/session";

const historyLimit = 50;
const historyWindowMs = 7 * 24 * 60 * 60 * 1000;
const historyStart = () => new Date(Date.now() - historyWindowMs);

export async function getLobbyMessages() {
  const messages = await prisma.nezhaChatMessage.findMany({
    where: { createdAt: { gte: historyStart() } },
    orderBy: { id: "desc" },
    take: historyLimit,
    select: { id: true, body: true, createdAt: true, account: { select: { nickname: true } } }
  });
  return messages.reverse().map(({ account, ...message }) => ({ ...message, nickname: account.nickname }));
}

export async function sendLobbyMessage(accountId: string, value: unknown) {
  const body = typeof value === "string"
    ? value.normalize("NFC").replace(/[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu, " ").trim()
    : "";
  if (!body || [...body].length > 140) throw new GameError(400, "訊息須為 1～140 個字。");
  if (await limitAttempts(`lobby:${accountId}`, 12)) {
    throw new GameError(429, "發送太快，請稍後再試。");
  }
  const { id } = await prisma.nezhaChatMessage.create({ data: { accountId, body }, select: { id: true } });
  if (id % 64 === 0) {
    await prisma.nezhaChatMessage.deleteMany({ where: { createdAt: { lt: historyStart() } } })
      .catch((error: unknown) => console.error("Nezha lobby cleanup failed:", error));
  }
}
