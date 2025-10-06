/*
  Warnings:

  - Added the required column `year` to the `budget_line_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."budget_line_items" ADD COLUMN     "year" INTEGER NOT NULL;
