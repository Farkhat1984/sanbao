-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('ODATA_1C');
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'DISCOVERING', 'CONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "catalog" TEXT,
    "discoveredEntities" JSONB,
    "entityCount" INTEGER NOT NULL DEFAULT 0,
    "lastDiscoveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentIntegration" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,

    CONSTRAINT "AgentIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");
CREATE INDEX "Integration_userId_type_idx" ON "Integration"("userId", "type");
CREATE UNIQUE INDEX "AgentIntegration_agentId_integrationId_key" ON "AgentIntegration"("agentId", "integrationId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentIntegration" ADD CONSTRAINT "AgentIntegration_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentIntegration" ADD CONSTRAINT "AgentIntegration_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
