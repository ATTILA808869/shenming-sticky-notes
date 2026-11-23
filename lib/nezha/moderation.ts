import { prisma } from "@/lib/prisma";
import { GameError, parseNickname } from "./session";

function isMessageId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647;
}

export async function renameGamePlayer(id: string, value: unknown, changedBy: "player" | "gm") {
  const nickname = parseNickname(value);
  await prisma.$transaction(async tx => {
    const [account] = await tx.$queryRaw<{ nickname: string | null; suspendedAt: Date | null }[]>`
      SELECT "nickname", "suspendedAt" FROM "NezhaAccount" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!account || (changedBy === "player" && account.suspendedAt)) throw new GameError(404, "找不到可操作的帳號。");
    if (account.nickname === nickname) return;
    await tx.nezhaAccount.update({ where: { id }, data: { nickname } });
    await tx.nezhaNicknameChange.create({ data: { accountId: id, previousNickname: account.nickname, nickname, changedBy } });
  });
  return { nickname };
}

export async function reportWhisper(recipientId: string, id: unknown, reason: unknown) {
  if (!isMessageId(id) || (reason !== "harassment" && reason !== "spam" && reason !== "other")) {
    throw new GameError(400, "請選擇要檢舉的密語和原因。");
  }
  const message = await prisma.nezhaWhisper.findFirst({ where: { id, recipientId }, select: { id: true } });
  if (!message) throw new GameError(404, "找不到可檢舉的密語。");
  await prisma.nezhaWhisperReport.upsert({ where: { whisperId: id }, create: { whisperId: id, reason }, update: {} });
}

export async function handleWhisperReport(id: unknown, decision: unknown, gmName: string) {
  if (!isMessageId(id) || (decision !== "confirmed" && decision !== "dismissed")) {
    throw new GameError(400, "請選擇正確的檢舉處理方式。");
  }
  const result = await prisma.nezhaWhisperReport.updateMany({
    where: { whisperId: id, handledAt: null },
    data: { decision, handledAt: new Date(), handledBy: gmName }
  });
  if (!result.count) throw new GameError(409, "檢舉不存在或已經處理。");
}
