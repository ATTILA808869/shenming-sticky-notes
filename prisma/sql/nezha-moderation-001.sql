BEGIN;

SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(112301);

CREATE TABLE IF NOT EXISTS "NezhaWhisperReport" (
    "whisperId" INTEGER NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" VARCHAR(20),
    "handledAt" TIMESTAMP(3),
    "handledBy" VARCHAR(24),
    CONSTRAINT "NezhaWhisperReport_pkey" PRIMARY KEY ("whisperId"),
    CONSTRAINT "NezhaWhisperReport_whisperId_fkey" FOREIGN KEY ("whisperId")
        REFERENCES "NezhaWhisper"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NezhaWhisperReport_handledAt_createdAt_idx" ON "NezhaWhisperReport"("handledAt", "createdAt");

CREATE TABLE IF NOT EXISTS "NezhaNicknameChange" (
    "id" SERIAL NOT NULL,
    "accountId" TEXT NOT NULL,
    "previousNickname" TEXT,
    "nickname" TEXT NOT NULL,
    "changedBy" VARCHAR(12) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NezhaNicknameChange_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NezhaNicknameChange_accountId_fkey" FOREIGN KEY ("accountId")
        REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NezhaNicknameChange_accountId_id_idx" ON "NezhaNicknameChange"("accountId", "id");

COMMIT;
