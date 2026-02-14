export interface TemplateField {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "number" | "textarea" | "select";
  options?: string[];
  required: boolean;
}

export interface LegalTemplate {
  id: string;
  toolId: string;
  name: string;
  description: string;
  fields: TemplateField[];
  promptTemplate: string;
}

export const LEGAL_TEMPLATES: LegalTemplate[] = [
  // ─── Договоры ──────────────────────────────────────────
  {
    id: "contract-service",
    toolId: "contract",
    name: "Договор оказания услуг",
    description: "Договор возмездного оказания услуг (гл. 33 ГК РК)",
    fields: [
      { id: "clientName", label: "Заказчик", placeholder: 'ТОО "Компания"', type: "text", required: true },
      { id: "executorName", label: "Исполнитель", placeholder: "ИП Асанов А.Б.", type: "text", required: true },
      { id: "serviceDescription", label: "Описание услуг", placeholder: "Юридическое сопровождение сделки...", type: "textarea", required: true },
      { id: "price", label: "Стоимость (₸)", placeholder: "500000", type: "number", required: true },
      { id: "duration", label: "Срок действия", placeholder: "12 месяцев", type: "text", required: true },
    ],
    promptTemplate: "Создай договор возмездного оказания услуг по законодательству Республики Казахстан (гл. 33 ГК РК). Заказчик: {{clientName}}. Исполнитель: {{executorName}}. Описание услуг: {{serviceDescription}}. Стоимость: {{price}} тенге. Срок действия: {{duration}}. Включи все стандартные разделы, ответственность сторон и реквизиты в таблице (БИН/ИИН, банковские реквизиты).",
  },
  {
    id: "contract-sale",
    toolId: "contract",
    name: "Договор купли-продажи",
    description: "Купля-продажа товаров или имущества (гл. 25 ГК РК)",
    fields: [
      { id: "sellerName", label: "Продавец", placeholder: 'ТОО "Продавец"', type: "text", required: true },
      { id: "buyerName", label: "Покупатель", placeholder: 'ТОО "Покупатель"', type: "text", required: true },
      { id: "itemDescription", label: "Предмет договора", placeholder: "Автомобиль Toyota Camry 2024 г.в., VIN...", type: "textarea", required: true },
      { id: "price", label: "Цена (₸)", placeholder: "15000000", type: "number", required: true },
      { id: "paymentTerms", label: "Условия оплаты", placeholder: "Полная предоплата / рассрочка 3 мес.", type: "text", required: false },
    ],
    promptTemplate: "Создай договор купли-продажи по законодательству Республики Казахстан (гл. 25 ГК РК). Продавец: {{sellerName}}. Покупатель: {{buyerName}}. Предмет: {{itemDescription}}. Цена: {{price}} тенге. Условия оплаты: {{paymentTerms}}. Включи гарантию качества, порядок передачи товара и реквизиты в таблице (БИН/ИИН, банковские реквизиты).",
  },
  {
    id: "contract-lease",
    toolId: "contract",
    name: "Договор аренды",
    description: "Аренда недвижимости или оборудования (гл. 29 ГК РК)",
    fields: [
      { id: "landlordName", label: "Арендодатель", placeholder: 'ТОО "Владелец"', type: "text", required: true },
      { id: "tenantName", label: "Арендатор", placeholder: 'ТОО "Арендатор"', type: "text", required: true },
      { id: "propertyDescription", label: "Объект аренды", placeholder: "Нежилое помещение 120 кв.м., г. Алматы, ул. ...", type: "textarea", required: true },
      { id: "rentAmount", label: "Арендная плата (₸/мес.)", placeholder: "350000", type: "number", required: true },
      { id: "duration", label: "Срок аренды", placeholder: "11 месяцев", type: "text", required: true },
    ],
    promptTemplate: "Создай договор аренды по законодательству Республики Казахстан (гл. 29 ГК РК). Арендодатель: {{landlordName}}. Арендатор: {{tenantName}}. Объект: {{propertyDescription}}. Арендная плата: {{rentAmount}} тенге/мес. Срок: {{duration}}. Включи обязанности по содержанию, условия расторжения и реквизиты в таблице (БИН/ИИН, банковские реквизиты).",
  },

  // ─── Иски ──────────────────────────────────────────────
  {
    id: "claim-debt",
    toolId: "claim",
    name: "Иск о взыскании задолженности",
    description: "Взыскание денежных средств по договору",
    fields: [
      { id: "courtName", label: "Суд", placeholder: "Специализированный межрайонный экономический суд г. Алматы", type: "text", required: true },
      { id: "plaintiffName", label: "Истец", placeholder: 'ТОО "Кредитор"', type: "text", required: true },
      { id: "defendantName", label: "Ответчик", placeholder: 'ТОО "Должник"', type: "text", required: true },
      { id: "debtAmount", label: "Сумма долга (₸)", placeholder: "5000000", type: "number", required: true },
      { id: "contractInfo", label: "Реквизиты договора", placeholder: "Договор поставки №12 от 01.03.2025", type: "text", required: true },
      { id: "circumstances", label: "Обстоятельства", placeholder: "Ответчик не оплатил поставленный товар...", type: "textarea", required: true },
    ],
    promptTemplate: "Подготовь исковое заявление о взыскании задолженности по законодательству Республики Казахстан. Суд: {{courtName}}. Истец: {{plaintiffName}}. Ответчик: {{defendantName}}. Сумма долга: {{debtAmount}} тенге. Основание: {{contractInfo}}. Обстоятельства: {{circumstances}}. Включи правовые основания (ст. 272, 273, 353 ГК РК), расчёт неустойки и перечень приложений. Госпошлину рассчитай по ставкам РК.",
  },
  {
    id: "claim-damages",
    toolId: "claim",
    name: "Иск о возмещении убытков",
    description: "Возмещение причинённых убытков (ст. 9 ГК РК)",
    fields: [
      { id: "courtName", label: "Суд", placeholder: "Районный суд №2 г. Алматы", type: "text", required: true },
      { id: "plaintiffName", label: "Истец", placeholder: "Асанов Алмас Бериккызы", type: "text", required: true },
      { id: "defendantName", label: "Ответчик", placeholder: 'ТОО "Виновник"', type: "text", required: true },
      { id: "damageAmount", label: "Сумма убытков (₸)", placeholder: "1500000", type: "number", required: true },
      { id: "circumstances", label: "Обстоятельства причинения убытков", placeholder: "В результате ненадлежащего исполнения обязательств...", type: "textarea", required: true },
    ],
    promptTemplate: "Подготовь исковое заявление о возмещении убытков по законодательству Республики Казахстан. Суд: {{courtName}}. Истец: {{plaintiffName}}. Ответчик: {{defendantName}}. Сумма убытков: {{damageAmount}} тенге. Обстоятельства: {{circumstances}}. Правовые основания: ст. 9, 350, 917 ГК РК. Включи расчёт убытков и перечень доказательств.",
  },

  // ─── Жалобы ────────────────────────────────────────────
  {
    id: "complaint-state",
    toolId: "complaint",
    name: "Жалоба в государственный орган",
    description: "Жалоба в прокуратуру, Агентство РК по защите прав потребителей и др.",
    fields: [
      { id: "authorityName", label: "Адресат (орган)", placeholder: "Прокуратура г. Алматы", type: "text", required: true },
      { id: "applicantName", label: "Заявитель", placeholder: "Асанов Алмас Бериккызы", type: "text", required: true },
      { id: "applicantAddress", label: "Адрес заявителя", placeholder: "г. Алматы, ул. Абая, д. 1, кв. 15", type: "text", required: true },
      { id: "violationDescription", label: "Описание нарушения", placeholder: "Незаконный отказ в предоставлении информации...", type: "textarea", required: true },
      { id: "demands", label: "Требования", placeholder: "Провести проверку и привлечь к ответственности", type: "textarea", required: true },
    ],
    promptTemplate: "Составь жалобу в государственный орган по законодательству Республики Казахстан. Адресат: {{authorityName}}. Заявитель: {{applicantName}}, адрес: {{applicantAddress}}. Суть нарушения: {{violationDescription}}. Требования: {{demands}}. Включи ссылки на применимые НПА Республики Казахстан и перечень приложений.",
  },
  {
    id: "complaint-appeal",
    toolId: "complaint",
    name: "Апелляционная жалоба",
    description: "Обжалование решения суда первой инстанции (ГПК РК)",
    fields: [
      { id: "courtName", label: "Суд апелляционной инстанции", placeholder: "Судебная коллегия по гражданским делам Алматинского городского суда", type: "text", required: true },
      { id: "appellantName", label: "Апеллянт", placeholder: 'ТОО "Заявитель"', type: "text", required: true },
      { id: "caseNumber", label: "Номер дела", placeholder: "№ 7528-25-00-2г/12", type: "text", required: true },
      { id: "decisionInfo", label: "Обжалуемое решение", placeholder: "Решение районного суда №2 г. Алматы от 01.06.2025", type: "text", required: true },
      { id: "grounds", label: "Основания для обжалования", placeholder: "Суд неправильно применил нормы материального права...", type: "textarea", required: true },
    ],
    promptTemplate: "Составь апелляционную жалобу по законодательству Республики Казахстан. Суд: {{courtName}}. Апеллянт: {{appellantName}}. Дело: {{caseNumber}}. Обжалуемое решение: {{decisionInfo}}. Основания: {{grounds}}. Включи ссылки на ст. 401-403 ГПК РК, просительную часть и перечень приложений.",
  },
];

export function getTemplatesForTool(toolId: string): LegalTemplate[] {
  return LEGAL_TEMPLATES.filter((t) => t.toolId === toolId);
}

export function fillTemplate(
  template: LegalTemplate,
  values: Record<string, string>
): string {
  let result = template.promptTemplate;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
