import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GameError } from "./session";
import rules from "./assets/battle-rules.js";

const leaderboardLimit = 100;
const rankOrder = [
  { cleared: "desc" },
  { recordedAt: "asc" },
  { accountId: "asc" }
] satisfies Prisma.NezhaScoreOrderByWithRelationInput[];

export async function getScores(accountId: string) {
  const scores = await prisma.nezhaScore.findMany({
    where: { cleared: { gt: 0 } },
    orderBy: rankOrder,
    take: leaderboardLimit,
    select: { accountId: true, account: { select: { nickname: true } }, cleared: true, message: true, messageHiddenAt: true }
  });

  return scores.map((score) => ({
    nickname: score.account.nickname,
    cleared: score.cleared,
    message: score.messageHiddenAt ? null : score.message,
    canEditMessage: score.accountId === accountId,
    ...(score.accountId === accountId ? { ownMessage: score.message, messageHidden: Boolean(score.messageHiddenAt) } : {})
  }));
}

export async function saveLeaderboardMessage(value: unknown, accountId: string) {
  if (typeof value !== "string") {
    throw new GameError(400, "請輸入留言文字。");
  }
  const message = value.trim();
  if (!message || message.length > 80 || message.includes("\u0000")) {
    throw new GameError(400, "請輸入 1～80 字的留言。");
  }

  const [updated] = await prisma.$queryRaw<{ messageHiddenAt: Date | null }[]>`
    UPDATE "NezhaScore"
    SET "message" = ${message}
    WHERE "accountId" = ${accountId}
      AND "accountId" IN (
        SELECT "accountId" FROM "NezhaScore"
        WHERE "cleared" > 0
        ORDER BY "cleared" DESC, "recordedAt" ASC, "accountId" ASC
        LIMIT ${leaderboardLimit}
      )
    RETURNING "messageHiddenAt"
  `;
  if (!updated) throw new GameError(403, "只有目前在前 100 名的玩家可以修改自己的留言。");
  return { message, messageHidden: Boolean(updated.messageHiddenAt) };
}

async function getRank(tx: Prisma.TransactionClient, accountId: string) {
  const rows = await tx.nezhaScore.findMany({
    where: { cleared: { gt: 0 } },
    orderBy: rankOrder,
    take: leaderboardLimit,
    select: { accountId: true }
  });
  const position = rows.findIndex((row) => row.accountId === accountId);
  return position === -1 ? null : position + 1;
}

export async function saveScore(data: Record<string, unknown>, accountId: string) {
  const { cleared, progress, kills } = data;
  if (typeof cleared !== "number" || typeof progress !== "number" || typeof kills !== "number" ||
      ![cleared, progress, kills].every(Number.isSafeInteger) || cleared < 1 || cleared > 10_000 ||
      progress < 0 || progress > Math.max(1000, rules.towerObjective(cleared + 1).goal) ||
      kills < rules.towerMinimumKills(cleared) + progress || kills > 100_000_000) {
    throw new GameError(400, "須至少通過無限塔第 1 層才能登錄成績。");
  }

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const previous = await tx.nezhaScore.findUnique({
          where: { accountId },
          select: { cleared: true, messageCredits: true }
        });
        if (previous && cleared <= previous.cleared) return { updated: false, earnedMessage: false };

        const previousRank = previous ? await getRank(tx, accountId) : null;
        const score = { cleared, progress, kills };
        await tx.nezhaScore.upsert({
          where: { accountId },
          create: { accountId, ...score, messageCredits: 0 },
          update: { ...score, recordedAt: new Date() }
        });

        const rank = await getRank(tx, accountId);
        const earnedMessage = rank !== null && (previousRank === null || rank < previousRank);
        if (earnedMessage) {
          // Preserve rank-based credits for compatibility if version 0.1123 is restored.
          const credits = previous?.messageCredits ?? (previousRank === null ? 0 : 1);
          await tx.nezhaScore.update({
            where: { accountId },
            data: { messageCredits: credits + 1 }
          });
        }
        return { updated: true, earnedMessage };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt >= 3 || !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !["P2034", "P2002"].includes(error.code)) throw error;
    }
  }
}
