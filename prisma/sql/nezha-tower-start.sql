BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE public."NezhaAccount"
    ADD COLUMN IF NOT EXISTS "towerStartUnlockedAt" TIMESTAMP(3);

COMMIT;
