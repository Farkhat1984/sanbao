import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";

export const { GET, PUT, DELETE } = createAdminCrudHandlers({
  model: "skill",
  allowedUpdateFields: [
    "name", "description", "systemPrompt", "templates", "citationRules",
    "jurisdiction", "icon", "iconColor", "isBuiltIn", "isPublic", "status",
    "category", "tags",
  ],
  notFoundMsg: "Скилл не найден",
  include: {
    user: { select: { id: true, name: true, email: true } },
    _count: { select: { agents: true } },
  },
  transformField: (field, value) => {
    if (field === "tags") {
      return Array.isArray(value)
        ? (value as unknown[]).filter((t) => typeof t === "string" && (t as string).length <= 50).slice(0, 20)
        : [];
    }
    return value;
  },
});
