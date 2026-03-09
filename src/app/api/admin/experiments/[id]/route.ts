import { createAdminCrudHandlers } from "@/lib/admin-crud-factory";
import { invalidateExperimentCache } from "@/lib/ab-experiment";

export const { PUT, DELETE } = createAdminCrudHandlers({
  model: "promptExperiment",
  allowedUpdateFields: ["name", "description", "promptA", "promptB", "splitPercent", "isActive", "targetKey"],
  notFoundMsg: "Эксперимент не найден",
  afterUpdate: invalidateExperimentCache,
  afterDelete: invalidateExperimentCache,
});
