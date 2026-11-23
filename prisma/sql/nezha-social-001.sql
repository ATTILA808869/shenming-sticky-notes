BEGIN;

SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(112301);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NezhaFriend" (
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NezhaFriend_pkey" PRIMARY KEY ("playerAId","playerBId"),
    CONSTRAINT "NezhaFriend_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NezhaFriend_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NezhaPlayerBlock" (
    "ownerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "NezhaPlayerBlock_pkey" PRIMARY KEY ("ownerId","targetId"),
    CONSTRAINT "NezhaPlayerBlock_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NezhaPlayerBlock_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NezhaWhisper" (
    "id" SERIAL NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "body" VARCHAR(140) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NezhaWhisper_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NezhaWhisper_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NezhaWhisper_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NezhaParty" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "leaderReady" BOOLEAN NOT NULL DEFAULT false,
    "guestReady" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NezhaParty_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NezhaParty_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NezhaParty_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "NezhaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaFriend_playerBId_idx" ON "NezhaFriend"("playerBId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaPlayerBlock_targetId_idx" ON "NezhaPlayerBlock"("targetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaWhisper_senderId_id_idx" ON "NezhaWhisper"("senderId", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaWhisper_recipientId_id_idx" ON "NezhaWhisper"("recipientId", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaWhisper_recipientId_readAt_idx" ON "NezhaWhisper"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaParty_leaderId_expiresAt_idx" ON "NezhaParty"("leaderId", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaParty_guestId_expiresAt_idx" ON "NezhaParty"("guestId", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NezhaParty_expiresAt_idx" ON "NezhaParty"("expiresAt");

COMMIT;
