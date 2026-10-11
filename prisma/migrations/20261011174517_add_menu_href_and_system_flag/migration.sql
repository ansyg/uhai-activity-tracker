-- AlterTable
ALTER TABLE "Menu" ADD COLUMN     "href" TEXT,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Every menu seeded before this migration is part of the built-in set.
UPDATE "Menu" SET "isSystem" = true;
