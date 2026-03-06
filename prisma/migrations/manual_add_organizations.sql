-- Add Organizations & Org Agents migration

-- Enums
DO $$ BEGIN
  CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrgAgentStatus" AS ENUM ('CREATING', 'PROCESSING', 'READY', 'PUBLISHED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrgAgentAccess" AS ENUM ('ALL_MEMBERS', 'SPECIFIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add ORG_INVITE to EmailType if not exists
ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'ORG_INVITE';

-- Organization table
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "avatar" TEXT,
    "namespace" TEXT NOT NULL,
    "nsApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_namespace_key" ON "Organization"("namespace");
CREATE INDEX IF NOT EXISTS "Organization_ownerId_idx" ON "Organization"("ownerId");
ALTER TABLE "Organization" DROP CONSTRAINT IF EXISTS "Organization_ownerId_fkey";
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrgMember table
CREATE TABLE IF NOT EXISTS "OrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");
CREATE INDEX IF NOT EXISTS "OrgMember_userId_idx" ON "OrgMember"("userId");
ALTER TABLE "OrgMember" DROP CONSTRAINT IF EXISTS "OrgMember_orgId_fkey";
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMember" DROP CONSTRAINT IF EXISTS "OrgMember_userId_fkey";
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrgInvite table
CREATE TABLE IF NOT EXISTS "OrgInvite" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrgInvite_token_key" ON "OrgInvite"("token");
CREATE INDEX IF NOT EXISTS "OrgInvite_email_idx" ON "OrgInvite"("email");
CREATE INDEX IF NOT EXISTS "OrgInvite_orgId_idx" ON "OrgInvite"("orgId");
ALTER TABLE "OrgInvite" DROP CONSTRAINT IF EXISTS "OrgInvite_orgId_fkey";
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrgAgent table
CREATE TABLE IF NOT EXISTS "OrgAgent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "mcpServerId" TEXT,
    "status" "OrgAgentStatus" NOT NULL DEFAULT 'CREATING',
    "accessMode" "OrgAgentAccess" NOT NULL DEFAULT 'ALL_MEMBERS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrgAgent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrgAgent_orgId_idx" ON "OrgAgent"("orgId");
ALTER TABLE "OrgAgent" DROP CONSTRAINT IF EXISTS "OrgAgent_orgId_fkey";
ALTER TABLE "OrgAgent" ADD CONSTRAINT "OrgAgent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgAgent" DROP CONSTRAINT IF EXISTS "OrgAgent_mcpServerId_fkey";
ALTER TABLE "OrgAgent" ADD CONSTRAINT "OrgAgent_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrgAgentFile table
CREATE TABLE IF NOT EXISTS "OrgAgentFile" (
    "id" TEXT NOT NULL,
    "orgAgentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgAgentFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrgAgentFile_orgAgentId_idx" ON "OrgAgentFile"("orgAgentId");
ALTER TABLE "OrgAgentFile" DROP CONSTRAINT IF EXISTS "OrgAgentFile_orgAgentId_fkey";
ALTER TABLE "OrgAgentFile" ADD CONSTRAINT "OrgAgentFile_orgAgentId_fkey" FOREIGN KEY ("orgAgentId") REFERENCES "OrgAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrgAgentMember table
CREATE TABLE IF NOT EXISTS "OrgAgentMember" (
    "id" TEXT NOT NULL,
    "orgAgentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "OrgAgentMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrgAgentMember_orgAgentId_userId_key" ON "OrgAgentMember"("orgAgentId", "userId");
ALTER TABLE "OrgAgentMember" DROP CONSTRAINT IF EXISTS "OrgAgentMember_orgAgentId_fkey";
ALTER TABLE "OrgAgentMember" ADD CONSTRAINT "OrgAgentMember_orgAgentId_fkey" FOREIGN KEY ("orgAgentId") REFERENCES "OrgAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgAgentMember" DROP CONSTRAINT IF EXISTS "OrgAgentMember_userId_fkey";
ALTER TABLE "OrgAgentMember" ADD CONSTRAINT "OrgAgentMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add orgAgentId to Conversation (if not exists)
DO $$ BEGIN
  ALTER TABLE "Conversation" ADD COLUMN "orgAgentId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Conversation_orgAgentId_idx" ON "Conversation"("orgAgentId");
ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_orgAgentId_fkey";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orgAgentId_fkey" FOREIGN KEY ("orgAgentId") REFERENCES "OrgAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add plan limit columns (if not exist)
DO $$ BEGIN ALTER TABLE "Plan" ADD COLUMN "maxOrganizations" INTEGER NOT NULL DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Plan" ADD COLUMN "maxOrgMembers" INTEGER NOT NULL DEFAULT 3; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Plan" ADD COLUMN "maxOrgAgents" INTEGER NOT NULL DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Plan" ADD COLUMN "maxOrgFilesPerAgent" INTEGER NOT NULL DEFAULT 5; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Plan" ADD COLUMN "maxOrgFileSizeMb" INTEGER NOT NULL DEFAULT 10; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Plan" ADD COLUMN "maxOrgStorageMb" INTEGER NOT NULL DEFAULT 50; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
