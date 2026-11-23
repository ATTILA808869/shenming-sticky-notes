import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { GameError } from "./session";

const storyDuration = 8 * 60_000;
const firstFloorKills = 1000;
const profileSelect = {
  selectedCharacter: true, jigongUnlockedAt: true, jigongGrantedAt: true, towerStartUnlockedAt: true,
  score: { select: { cleared: true } }
} as const;

export async function getGameProfile(accountId: string) {
  const account = await prisma.nezhaAccount.findUniqueOrThrow({ where: { id: accountId }, select: profileSelect });
  const rankedTowerClear = (account.score?.cleared ?? 0) >= 1;
  const towerStartUnlocked = Boolean(account.towerStartUnlockedAt || rankedTowerClear);
  const jigongEarned = Boolean(account.jigongUnlockedAt || rankedTowerClear);
  const jigongUnlocked = jigongEarned || Boolean(account.jigongGrantedAt);
  return { jigongUnlocked, jigongEarned, towerStartUnlocked, character: jigongUnlocked && account.selectedCharacter === "jigong" ? "jigong" : "nezha" };
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
  if ((await getGameProfile(accountId)).towerStartUnlocked) return { runId: null };
  const runId = randomBytes(16).toString("hex");
  const result = await prisma.nezhaAccount.updateMany({
    where: { id: accountId, suspendedAt: null, towerStartUnlockedAt: null },
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
    data: { jigongUnlockedAt: new Date() }
  });
  const updated = await getGameProfile(accountId);
  if (!result.count && !updated.jigongEarned) throw new GameError(409, "這一局尚未符合無限塔解鎖條件。");
  return updated;
}

export async function recordTowerCheckpoint(accountId: string, runId: unknown, kills: unknown) {
  const profile = await getGameProfile(accountId);
  if (profile.towerStartUnlocked) return profile;
  if (typeof runId !== "string" || !/^[a-f0-9]{32}$/.test(runId) ||
      typeof kills !== "number" || !Number.isSafeInteger(kills) || kills < firstFloorKills) {
    throw new GameError(400, "須在本局通過無限塔第 1 層，才能解鎖塔起點。");
  }
  const result = await prisma.nezhaAccount.updateMany({
    where: {
      id: accountId, suspendedAt: null, unlockRunId: runId,
      unlockRunStartedAt: { lte: new Date(Date.now() - storyDuration) },
      jigongUnlockedAt: { not: null }, towerStartUnlockedAt: null
    },
    data: { towerStartUnlockedAt: new Date(), unlockRunId: null, unlockRunStartedAt: null }
  });
  const updated = await getGameProfile(accountId);
  if (!result.count && !updated.towerStartUnlocked) throw new GameError(409, "目前無法儲存塔起點，請確認已通過第 1 層。");
  return updated;
}
