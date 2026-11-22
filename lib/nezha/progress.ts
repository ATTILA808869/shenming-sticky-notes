import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { GameError } from "./session";

const storyDuration = 8 * 60_000;
const profileSelect = { selectedCharacter: true, jigongUnlockedAt: true, score: { select: { cleared: true } } } as const;

export async function getGameProfile(accountId: string) {
  const account = await prisma.nezhaAccount.findUniqueOrThrow({ where: { id: accountId }, select: profileSelect });
  const jigongUnlocked = Boolean(account.jigongUnlockedAt || (account.score && account.score.cleared >= 1));
  return { jigongUnlocked, character: jigongUnlocked && account.selectedCharacter === "jigong" ? "jigong" : "nezha" };
}

export async function selectGameCharacter(accountId: string, value: unknown) {
  if (value !== "nezha" && value !== "jigong") throw new GameError(400, "無法辨識這個角色。");
  const { jigongUnlocked } = await getGameProfile(accountId);
  if (value === "jigong" && !jigongUnlocked) throw new GameError(403, "進入無限塔第 1 層後才能解鎖濟公禪師。");
  const updated = await prisma.nezhaAccount.updateMany({ where: { id: accountId, suspendedAt: null }, data: { selectedCharacter: value } });
  if (!updated.count) throw new GameError(403, "帳號目前無法操作。");
  return { character: value, jigongUnlocked };
}

export async function startUnlockRun(accountId: string) {
  if ((await getGameProfile(accountId)).jigongUnlocked) return { runId: null };
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
  if (profile.jigongUnlocked) return profile;
  if (typeof runId !== "string" || !/^[a-f0-9]{32}$/.test(runId)) throw new GameError(400, "找不到這一局的解鎖紀錄。");
  const result = await prisma.nezhaAccount.updateMany({
    where: { id: accountId, suspendedAt: null, unlockRunId: runId, unlockRunStartedAt: { lte: new Date(Date.now() - storyDuration) }, jigongUnlockedAt: null },
    data: { jigongUnlockedAt: new Date(), unlockRunId: null, unlockRunStartedAt: null }
  });
  const updated = await getGameProfile(accountId);
  if (!result.count && !updated.jigongUnlocked) throw new GameError(409, "這一局尚未符合無限塔解鎖條件。");
  return updated;
}
