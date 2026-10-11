-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TrackerLimitRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "maxTrackers" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING';

-- Grandfather in every account that already existed before this gate did —
-- the approval requirement is meant to apply to signups from here on, not
-- to retroactively lock out people already using the platform.
UPDATE "User" SET "subscriptionStatus" = 'APPROVED';

-- CreateTable
CREATE TABLE "TrackerLimitRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedMax" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "TrackerLimitRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerLimitRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrackerLimitRequest" ADD CONSTRAINT "TrackerLimitRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerLimitRequest" ADD CONSTRAINT "TrackerLimitRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
