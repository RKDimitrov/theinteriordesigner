-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "apartmentId" UUID NOT NULL,
    "household" JSONB NOT NULL,
    "budgetPerRoom" JSONB NOT NULL DEFAULT '{}',
    "quizAnswers" JSONB NOT NULL DEFAULT '[]',
    "styleScores" JSONB NOT NULL DEFAULT '{}',
    "colorsLiked" JSONB NOT NULL DEFAULT '[]',
    "colorsDisliked" JSONB NOT NULL DEFAULT '[]',
    "mustKeep" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_apartmentId_key" ON "UserProfile"("apartmentId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No policies: only the app (via Prisma, table owner) can access this table.
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
