import type { PrismaClient } from "@prisma/client";
import { AGENT_IDS } from "./agents";
import { discoverMcpTools } from "./utils";
import type { JsonInputValue } from "./utils";

/**
 * Seed core MCP servers (Lawyer, Broker, AccountingDB, 1C Consultant),
 * auto-discover their tools, link them to agents, and set up cross-MCP links.
 * Must run after agents are seeded.
 */
export async function seedMcp(prisma: PrismaClient): Promise<void> {
  // ─── MCP Server: Юрист (НПА РК) ────────────────────────

  const lawyerServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-lawyer" },
    update: {
      name: "Юрист",
      url: process.env.LAWYER_MCP_URL || "http://orchestrator:8120/lawyer",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-lawyer",
      name: "Юрист",
      url: process.env.LAWYER_MCP_URL || "http://orchestrator:8120/lawyer",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
  });

  // Auto-discover tools from Lawyer MCP server
  await discoverAndUpdateMcp(
    prisma,
    lawyerServer.id,
    "Lawyer",
    process.env.LAWYER_MCP_URL || "http://orchestrator:8120/lawyer",
    process.env.AI_CORTEX_AUTH_TOKEN || null
  );

  // ─── MCP Server: Брокер (ТН ВЭД ЕАЭС) ────────────────

  const brokerServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-broker" },
    update: {
      name: "Брокер",
      url: process.env.BROKER_MCP_URL || "http://orchestrator:8120/broker",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-broker",
      name: "Брокер",
      url: process.env.BROKER_MCP_URL || "http://orchestrator:8120/broker",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
  });

  await discoverAndUpdateMcp(
    prisma,
    brokerServer.id,
    "Broker",
    process.env.BROKER_MCP_URL || "http://orchestrator:8120/broker",
    process.env.AI_CORTEX_AUTH_TOKEN || null
  );

  // Link agents to MCP servers
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: AGENT_IDS.femida,
        mcpServerId: lawyerServer.id,
      },
    },
    update: {},
    create: { agentId: AGENT_IDS.femida, mcpServerId: lawyerServer.id },
  });

  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: AGENT_IDS.broker,
        mcpServerId: brokerServer.id,
      },
    },
    update: {},
    create: { agentId: AGENT_IDS.broker, mcpServerId: brokerServer.id },
  });

  // Clean up old Broker-Lawyer link (Broker only needs its own MCP)
  try {
    await prisma.agentMcpServer.delete({
      where: {
        agentId_mcpServerId: {
          agentId: AGENT_IDS.broker,
          mcpServerId: lawyerServer.id,
        },
      },
    });
    console.log("Cleaned up Broker → Lawyer MCP link");
  } catch {
    // Link doesn't exist yet — OK
  }

  console.log("MCP servers seeded: Юрист → НПА, Брокер → Таможенный брокер");

  // Clean up old mcp-fragmentdb if it exists
  try {
    await prisma.agentMcpServer.deleteMany({ where: { mcpServerId: "mcp-fragmentdb" } });
    await prisma.mcpServer.delete({ where: { id: "mcp-fragmentdb" } });
    console.log("Cleaned up old mcp-fragmentdb");
  } catch {
    // Already deleted or doesn't exist
  }

  // ─── MCP Server: AccountingDB (Бухгалтер) ────────────────────

  const accountingDbServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-accountingdb" },
    update: {
      name: "AccountingDB",
      url: process.env.ACCOUNTINGDB_MCP_URL || "http://orchestrator:8120/accountant",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.ACCOUNTINGDB_MCP_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-accountingdb",
      name: "AccountingDB",
      url: process.env.ACCOUNTINGDB_MCP_URL || "http://orchestrator:8120/accountant",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.ACCOUNTINGDB_MCP_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
  });

  await discoverAndUpdateMcp(
    prisma,
    accountingDbServer.id,
    "AccountingDB",
    process.env.ACCOUNTINGDB_MCP_URL || "http://orchestrator:8120/accountant",
    process.env.ACCOUNTINGDB_MCP_TOKEN || null
  );

  // Link AccountingDB → Бухгалтер
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: AGENT_IDS.accountant,
        mcpServerId: accountingDbServer.id,
      },
    },
    update: {},
    create: { agentId: AGENT_IDS.accountant, mcpServerId: accountingDbServer.id },
  });

  // Link Юрист → Бухгалтер (for legal/tax code access)
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: AGENT_IDS.accountant,
        mcpServerId: lawyerServer.id,
      },
    },
    update: {},
    create: { agentId: AGENT_IDS.accountant, mcpServerId: lawyerServer.id },
  });

  console.log("MCP servers seeded: AccountingDB → Бухгалтер, Юрист → Бухгалтер");

  // ─── MCP Server: 1С Консультант (Платформа 1С) ────────────────────

  const consultant1cServer = await prisma.mcpServer.upsert({
    where: { id: "mcp-consultant-1c" },
    update: {
      name: "1С Консультант",
      url: process.env.CONSULTANT_1C_MCP_URL || "http://orchestrator:8120/consultant_1c",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.CONSULTANT_1C_MCP_TOKEN || process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
    create: {
      id: "mcp-consultant-1c",
      name: "1С Консультант",
      url: process.env.CONSULTANT_1C_MCP_URL || "http://orchestrator:8120/consultant_1c",
      transport: "STREAMABLE_HTTP",
      apiKey: process.env.CONSULTANT_1C_MCP_TOKEN || process.env.AI_CORTEX_AUTH_TOKEN || null,
      isGlobal: false,
      status: "CONNECTED",
    },
  });

  await discoverAndUpdateMcp(
    prisma,
    consultant1cServer.id,
    "1С Консультант",
    process.env.CONSULTANT_1C_MCP_URL || "http://orchestrator:8120/consultant_1c",
    process.env.CONSULTANT_1C_MCP_TOKEN || process.env.AI_CORTEX_AUTH_TOKEN || null
  );

  // Link 1С Консультант → Бухгалтер (for 1C platform questions)
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: AGENT_IDS.accountant,
        mcpServerId: consultant1cServer.id,
      },
    },
    update: {},
    create: { agentId: AGENT_IDS.accountant, mcpServerId: consultant1cServer.id },
  });

  console.log("MCP server seeded: 1С Консультант → Бухгалтер");

  // Link 1С Консультант → 1С Ассистент
  await prisma.agentMcpServer.upsert({
    where: {
      agentId_mcpServerId: {
        agentId: AGENT_IDS.consultant1c,
        mcpServerId: consultant1cServer.id,
      },
    },
    update: {},
    create: { agentId: AGENT_IDS.consultant1c, mcpServerId: consultant1cServer.id },
  });

  console.log("System agent seeded: 1С Ассистент + MCP link");

  // ─── Cross-link additional MCP servers to agents ────────────────

  const crossMcpLinks = [
    { agentId: AGENT_IDS.github, mcpServerId: "mcp-filesystem" },
    { agentId: AGENT_IDS.sql, mcpServerId: "mcp-filesystem" },
    { agentId: AGENT_IDS.qa, mcpServerId: "mcp-github" },
  ];

  for (const link of crossMcpLinks) {
    await prisma.agentMcpServer.upsert({
      where: {
        agentId_mcpServerId: { agentId: link.agentId, mcpServerId: link.mcpServerId },
      },
      update: {},
      create: { agentId: link.agentId, mcpServerId: link.mcpServerId },
    });
  }

  console.log(`Cross-MCP links created: ${crossMcpLinks.length} additional links`);
}

/**
 * Discover tools from an MCP server and update the server record with discovered tools.
 * Failures are logged as warnings and do not block seeding.
 */
async function discoverAndUpdateMcp(
  prisma: PrismaClient,
  serverId: string,
  label: string,
  url: string,
  token: string | null
): Promise<void> {
  try {
    console.log(`Connecting to ${label} MCP at ${url}...`);
    const { tools, error } = await discoverMcpTools(url, token);
    if (error) {
      console.warn(`${label} discovery failed: ${error} — tools will need manual discovery via admin panel`);
    } else {
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: {
          discoveredTools: tools as unknown as JsonInputValue,
          status: "CONNECTED",
        },
      });
      console.log(`${label}: discovered ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
    }
  } catch (e) {
    console.warn(`${label} discovery error: ${e instanceof Error ? e.message : e} — skipping`);
  }
}
