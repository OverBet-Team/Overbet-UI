-- AlterTable: add nullable unique email to User
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
