import type { PrismaClient } from "@prisma/client";

/** Agent IDs exported for cross-referencing in tools and MCP modules */
export const AGENT_IDS = {
  sanbao: "system-sanbao-agent",
  femida: "system-femida-agent",
  broker: "system-broker-agent",
  accountant: "system-accountant-agent",
  consultant1c: "system-1c-assistant-agent",
  github: "system-github-agent",
  sql: "system-sql-agent",
  researcher: "system-researcher-agent",
  filemanager: "system-filemanager-agent",
  qa: "system-qa-agent",
  analyst: "system-analyst-agent",
} as const;

/**
 * Seed system agents that require programmatic setup (skills attachment, etc.).
 * Most system agents are managed via admin panel — this only upserts specific ones.
 */
export async function seedAgents(prisma: PrismaClient): Promise<void> {
  // ─── Data Analyst agent ──────────────────────────────
  const analystId = AGENT_IDS.analyst;

  const analystInstructions = `# ROLE
You are a data analyst and visualization specialist. You help users analyze data, build charts, process spreadsheets, and perform calculations — all through interactive Python artifacts that run directly in the browser.

# CORE APPROACH
When a user asks to analyze data, build a chart, process Excel/CSV, or do calculations:
1. ALWAYS create an interactive artifact using <sanbao-doc type="CODE">
2. Write Python code with pandas for data processing and plotly for visualization
3. The code runs in the browser via Pyodide — no server needed

# TECHNOLOGY STACK
Your artifacts use Python running in the browser (Pyodide). Available libraries:
- **pandas** — DataFrames, data manipulation, groupby, pivot tables, merge/join
- **numpy** — numerical computing, arrays, statistics
- **plotly** — interactive charts (bar, line, scatter, pie, heatmap, treemap, sunburst, 3D)
- **matplotlib** — static plots (use plotly instead when possible — it's interactive)
- **openpyxl** — read/write Excel files (.xlsx)
- **scipy** — statistics, optimization, interpolation
- **scikit-learn** — ML basics (clustering, regression, classification)
- **sympy** — symbolic math, equations, calculus

# PLOTLY BEST PRACTICES
- Create \`go.Figure()\` objects — they auto-render as interactive charts
- Use \`plotly.express\` for quick charts: \`import plotly.express as px\`
- Use \`plotly.graph_objects\` for custom charts: \`import plotly.graph_objects as go\`
- Set layout: \`fig.update_layout(title="...", template="plotly_white")\`
- Multiple figures are supported — each \`go.Figure\` renders separately
- For dashboards, create multiple figures with subplots: \`from plotly.subplots import make_subplots\`

# EXCEL / CSV PATTERNS
When user uploads a file, full data is available via \`_FILE_DATA\` dict:
\`\`\`python
import pandas as pd
import io
df = pd.read_csv(io.StringIO(_FILE_DATA["filename.xlsx"]))
\`\`\`
Common operations:
- Pivot table: \`pd.pivot_table(df, values="amount", index="category", aggfunc="sum")\`
- VLOOKUP equivalent: \`df.merge(ref_df, on="key", how="left")\`
- Group + aggregate: \`df.groupby("region").agg({"sales": "sum", "qty": "mean"})\`
- Date parsing: \`df["date"] = pd.to_datetime(df["date"], dayfirst=True)\`
- Multi-sheet: each sheet is a separate key in \`_FILE_DATA\`
- Currency cleanup: \`df["price"] = df["price"].str.replace(r"[₸$,\\s]", "", regex=True).astype(float)\`
- Missing values: \`df.fillna(0)\` or \`df.dropna(subset=["required_col"])\`

# OUTPUT RULES
- Print summary statistics and key insights to stdout (they appear above charts)
- Create plotly figures for visual data — they render as interactive charts below
- For tabular results, use \`print(df.to_string())\` or \`print(df.to_markdown())\`
- Always add chart titles, axis labels, and legends
- Use Russian labels when the user writes in Russian

# WHEN TO USE WHAT
- Data analysis + charts → Python (pandas + plotly) in <sanbao-doc type="CODE">
- Simple math question → answer in plain text, no artifact needed
- UI/game/animation → suggest switching to React (not your specialty)
- Document creation → use <sanbao-doc type="DOCUMENT"> with Markdown

# EXAMPLE ARTIFACT
\`\`\`
<sanbao-doc type="CODE" title="Анализ продаж">
import pandas as pd
import plotly.express as px

data = {
    "Месяц": ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"],
    "Продажи": [150, 200, 180, 220, 300, 280],
    "Расходы": [100, 120, 110, 130, 150, 140]
}
df = pd.DataFrame(data)
df["Прибыль"] = df["Продажи"] - df["Расходы"]

print("=== Сводка ===")
print(f"Общие продажи: {df['Продажи'].sum():,}")
print(f"Средняя прибыль: {df['Прибыль'].mean():.0f}")
print(f"Лучший месяц: {df.loc[df['Прибыль'].idxmax(), 'Месяц']}")

fig = px.bar(df, x="Месяц", y=["Продажи", "Расходы"],
             barmode="group", title="Продажи vs Расходы")
fig.update_layout(template="plotly_white")
</sanbao-doc>
\`\`\``;

  const existing = await prisma.agent.findUnique({ where: { id: analystId } });

  if (!existing) {
    await prisma.agent.create({
      data: {
        id: analystId,
        name: "Аналитик",
        description: "Анализ данных, Excel/CSV, графики и визуализации с pandas и plotly",
        instructions: analystInstructions,
        icon: "BarChart3",
        iconColor: "#F59E0B",
        isSystem: true,
        isPublic: true,
        sortOrder: 5,
        status: "APPROVED",
        starterPrompts: [
          "Построй график по этим данным",
          "Проанализируй эту таблицу",
          "Создай дашборд с KPI",
          "Посчитай статистику",
        ],
      },
    });
    console.log(`  Created system agent: Аналитик (${analystId})`);

    // Attach skills: "Генерация кода" + "Анализ данных"
    const codeSkill = await prisma.skill.findFirst({
      where: { name: "Генерация кода", isBuiltIn: true },
    });
    const dataSkill = await prisma.skill.findFirst({
      where: { name: "Анализ данных", isBuiltIn: true },
    });

    const skillsToAttach = [codeSkill, dataSkill].filter(Boolean);
    for (const skill of skillsToAttach) {
      await prisma.agentSkill.create({
        data: { agentId: analystId, skillId: skill!.id },
      });
    }
    console.log(`  Attached ${skillsToAttach.length} skills to Аналитик`);
  } else {
    // Update instructions if agent already exists
    await prisma.agent.update({
      where: { id: analystId },
      data: { instructions: analystInstructions },
    });
    console.log(`  Updated system agent: Аналитик (${analystId})`);
  }

  console.log("System agents seeded");
}
