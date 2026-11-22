BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public."NezhaChatMessage" (
    "id" SERIAL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "body" VARCHAR(140) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NezhaChatMessage_accountId_fkey" FOREIGN KEY ("accountId")
        REFERENCES public."NezhaAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NezhaChatMessage_createdAt_idx" ON public."NezhaChatMessage" ("createdAt");
CREATE INDEX IF NOT EXISTS "NezhaChatMessage_accountId_idx" ON public."NezhaChatMessage" ("accountId");

COMMIT;
