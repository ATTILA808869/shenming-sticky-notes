CREATE TABLE IF NOT EXISTS "NezhaBillboard" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "assetPath" TEXT,
  "image" BYTEA,
  "imageType" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "NezhaBillboard_published_deletedAt_sortOrder_idx"
  ON "NezhaBillboard"("published", "deletedAt", "sortOrder");
