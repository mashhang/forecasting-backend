-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastFailedLogin" TIMESTAMP(3);
