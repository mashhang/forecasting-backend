-- CreateEnum
CREATE TYPE "public"."LogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "public"."system_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "public"."LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);
