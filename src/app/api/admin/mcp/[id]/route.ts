import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";
import { isUrlSafe } from "@/lib/ssrf";
import { jsonError } from "@/lib/api-helpers";

export const { PUT, DELETE } = createAdminCrudHandlers({
  model: "mcpServer",
  allowedUpdateFields: ["name", "url", "transport", "apiKey", "status", "isEnabled"],
  notFoundMsg: "Сервер не найден",
  findWhere: { isGlobal: true },
  beforeUpdate: (body) => {
    if (typeof body.url === "string" && !isUrlSafe(body.url)) {
      return jsonError("URL заблокирован (SSRF protection)", 400);
    }
  },
});
