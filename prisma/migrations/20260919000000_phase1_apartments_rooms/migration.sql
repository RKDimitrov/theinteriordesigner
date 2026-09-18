-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Apartment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "floorLevel" INTEGER NOT NULL,
    "tenure" TEXT NOT NULL,
    "totalAreaM2" DOUBLE PRECISION NOT NULL,
    "yearBuilt" INTEGER,
    "northAngleDeg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "apartmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "polygon" JSONB NOT NULL,
    "ceilingHeight" INTEGER NOT NULL,
    "openings" JSONB NOT NULL DEFAULT '[]',
    "fixedElements" JSONB NOT NULL DEFAULT '[]',
    "wallOrientationOverrides" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Apartment_userId_idx" ON "Apartment"("userId");

-- CreateIndex
CREATE INDEX "Room_apartmentId_idx" ON "Room"("apartmentId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase exposes the public schema through its Data API. The app only
-- talks to these tables via Prisma (table owner, bypasses RLS), so enable RLS
-- with no policies: anon/authenticated API roles get no access at all.
ALTER TABLE "Apartment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
