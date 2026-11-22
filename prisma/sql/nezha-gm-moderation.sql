BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public."NezhaAccount"
    ADD COLUMN IF NOT EXISTS "chatMutedUntil" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "jigongGrantedAt" TIMESTAMP(3);

COMMIT;
