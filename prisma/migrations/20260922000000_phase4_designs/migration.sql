-- AlterTable
ALTER TABLE "LlmCall" ADD COLUMN     "designId" UUID;

-- CreateTable
CREATE TABLE "Design" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "parentVersion" INTEGER,
    "content" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "costEstimateEur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Design_roomId_version_key" ON "Design"("roomId", "version");

-- CreateIndex
CREATE INDEX "LlmCall_designId_idx" ON "LlmCall"("designId");

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No policies: only the app (via Prisma, table owner) can access this table.
ALTER TABLE "Design" ENABLE ROW LEVEL SECURITY;
