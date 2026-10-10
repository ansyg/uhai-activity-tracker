-- DropIndex
DROP INDEX "TrackerInvite_trackerId_email_status_key";

-- CreateIndex
CREATE INDEX "TrackerInvite_trackerId_email_status_idx" ON "TrackerInvite"("trackerId", "email", "status");
