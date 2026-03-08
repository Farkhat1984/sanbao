-- Add SkillCategory enum
CREATE TYPE "SkillCategory" AS ENUM ('LEGAL', 'BUSINESS', 'CODE', 'CONTENT', 'ANALYSIS', 'PRODUCTIVITY', 'CUSTOM');

-- Add new fields to Skill
ALTER TABLE "Skill" ADD COLUMN "category" "SkillCategory" NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "Skill" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Skill" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Skill" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;

-- Index for category filtering
CREATE INDEX "Skill_category_idx" ON "Skill"("category");
