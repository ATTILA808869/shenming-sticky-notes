import { prisma } from "@/lib/prisma";
import { GameError } from "./session";

export async function getScores() {
  const scores = await prisma.nezhaScore.findMany({
    orderBy: [{ cleared: "desc" }, { progress: "desc" }, { kills: "desc" }, { recordedAt: "asc" }, { accountId: "asc" }],
    take: 50,
    select: { account: { select: { nickname: true } }, cleared: true, progress: true, kills: true }
  });

  return scores.map(({ account, cleared, progress, kills }) => ({
    nickname: account.nickname, cleared, progress, kills
  }));
}

export async function saveScore(data: Record<string, unknown>, accountId: string) {
  const { cleared, progress, kills } = data;
  if (typeof cleared !== "number" || typeof progress !== "number" || typeof kills !== "number" ||
      ![cleared, progress, kills].every(Number.isSafeInteger) || cleared < 0 || cleared > 10_000 ||
      progress < 0 || progress > 1000 || kills < cleared * 1000 + progress || kills > 100_000_000 ||
      (cleared === 0 && progress === 0)) {
    throw new GameError(400, "沒有可登榜的無限塔紀錄。");
  }

  // Keep the best score even if two game results arrive together.
  const count = await prisma.$executeRaw`
    INSERT INTO "NezhaScore" ("accountId", "cleared", "progress", "kills")
    VALUES (${accountId}, ${cleared}, ${progress}, ${kills})
    ON CONFLICT ("accountId") DO UPDATE SET
      "cleared" = EXCLUDED."cleared", "progress" = EXCLUDED."progress",
      "kills" = EXCLUDED."kills", "recordedAt" = EXCLUDED."recordedAt"
    WHERE (EXCLUDED."cleared", EXCLUDED."progress", EXCLUDED."kills") >
      ("NezhaScore"."cleared", "NezhaScore"."progress", "NezhaScore"."kills")
  `;
  return count > 0;
}
