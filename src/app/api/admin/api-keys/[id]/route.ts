import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";

const maskKey = (record: Record<string, unknown>) => ({
  ...record,
  key: typeof record.key === "string"
    ? `${record.key.slice(0, 8)}...${record.key.slice(-4)}`
    : record.key,
});

export const { PUT, DELETE } = createAdminCrudHandlers({
  model: "apiKey",
  allowedUpdateFields: ["name", "isActive", "rateLimit", "expiresAt"],
  notFoundMsg: "API-ключ не найден",
  transformPut: maskKey,
  transformField: (field, value) => {
    if (field === "expiresAt" && value) return new Date(value as string);
    return value;
  },
});
