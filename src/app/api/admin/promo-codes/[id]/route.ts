import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";

export const { PUT, DELETE } = createAdminCrudHandlers({
  model: "promoCode",
  allowedUpdateFields: ["isActive", "discount", "maxUses", "validUntil"],
  notFoundMsg: "Промо-код не найден",
  transformField: (field, value) => {
    if (field === "validUntil") return value ? new Date(value as string) : null;
    return value;
  },
});
