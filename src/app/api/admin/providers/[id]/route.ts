import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";
import { invalidateModelCache } from "@/lib/model-router";
import { encrypt } from "@/lib/crypto";
import { isUrlSafe } from "@/lib/ssrf";
import { jsonError } from "@/lib/api-helpers";

function maskApiKey(key: string | null): string {
  if (!key) return "";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

export const { GET, PUT, DELETE } = createAdminCrudHandlers({
  model: "aiProvider",
  allowedUpdateFields: ["name", "slug", "baseUrl", "apiKey", "isActive", "priority", "apiFormat"],
  notFoundMsg: "Провайдер не найден",
  include: { models: { orderBy: { displayName: "asc" } } },
  transformGet: (record) => ({
    ...record,
    apiKey: maskApiKey(record.apiKey as string | null),
  }),
  transformPut: (record) => ({
    ...record,
    apiKey: maskApiKey(record.apiKey as string | null),
  }),
  beforeUpdate: (body) => {
    if (body.baseUrl && !isUrlSafe(body.baseUrl as string)) {
      return jsonError("Недопустимый baseUrl: приватные и локальные адреса запрещены", 400);
    }
  },
  transformField: (field, value) => {
    if (field === "apiKey") return encrypt(value as string);
    return value;
  },
  afterUpdate: invalidateModelCache,
  afterDelete: invalidateModelCache,
});
