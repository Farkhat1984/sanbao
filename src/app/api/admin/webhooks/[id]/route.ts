import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";
import { isUrlSafe } from "@/lib/ssrf";
import { jsonError } from "@/lib/api-helpers";

export const { PUT, DELETE } = createAdminCrudHandlers({
  model: "webhook",
  allowedUpdateFields: ["url", "events", "isActive"],
  notFoundMsg: "Вебхук не найден",
  beforeUpdate: (body) => {
    if (body.url !== undefined && !isUrlSafe((body.url as string).trim())) {
      return jsonError("URL указывает на внутреннюю сеть или некорректен", 400);
    }
  },
});
