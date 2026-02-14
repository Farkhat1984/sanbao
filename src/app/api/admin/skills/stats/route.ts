import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  // Get all skills with their agent count
  const skills = await prisma.skill.findMany({
    select: {
      id: true,
      name: true,
      isBuiltIn: true,
      status: true,
      _count: { select: { agents: true } },
      agents: {
        select: {
          agent: {
            select: {
              _count: { select: { conversations: true } },
            },
          },
        },
      },
    },
  });

  const stats = skills.map((s) => {
    // Total conversations through agents using this skill
    const conversationCount = s.agents.reduce(
      (sum, as) => sum + (as.agent._count.conversations || 0),
      0
    );

    return {
      id: s.id,
      name: s.name,
      isBuiltIn: s.isBuiltIn,
      status: s.status,
      agentCount: s._count.agents,
      conversationCount,
    };
  });

  // Sort by conversation count descending
  stats.sort((a, b) => b.conversationCount - a.conversationCount);

  const totalSkills = skills.length;
  const activeSkills = skills.filter((s) => s.status === "APPROVED" || s.isBuiltIn).length;
  const pendingSkills = skills.filter((s) => s.status === "PENDING").length;

  return NextResponse.json({ stats, totalSkills, activeSkills, pendingSkills });
}
