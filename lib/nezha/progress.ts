import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { GameError } from "./session";

const storyDuration = 8 * 60_000;
const profileSelect = { selectedCharacter: true, jigongUnlockedAt: true, jigongGrantedAt: true, score: { select: { cleared: true } } } as const;

export async function getGameProfile(accountId: string) {
  const account = await prisma.nezhaAccount.findUniqueOrThrow({ where: { id: accountId }, select: profileSelect });
  const jigongEarned = Boolean(account.jigongUnlockedAt || (account.score && account.score.cleared >= 1));
  const jigongUnlocked = jigongEarned || Boolean(account.jigongGrantedAt);
  return { jigongUnlocked, jigongEarned, character: jigongUnlocked && account.selectedCharacter === "jigong" ? "jigong" : "nezha" };
}

export async function selectGameCharacter(accountId: string, value: unknown) {
  if (value !== "nezha" && value !== "jigong") throw new GameError(400, "無法辨識這個角色。");
  const updated = await prisma.nezhaAccount.updateMany({
    where: { id: accountId, suspendedAt: null, ...(value === "jigong" ? {
      OR: [{ jigongUnlockedAt: { not: null } }, { jigongGrantedAt: { not: null } }, { score: { cleared: { gte: 1 } } }]
    } : {}) },
    data: { selectedCharacter: value }
  });
  if (!updated.count) throw new GameError(403, value === "jigong" ? "濟公禪師尚未解鎖，或帳號目前無法操作。" : "帳號目前無法操作。");
  return getGameProfile(accountId);
}

export async function startUnlockRun(accountId: string) {
  if ((await getGameProfile(accountId)).jigongEarned) return { runId: null };
  const runId = randomBytes(16).toString("hex");
  const result = await prisma.nezhaAccount.updateMany({
    where: { id: accountId, suspendedAt: null, jigongUnlockedAt: null },
    data: { unlockRunId: runId, unlockRunStartedAt: new Date() }
  });
  if (!result.count) return { runId: null };
  return { runId };
}

export async function recordTowerEntry(accountId: string, runId: unknown) {
  const profile = await getGameProfile(accountId);
  if (profile.jigongEarned) return profile;
  if (typeof runId !== "string" || !/^[a-f0-9]{32}$/.test(runId)) throw new GameError(400, "找不到這一局的解鎖紀錄。");
  const result = await prisma.nezhaAccount.updateMany({
    where: { id: accountId, suspendedAt: null, unlockRunId: runId, unlockRunStartedAt: { lte: new Date(Date.now() - storyDuration) }, jigongUnlockedAt: null },
    data: { jigongUnlockedAt: new Date(), unlockRunId: null, unlockRunStartedAt: null }
  });
  const updated = await getGameProfile(accountId);
  if (!result.count && !updated.jigongEarned) throw new GameError(409, "這一局尚未符合無限塔解鎖條件。");
  return updated;
}
