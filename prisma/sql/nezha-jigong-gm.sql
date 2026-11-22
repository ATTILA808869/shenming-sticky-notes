BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public."NezhaAccount"
    ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "selectedCharacter" TEXT NOT NULL DEFAULT 'nezha',
    ADD COLUMN IF NOT EXISTS "jigongUnlockedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "unlockRunId" TEXT,
    ADD COLUMN IF NOT EXISTS "unlockRunStartedAt" TIMESTAMP(3);
ALTER TABLE public."NezhaChatMessage" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE public."NezhaScore" ADD COLUMN IF NOT EXISTS "messageHiddenAt" TIMESTAMP(3);

COMMIT;
