-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('PENDING', 'ACTIVE', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "status" "public"."Status" NOT NULL DEFAULT 'PENDING';
