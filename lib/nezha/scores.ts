import { prisma } from "@/lib/prisma";
import { GameError } from "./session";

export async function getScores() {
  const scores = await prisma.nezhaScore.findMany({
    where: { cleared: { gt: 0 } },
    orderBy: [{ cleared: "desc" }, { recordedAt: "asc" }, { accountId: "asc" }],
    take: 100,
    select: { account: { select: { nickname: true } }, cleared: true }
  });

  return scores.map(({ account, cleared }) => ({
    nickname: account.nickname, cleared
  }));
}

export async function saveScore(data: Record<string, unknown>, accountId: string) {
  const { cleared, progress, kills } = data;
  if (typeof cleared !== "number" || typeof progress !== "number" || typeof kills !== "number" ||
      ![cleared, progress, kills].every(Number.isSafeInteger) || cleared < 1 || cleared > 10_000 ||
      progress < 0 || progress > 1000 || kills < cleared * 1000 + progress || kills > 100_000_000) {
    throw new GameError(400, "須至少通過無限塔第 1 層才能登錄成績。");
  }

  // Keep the best score even if two game results arrive together.
  const count = await prisma.$executeRaw`
    INSERT INTO "NezhaScore" ("accountId", "cleared", "progress", "kills")
    VALUES (${accountId}, ${cleared}, ${progress}, ${kills})
    ON CONFLICT ("accountId") DO UPDATE SET
      "cleared" = EXCLUDED."cleared", "progress" = EXCLUDED."progress",
      "kills" = EXCLUDED."kills", "recordedAt" = EXCLUDED."recordedAt"
    WHERE EXCLUDED."cleared" > "NezhaScore"."cleared"
  `;
  return count > 0;
}
