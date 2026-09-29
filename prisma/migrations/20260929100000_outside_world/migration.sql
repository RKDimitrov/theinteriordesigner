-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN "surroundings" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "wallOutlooks" JSONB NOT NULL DEFAULT '{}';
