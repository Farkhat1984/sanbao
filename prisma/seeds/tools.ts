import type { PrismaClient } from "@prisma/client";
import { AGENT_IDS } from "./agents";
import { upsertToolsWithAgentLink } from "./utils";
import type { ToolDefinition, ToolWithAgent } from "./utils";

/**
 * Seed all tools (legal, general, accounting, 1C, specialized) and link them to agents.
 * Must run after agents are seeded.
 */
export async function seedTools(prisma: PrismaClient): Promise<void> {
  // ─── Tools: Legal (Фемида) ────────────────────────────────

  const legalTools: ToolDefinition[] = [
    {
      id: "tool-contract",
      name: "Создать договор",
      description: "Составить договор по шаблону или с нуля",
      icon: "FileText",
      iconColor: "#5E7A8A",
      config: {
        prompt: "Я хочу создать договор по законодательству РК. Пожалуйста, уточни: 1) Тип договора (купли-продажи, оказания услуг, аренды и т.д.), 2) Стороны договора (наименование, БИН/ИИН), 3) Основные условия и сумму в тенге.",
        templates: [
          {
            id: "contract-service",
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
        ],
      },
      sortOrder: 0,
    },
    {
      id: "tool-claim",
      name: "Подготовить иск",
      description: "Исковое заявление в суд РК",
      icon: "Gavel",
      iconColor: "#B8956A",
      config: {
        prompt: "Я хочу подготовить исковое заявление по законодательству РК. Пожалуйста, уточни: 1) Тип иска, 2) Суть спора, 3) Требования к ответчику, 4) В какой суд подаётся.",
        templates: [
          {
            id: "claim-debt",
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
        ],
      },
      sortOrder: 1,
    },
    {
      id: "tool-complaint",
      name: "Составить жалобу",
      description: "Жалоба в гос. органы РК или суд",
      icon: "AlertTriangle",
      iconColor: "#F59E0B",
      config: {
        prompt: "Я хочу составить жалобу по законодательству РК. Пожалуйста, уточни: 1) На что жалоба, 2) В какой орган направляется (прокуратура, акимат, суд и т.д.), 3) Суть нарушения.",
        templates: [
          {
            id: "complaint-state",
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
        ],
      },
      sortOrder: 2,
    },
    {
      id: "tool-search-npa",
      name: "Поиск по НПА РК",
      description: "Найти статью закона или нормативный акт РК",
      icon: "Search",
      iconColor: "#10B981",
      config: {
        prompt: "Помоги найти нормативно-правовой акт Республики Казахстан. Что именно ищешь? Укажи тему, ключевые слова или номер закона.",
      },
      sortOrder: 3,
    },
    {
      id: "tool-check-actuality",
      name: "Проверить актуальность",
      description: "Проверка актуальности статьи закона РК",
      icon: "CheckCircle",
      iconColor: "#06B6D4",
      config: {
        prompt: "Проверь актуальность следующей статьи закона РК. Укажи номер статьи и закона, и я проверю последние изменения и поправки.",
      },
      sortOrder: 4,
    },
    {
      id: "tool-legal-consult",
      name: "Консультация",
      description: "Юридическая консультация по законодательству РК",
      icon: "MessageSquare",
      iconColor: "#C4857A",
      config: {
        prompt: "Мне нужна юридическая консультация по законодательству Казахстана. Опиши свою ситуацию, и я помогу разобраться с правовой стороной.",
      },
      sortOrder: 5,
    },
    {
      id: "tool-customs-declaration",
      name: "Таможенная декларация",
      description: "ДТ ЕАЭС — декларация на товары",
      icon: "Package",
      iconColor: "#06B6D4",
      config: {
        prompt: "Я хочу составить таможенную декларацию на товары (ДТ) по форме ЕАЭС. Укажи: 1) Тип декларации (ИМ — импорт, ЭК — экспорт, ТТ — транзит), 2) Описание товара и код ТН ВЭД, 3) Стороны (отправитель, получатель, декларант), 4) Условия поставки (Incoterms).",
        templates: [
          {
            id: "dt-import",
            name: "ДТ на импорт (ИМ)",
            description: "Декларация на импортируемые товары — ИМ 40 (выпуск для внутреннего потребления)",
            fields: [
              { id: "declarationType", label: "Тип декларации (графа 1)", placeholder: "ИМ 40", type: "text", required: true },
              { id: "exporterName", label: "Отправитель/Экспортёр (графа 2)", placeholder: "ABC Trading Ltd., China, Shanghai", type: "textarea", required: true },
              { id: "consignee", label: "Получатель (графа 8)", placeholder: 'ТОО "Импорт Трейд", БИН 123456789012, г. Алматы', type: "textarea", required: true },
              { id: "declarantName", label: "Декларант (графа 14)", placeholder: 'ТОО "Импорт Трейд", БИН 123456789012', type: "text", required: true },
              { id: "countryOrigin", label: "Страна происхождения (графа 16)", placeholder: "Китай (CN)", type: "text", required: true },
              { id: "countryDestination", label: "Страна назначения (графа 17)", placeholder: "Казахстан (KZ)", type: "text", required: true },
              { id: "incoterms", label: "Условия поставки (графа 20)", placeholder: "CIF Алматы", type: "text", required: true },
              { id: "currency", label: "Валюта и общая стоимость (графа 22)", placeholder: "USD 45 000.00", type: "text", required: true },
              { id: "exchangeRate", label: "Курс валюты (графа 23)", placeholder: "1 USD = 470.50 KZT", type: "text", required: false },
              { id: "transportMode", label: "Вид транспорта (графа 25)", placeholder: "Автомобильный (3)", type: "text", required: false },
              { id: "goodsDescription", label: "Описание товаров (графа 31)", placeholder: "Электронные компоненты: микросхемы интегральные, 5000 шт., модель XYZ-100", type: "textarea", required: true },
              { id: "hsCode", label: "Код ТН ВЭД ЕАЭС (графа 33)", placeholder: "8542 31 000 0", type: "text", required: true },
              { id: "grossWeight", label: "Вес брутто, кг (графа 35)", placeholder: "1250.00", type: "text", required: true },
              { id: "netWeight", label: "Вес нетто, кг (графа 38)", placeholder: "1100.00", type: "text", required: true },
              { id: "customsProcedure", label: "Таможенная процедура (графа 37)", placeholder: "40 00 000", type: "text", required: true },
              { id: "customsValue", label: "Таможенная стоимость (графа 45)", placeholder: "21 172 500 KZT", type: "text", required: true },
              { id: "documents", label: "Документы (графа 44)", placeholder: "Инвойс №INV-2025-001, CMR, сертификат происхождения CT-1", type: "textarea", required: false },
            ],
            promptTemplate: "Составь таможенную декларацию на товары (ДТ) по форме ЕАЭС для импорта. Тип: {{declarationType}}. Отправитель/Экспортёр (гр.2): {{exporterName}}. Получатель (гр.8): {{consignee}}. Декларант (гр.14): {{declarantName}}. Страна происхождения (гр.16): {{countryOrigin}}. Страна назначения (гр.17): {{countryDestination}}. Условия поставки (гр.20): {{incoterms}}. Валюта и стоимость (гр.22): {{currency}}. Курс (гр.23): {{exchangeRate}}. Транспорт (гр.25): {{transportMode}}. Описание товаров (гр.31): {{goodsDescription}}. Код ТН ВЭД (гр.33): {{hsCode}}. Вес брутто (гр.35): {{grossWeight}} кг. Вес нетто (гр.38): {{netWeight}} кг. Процедура (гр.37): {{customsProcedure}}. Таможенная стоимость (гр.45): {{customsValue}}. Документы (гр.44): {{documents}}. Оформи как полную ДТ со всеми графами в табличном формате, рассчитай таможенные платежи (пошлина, НДС) и итоговую сумму.",
          },
          {
            id: "dt-export",
            name: "ДТ на экспорт (ЭК)",
            description: "Декларация на экспортируемые товары — ЭК 10 (экспорт)",
            fields: [
              { id: "declarationType", label: "Тип декларации (графа 1)", placeholder: "ЭК 10", type: "text", required: true },
              { id: "exporterName", label: "Отправитель/Экспортёр (графа 2)", placeholder: 'ТОО "Казах Экспорт", БИН 987654321098, г. Астана', type: "textarea", required: true },
              { id: "consignee", label: "Получатель (графа 8)", placeholder: "Global Import GmbH, Germany, Berlin", type: "textarea", required: true },
              { id: "declarantName", label: "Декларант (графа 14)", placeholder: 'ТОО "Казах Экспорт", БИН 987654321098', type: "text", required: true },
              { id: "countryOrigin", label: "Страна происхождения (графа 16)", placeholder: "Казахстан (KZ)", type: "text", required: true },
              { id: "countryDestination", label: "Страна назначения (графа 17)", placeholder: "Германия (DE)", type: "text", required: true },
              { id: "incoterms", label: "Условия поставки (графа 20)", placeholder: "FCA Астана", type: "text", required: true },
              { id: "currency", label: "Валюта и общая стоимость (графа 22)", placeholder: "EUR 120 000.00", type: "text", required: true },
              { id: "goodsDescription", label: "Описание товаров (графа 31)", placeholder: "Ферросплавы: феррохром высокоуглеродистый, 50 тонн", type: "textarea", required: true },
              { id: "hsCode", label: "Код ТН ВЭД ЕАЭС (графа 33)", placeholder: "7202 41 100 0", type: "text", required: true },
              { id: "grossWeight", label: "Вес брутто, кг (графа 35)", placeholder: "52000.00", type: "text", required: true },
              { id: "netWeight", label: "Вес нетто, кг (графа 38)", placeholder: "50000.00", type: "text", required: true },
              { id: "customsProcedure", label: "Таможенная процедура (графа 37)", placeholder: "10 00 000", type: "text", required: true },
              { id: "customsValue", label: "Таможенная стоимость (графа 45)", placeholder: "56 460 000 KZT", type: "text", required: true },
              { id: "documents", label: "Документы (графа 44)", placeholder: "Контракт №EXP-2025-05, инвойс, ж/д накладная, сертификат качества", type: "textarea", required: false },
            ],
            promptTemplate: "Составь таможенную декларацию на товары (ДТ) по форме ЕАЭС для экспорта. Тип: {{declarationType}}. Отправитель (гр.2): {{exporterName}}. Получатель (гр.8): {{consignee}}. Декларант (гр.14): {{declarantName}}. Страна происхождения (гр.16): {{countryOrigin}}. Страна назначения (гр.17): {{countryDestination}}. Условия поставки (гр.20): {{incoterms}}. Стоимость (гр.22): {{currency}}. Товары (гр.31): {{goodsDescription}}. Код ТН ВЭД (гр.33): {{hsCode}}. Вес брутто (гр.35): {{grossWeight}} кг. Вес нетто (гр.38): {{netWeight}} кг. Процедура (гр.37): {{customsProcedure}}. Таможенная стоимость (гр.45): {{customsValue}}. Документы (гр.44): {{documents}}. Оформи как полную ДТ со всеми графами в табличном формате, укажи применимые экспортные пошлины и сборы.",
          },
        ],
      },
      sortOrder: 7,
    },
  ];

  await upsertToolsWithAgentLink(prisma, legalTools, AGENT_IDS.femida);
  console.log(`Legal tools seeded: ${legalTools.length} tools`);

  // ─── Tools: General (Sanbao) ───────────────────────────────

  const generalTools: ToolDefinition[] = [
    {
      id: "tool-gen-image",
      name: "Создать картинку",
      description: "Сгенерировать изображение по описанию",
      icon: "Sparkles",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Создай изображение: уютная кофейня в дождливый вечер, тёплый свет из окон, акварельный стиль",
      },
      sortOrder: 0,
    },
    {
      id: "tool-gen-document",
      name: "Написать документ",
      description: "Письмо, статья, план или отчёт",
      icon: "FileText",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Помоги написать профессиональное деловое письмо с благодарностью партнёру за сотрудничество",
      },
      sortOrder: 1,
    },
    {
      id: "tool-gen-search",
      name: "Найти в интернете",
      description: "Поиск актуальной информации в сети",
      icon: "Globe",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Найди последние новости и тренды в области искусственного интеллекта за 2025 год",
      },
      sortOrder: 2,
    },
    {
      id: "tool-gen-code",
      name: "Написать код",
      description: "Скрипт, функция или полноценный проект",
      icon: "Code",
      iconColor: "#8FAF9F",
      config: {
        prompt: "Напиши скрипт на Python который парсит CSV файл, анализирует данные и строит график с помощью matplotlib",
      },
      sortOrder: 3,
    },
  ];

  await upsertToolsWithAgentLink(prisma, generalTools, AGENT_IDS.sanbao);
  console.log(`General tools seeded: ${generalTools.length} tools`);
  console.log("Agent-tool links created");

  // ─── Tools: Accounting (Бухгалтер) ────────────────────────────

  const accountingTools: ToolDefinition[] = [
    {
      id: "tool-salary-calc",
      name: "Расчёт зарплаты",
      description: "Расчёт заработной платы с налогами и соц. платежами",
      icon: "Calculator",
      iconColor: "#059669",
      config: {
        prompt: "Помогу рассчитать зарплату сотрудника с учётом всех налогов и социальных платежей по актуальным ставкам 2026 года.",
        templates: [
          {
            id: "salary-calc",
            name: "Расчёт зарплаты",
            description: "Полный расчёт ЗП с ИПН, ОПВ, ВОСМС, СО, СН, ОПВР",
            fields: [
              { id: "employeeName", label: "Сотрудник", placeholder: "Асанов Алмас Бериккызы", type: "text", required: true },
              { id: "salary", label: "Оклад (₸)", placeholder: "350000", type: "number", required: true },
              { id: "period", label: "Период", placeholder: "Январь 2026", type: "text", required: true },
              { id: "taxMode", label: "Режим налогообложения", placeholder: "Общий / Упрощённый", type: "text", required: true },
            ],
            promptTemplate: "Рассчитай заработную плату сотрудника по законодательству Республики Казахстан (Новый НК РК 2026). Сотрудник: {{employeeName}}. Оклад: {{salary}} тенге. Период: {{period}}. Режим: {{taxMode}}. Покажи полную расшифровку: ОПВ (10%), ВОСМС (2%), ИПН (10%/15% прогрессивная шкала, базовый вычет 30 МРП), СО (5%), СН (6%), ОПВР (3.5%). Итого: к выплате, за счёт работодателя, всего ФОТ. Используй актуальные ставки через sql_query.",
          },
        ],
      },
      sortOrder: 0,
    },
    {
      id: "tool-tax-declaration",
      name: "Налоговая декларация",
      description: "Помощь в заполнении налоговых форм РК",
      icon: "FileText",
      iconColor: "#059669",
      config: {
        prompt: "Помогу с заполнением налоговой декларации по законодательству РК. Укажи тип формы и период.",
        templates: [
          {
            id: "tax-form",
            name: "Налоговая декларация",
            description: "Заполнение форм 100, 200, 300, 910 и других",
            fields: [
              { id: "formType", label: "Тип формы", placeholder: "100 / 200 / 300 / 910", type: "text", required: true },
              { id: "period", label: "Налоговый период", placeholder: "1 квартал 2026", type: "text", required: true },
              { id: "orgName", label: "Организация", placeholder: 'ТОО "Компания"', type: "text", required: true },
            ],
            promptTemplate: "Помоги заполнить налоговую декларацию формы {{formType}} за {{period}} для {{orgName}} по законодательству Республики Казахстан (Новый НК РК 2026). Покажи: 1) Какие строки нужно заполнить, 2) Формулы расчёта по каждой строке, 3) Актуальные ставки и коэффициенты, 4) Сроки сдачи, 5) Пошаговую инструкцию заполнения в 1С:Бухгалтерия. Используй инструменты для проверки актуальных ставок.",
          },
        ],
      },
      sortOrder: 1,
    },
    {
      id: "tool-accounting-memo",
      name: "Бухгалтерская справка",
      description: "Составить бухгалтерскую справку-расчёт",
      icon: "ClipboardCheck",
      iconColor: "#059669",
      config: {
        prompt: "Составлю бухгалтерскую справку-расчёт по операции. Укажи детали.",
        templates: [
          {
            id: "accounting-memo",
            name: "Бухгалтерская справка",
            description: "Справка-расчёт с проводками и обоснованием",
            fields: [
              { id: "operation", label: "Операция", placeholder: "Начисление амортизации ОС / Списание ТМЗ / Курсовая разница", type: "text", required: true },
              { id: "amount", label: "Сумма (₸)", placeholder: "1500000", type: "number", required: true },
              { id: "basis", label: "Основание", placeholder: "Приказ №15 от 01.01.2026, Акт инвентаризации", type: "text", required: true },
              { id: "date", label: "Дата операции", placeholder: "15.01.2026", type: "text", required: true },
            ],
            promptTemplate: "Составь бухгалтерскую справку-расчёт по операции: {{operation}}. Сумма: {{amount}} тенге. Основание: {{basis}}. Дата: {{date}}. Включи: 1) Реквизиты организации, 2) Описание операции, 3) Бухгалтерские проводки (Дт/Кт с 4-значными кодами ТПС РК), 4) Расчёт суммы, 5) Ссылки на МСФО/НСФО и НК РК, 6) Подписи (главный бухгалтер, директор). Используй инструменты для проверки счетов и стандартов.",
          },
        ],
      },
      sortOrder: 2,
    },
    {
      id: "tool-accounting-policy",
      name: "Учётная политика",
      description: "Разработать или обновить учётную политику",
      icon: "BookOpen",
      iconColor: "#059669",
      config: {
        prompt: "Помогу разработать учётную политику организации по законодательству РК.",
        templates: [
          {
            id: "accounting-policy",
            name: "Учётная политика",
            description: "Учётная политика для ТОО, АО или ИП",
            fields: [
              { id: "orgType", label: "Тип организации", placeholder: "ТОО / АО / ИП", type: "text", required: true },
              { id: "taxMode", label: "Режим налогообложения", placeholder: "Общеустановленный / Упрощённый / Специальный", type: "text", required: true },
            ],
            promptTemplate: "Разработай учётную политику для {{orgType}} на {{taxMode}} режиме налогообложения по законодательству Республики Казахстан (2026 год). Включи: 1) Общие положения и нормативная база (МСФО/НСФО, НК РК 2026), 2) Организация бухучёта, 3) Методы оценки активов и обязательств, 4) Учёт ОС и амортизация, 5) Учёт ТМЗ, 6) Учёт доходов и расходов, 7) Налоговый учёт (актуальные ставки 2026), 8) Порядок инвентаризации, 9) Документооборот. Используй инструменты для ссылок на стандарты и нормы.",
          },
        ],
      },
      sortOrder: 3,
    },
  ];

  await upsertToolsWithAgentLink(prisma, accountingTools, AGENT_IDS.accountant);
  console.log(`Accounting tools seeded: ${accountingTools.length} tools`);
  console.log("Agent-tool links created: Бухгалтер");

  // ─── Tools: 1С Ассистент ────────────────────────────────

  const consultant1cTools: ToolDefinition[] = [
    {
      id: "tool-1c-howto",
      name: "Как сделать в 1С",
      description: "Пошаговая инструкция по операции в 1С",
      icon: "Wrench",
      iconColor: "#F97316",
      config: {
        prompt: "Помогу с пошаговой инструкцией по 1С. Опиши что нужно сделать и в какой конфигурации.",
        templates: [
          {
            id: "1c-howto",
            name: "Как сделать в 1С",
            description: "Пошаговая инструкция с навигацией по интерфейсу",
            fields: [
              { id: "operation", label: "Операция", placeholder: "Настроить обмен данными между базами", type: "textarea", required: true },
              { id: "config", label: "Конфигурация", placeholder: "1С:ERP / 1С:Бухгалтерия 3.0 / 1С:Розница", type: "text", required: true },
              { id: "platform", label: "Версия платформы", placeholder: "8.3.25", type: "text", required: false },
            ],
            promptTemplate: "Дай пошаговую инструкцию: {{operation}} в {{config}} (платформа {{platform}}). Используй search для поиска по документации. Покажи: 1) Путь навигации (меню → раздел → документ), 2) Пошаговые действия, 3) Настройки и параметры, 4) Возможные ошибки и их решения.",
          },
        ],
      },
      sortOrder: 0,
    },
    {
      id: "tool-1c-code",
      name: "Код 1С",
      description: "Написать код на встроенном языке 1С",
      icon: "Code",
      iconColor: "#F97316",
      config: {
        prompt: "Помогу написать код на встроенном языке 1С. Опиши задачу.",
        templates: [
          {
            id: "1c-code",
            name: "Код на языке 1С",
            description: "Процедура, функция или обработка на встроенном языке",
            fields: [
              { id: "task", label: "Задача", placeholder: "Загрузка данных из Excel в справочник Номенклатура", type: "textarea", required: true },
              { id: "context", label: "Контекст", placeholder: "Модуль формы / Общий модуль / Обработка", type: "text", required: false },
              { id: "config", label: "Конфигурация", placeholder: "1С:ERP / БСП / Самописная", type: "text", required: false },
            ],
            promptTemplate: "Напиши код на встроенном языке 1С для задачи: {{task}}. Контекст: {{context}}. Конфигурация: {{config}}. Используй search для проверки синтаксиса и лучших практик. Код должен: 1) Следовать стандартам 1С, 2) Обрабатывать ошибки, 3) Иметь комментарии, 4) Быть оптимальным по производительности.",
          },
        ],
      },
      sortOrder: 1,
    },
    {
      id: "tool-1c-query",
      name: "Запрос 1С",
      description: "Написать запрос на языке запросов 1С",
      icon: "FileSearch",
      iconColor: "#F97316",
      config: {
        prompt: "Помогу написать запрос на языке запросов 1С. Опиши какие данные нужны.",
        templates: [
          {
            id: "1c-query",
            name: "Запрос 1С",
            description: "SELECT-запрос с виртуальными таблицами и соединениями",
            fields: [
              { id: "data", label: "Какие данные нужны", placeholder: "Остатки товаров на складе с ценами закупки", type: "textarea", required: true },
              { id: "registers", label: "Регистры/Справочники", placeholder: "РегистрНакопления.ТоварыНаСкладах, Справочник.Номенклатура", type: "text", required: false },
              { id: "filters", label: "Фильтры", placeholder: "За текущий месяц, склад = Основной", type: "text", required: false },
            ],
            promptTemplate: "Напиши запрос на языке запросов 1С: {{data}}. Регистры: {{registers}}. Фильтры: {{filters}}. Используй search для проверки виртуальных таблиц и синтаксиса. Запрос должен: 1) Использовать виртуальные таблицы где возможно (для производительности), 2) Иметь параметры (&Параметр), 3) Содержать комментарии, 4) Быть оптимальным.",
          },
        ],
      },
      sortOrder: 2,
    },
  ];

  await upsertToolsWithAgentLink(prisma, consultant1cTools, AGENT_IDS.consultant1c);
  console.log(`1С Ассистент tools seeded: ${consultant1cTools.length} tools`);

  // ─── Tools for specialized agents ──────────────────────────────

  const specializedTools: ToolWithAgent[] = [
    // ── GitHub Разработчик ──
    { id: "tool-github-review", name: "Code Review", description: "Ревью кода: PR, ветка или файл", icon: "Code", iconColor: "#8FAF9F", config: { prompt: "Сделай code review. Укажи репозиторий и номер PR или ветку для анализа.", templates: [{ id: "review-pr", name: "Review Pull Request", description: "Детальный code review PR с анализом качества и безопасности", fields: [{ id: "repo", label: "Репозиторий", placeholder: "owner/repo-name", type: "text", required: true }, { id: "prNumber", label: "Номер PR", placeholder: "42", type: "number", required: true }, { id: "focus", label: "Фокус ревью", placeholder: "Безопасность, производительность, читаемость", type: "text", required: false }], promptTemplate: "Проведи детальный code review для PR #{{prNumber}} в репозитории {{repo}}. Фокус: {{focus}}. Проанализируй: 1) Качество кода и соответствие стандартам, 2) Потенциальные баги и edge cases, 3) Безопасность (SQL injection, XSS, утечки данных), 4) Производительность, 5) Тестовое покрытие. Используй инструменты GitHub MCP для получения diff и файлов." }, { id: "review-security", name: "Аудит безопасности", description: "Анализ репозитория на уязвимости OWASP Top 10", fields: [{ id: "repo", label: "Репозиторий", placeholder: "owner/repo-name", type: "text", required: true }, { id: "scope", label: "Область анализа", placeholder: "auth, API endpoints, файлы конфигурации", type: "textarea", required: false }], promptTemplate: "Проведи аудит безопасности репозитория {{repo}}. Область: {{scope}}. Проверь: OWASP Top 10, хардкод секретов, небезопасные зависимости, SQL/NoSQL injection, XSS, CSRF, broken auth. Используй GitHub MCP для анализа кода и конфигураций." }] }, sortOrder: 10, agentId: AGENT_IDS.github },
    { id: "tool-github-pr-desc", name: "Описание PR", description: "Сгенерировать описание для Pull Request", icon: "FileText", iconColor: "#8FAF9F", config: { prompt: "Помогу написать описание для PR. Расскажи что было изменено.", templates: [{ id: "pr-description", name: "Описание Pull Request", description: "Структурированное описание PR с контекстом и чеклистом", fields: [{ id: "repo", label: "Репозиторий", placeholder: "owner/repo-name", type: "text", required: true }, { id: "branch", label: "Ветка", placeholder: "feature/user-auth", type: "text", required: true }, { id: "changes", label: "Описание изменений", placeholder: "Добавил авторизацию через OAuth, рефакторинг middleware...", type: "textarea", required: true }, { id: "issue", label: "Связанный issue", placeholder: "#123", type: "text", required: false }], promptTemplate: "Создай профессиональное описание PR для ветки {{branch}} в {{repo}}. Изменения: {{changes}}. Issue: {{issue}}. Формат: ## Summary (2-3 предложения), ## Changes (bullet list), ## Testing (как проверить), ## Screenshots (если UI). Используй GitHub MCP чтобы посмотреть реальные коммиты и diff в ветке." }] }, sortOrder: 11, agentId: AGENT_IDS.github },
    // ── SQL Аналитик ──
    { id: "tool-sql-report", name: "Аналитический отчёт", description: "Создать SQL-отчёт с агрегацией и визуализацией", icon: "FileSearch", iconColor: "#10B981", config: { prompt: "Создам аналитический отчёт по данным из БД. Укажи тему и метрики.", templates: [{ id: "report-analytics", name: "Бизнес-отчёт", description: "Аналитический отчёт с ключевыми метриками и трендами", fields: [{ id: "topic", label: "Тема отчёта", placeholder: "Продажи за Q1 2026", type: "text", required: true }, { id: "tables", label: "Таблицы/Источники", placeholder: "orders, users, products", type: "text", required: true }, { id: "metrics", label: "Ключевые метрики", placeholder: "Выручка, средний чек, конверсия, retention", type: "textarea", required: true }, { id: "period", label: "Период", placeholder: "01.01.2026 - 31.03.2026", type: "text", required: false }, { id: "groupBy", label: "Группировка", placeholder: "По дням / неделям / месяцам / категориям", type: "text", required: false }], promptTemplate: "Создай аналитический отчёт: {{topic}}. Таблицы: {{tables}}. Метрики: {{metrics}}. Период: {{period}}. Группировка: {{groupBy}}. Используй PostgreSQL MCP для: 1) Изучи структуру таблиц, 2) Напиши CTE-запросы с агрегацией, 3) Рассчитай метрики, 4) Покажи тренды и аномалии, 5) Сформулируй выводы и рекомендации." }, { id: "report-cohort", name: "Когортный анализ", description: "Анализ пользователей по когортам с retention", fields: [{ id: "userTable", label: "Таблица пользователей", placeholder: "users", type: "text", required: true }, { id: "eventTable", label: "Таблица событий", placeholder: "events / orders", type: "text", required: true }, { id: "cohortField", label: "Поле когорты", placeholder: "created_at / registration_date", type: "text", required: true }, { id: "period", label: "Период когорт", placeholder: "Помесячно за последние 6 месяцев", type: "text", required: false }], promptTemplate: "Проведи когортный анализ. Пользователи: {{userTable}}, события: {{eventTable}}, когорта по: {{cohortField}}. Период: {{period}}. Используй PostgreSQL MCP: 1) Определи когорты по дате регистрации, 2) Рассчитай retention по неделям/месяцам, 3) Найди лучшие и худшие когорты, 4) Выяви паттерны оттока." }] }, sortOrder: 12, agentId: AGENT_IDS.sql },
    { id: "tool-sql-optimize", name: "Оптимизация запроса", description: "Анализ и оптимизация медленного SQL", icon: "Lightbulb", iconColor: "#10B981", config: { prompt: "Помогу оптимизировать медленный SQL запрос. Вставь запрос и опиши проблему.", templates: [{ id: "optimize-query", name: "Оптимизация SQL", description: "EXPLAIN ANALYZE + рекомендации по индексам и рефакторингу", fields: [{ id: "sqlQuery", label: "SQL запрос", placeholder: "SELECT ... FROM ... WHERE ... JOIN ...", type: "textarea", required: true }, { id: "problem", label: "Проблема", placeholder: "Запрос выполняется 15 секунд на 1M строк", type: "text", required: false }, { id: "tableInfo", label: "Размер таблиц", placeholder: "orders: 2M строк, users: 500K строк", type: "text", required: false }], promptTemplate: "Оптимизируй SQL запрос:\n```sql\n{{sqlQuery}}\n```\nПроблема: {{problem}}. Таблицы: {{tableInfo}}. Используй PostgreSQL MCP: 1) Выполни EXPLAIN ANALYZE, 2) Проанализируй план выполнения, 3) Предложи индексы, 4) Перепиши запрос если нужно (CTE, lateral join, materialized view), 5) Сравни производительность до/после." }] }, sortOrder: 13, agentId: AGENT_IDS.sql },
    { id: "tool-sql-schema", name: "Проектирование схемы", description: "Спроектировать или доработать схему БД", icon: "ClipboardCheck", iconColor: "#10B981", config: { prompt: "Помогу спроектировать схему базы данных. Опиши предметную область.", templates: [{ id: "schema-design", name: "Новая схема БД", description: "Проектирование таблиц, связей и индексов с нуля", fields: [{ id: "domain", label: "Предметная область", placeholder: "E-commerce / CRM / SaaS / Образование", type: "text", required: true }, { id: "entities", label: "Основные сущности", placeholder: "Пользователи, заказы, товары, платежи, отзывы", type: "textarea", required: true }, { id: "requirements", label: "Требования", placeholder: "Мульти-тенантность, soft delete, аудит изменений", type: "textarea", required: false }], promptTemplate: "Спроектируй схему PostgreSQL для: {{domain}}. Сущности: {{entities}}. Требования: {{requirements}}. Используй PostgreSQL MCP чтобы проверить существующие таблицы. Создай: 1) CREATE TABLE с правильными типами и constraints, 2) Связи (FK, junction tables), 3) Индексы для частых запросов, 4) Триггеры если нужно, 5) Миграцию для применения." }] }, sortOrder: 14, agentId: AGENT_IDS.sql },
    // ── Веб-Исследователь ──
    { id: "tool-research-deep", name: "Глубокое исследование", description: "Комплексное исследование темы из множества источников", icon: "Globe", iconColor: "#06B6D4", config: { prompt: "Проведу глубокое исследование по теме. Укажи тему и глубину анализа.", templates: [{ id: "research-topic", name: "Исследование темы", description: "Структурированное исследование с источниками и выводами", fields: [{ id: "topic", label: "Тема", placeholder: "Тренды AI в здравоохранении 2026", type: "text", required: true }, { id: "depth", label: "Глубина", placeholder: "Обзорное / Среднее / Глубокое с научными источниками", type: "text", required: false }, { id: "language", label: "Язык источников", placeholder: "Русский и английский", type: "text", required: false }, { id: "format", label: "Формат результата", placeholder: "Отчёт / Презентация / Сводка", type: "text", required: false }], promptTemplate: "Проведи глубокое исследование темы: {{topic}}. Глубина: {{depth}}. Языки: {{language}}. Формат: {{format}}. Используй все доступные инструменты поиска. Структура: 1) Executive Summary, 2) Текущее состояние, 3) Ключевые игроки и тренды, 4) Данные и статистика, 5) Прогнозы экспертов, 6) Риски и вызовы, 7) Выводы и рекомендации. Каждый факт — со ссылкой на источник." }, { id: "research-comparison", name: "Сравнительный анализ", description: "Сравнение продуктов, технологий или подходов", fields: [{ id: "items", label: "Что сравниваем", placeholder: "React vs Vue vs Svelte / AWS vs GCP vs Azure", type: "text", required: true }, { id: "criteria", label: "Критерии сравнения", placeholder: "Цена, производительность, экосистема, learning curve", type: "textarea", required: true }, { id: "context", label: "Контекст использования", placeholder: "Для стартапа с командой 5 человек", type: "text", required: false }], promptTemplate: "Проведи сравнительный анализ: {{items}}. Критерии: {{criteria}}. Контекст: {{context}}. Используй поиск для актуальных данных. Результат: 1) Таблица сравнения по всем критериям, 2) Сильные/слабые стороны каждого, 3) Рекомендация с обоснованием для заданного контекста." }] }, sortOrder: 15, agentId: AGENT_IDS.researcher },
    { id: "tool-research-factcheck", name: "Проверка фактов", description: "Верификация утверждений через множество источников", icon: "ShieldCheck", iconColor: "#06B6D4", config: { prompt: "Проверю достоверность утверждения. Что именно нужно проверить?", templates: [{ id: "factcheck-claim", name: "Fact-check утверждения", description: "Проверка одного конкретного утверждения", fields: [{ id: "claim", label: "Утверждение для проверки", placeholder: "Python — самый популярный язык программирования в 2026", type: "textarea", required: true }, { id: "context", label: "Контекст/Источник", placeholder: "Из статьи на Habr от 01.2026", type: "text", required: false }], promptTemplate: "Проверь достоверность утверждения: «{{claim}}». Контекст: {{context}}. Используй поиск для нахождения подтверждений и опровержений из авторитетных источников. Результат: 1) Вердикт (Правда / Частично правда / Ложь / Не подтверждено), 2) Доказательства ЗА, 3) Доказательства ПРОТИВ, 4) Контекст и нюансы, 5) Источники." }] }, sortOrder: 16, agentId: AGENT_IDS.researcher },
    // ── QA Инженер ──
    { id: "tool-qa-testplan", name: "Тест-план", description: "Составить тест-план для веб-приложения", icon: "ClipboardCheck", iconColor: "#C4857A", config: { prompt: "Составлю тест-план. Укажи URL приложения и что нужно протестировать.", templates: [{ id: "testplan-e2e", name: "E2E тест-план", description: "Полный план end-to-end тестирования", fields: [{ id: "url", label: "URL приложения", placeholder: "https://app.example.com", type: "text", required: true }, { id: "features", label: "Фичи для тестирования", placeholder: "Регистрация, логин, корзина, оплата, профиль", type: "textarea", required: true }, { id: "devices", label: "Устройства", placeholder: "Desktop Chrome, Mobile Safari, Tablet", type: "text", required: false }, { id: "priority", label: "Приоритеты", placeholder: "Критичные пути: регистрация → покупка → оплата", type: "text", required: false }], promptTemplate: "Составь E2E тест-план для {{url}}. Фичи: {{features}}. Устройства: {{devices}}. Приоритеты: {{priority}}. Используй Playwright MCP для проверки доступности страниц. Для каждой фичи: 1) Позитивные сценарии, 2) Негативные сценарии, 3) Edge cases, 4) Accessibility чеки. Формат: ID | Сценарий | Шаги | Ожидаемый результат | Приоритет." }] }, sortOrder: 17, agentId: AGENT_IDS.qa },
    { id: "tool-qa-bugreport", name: "Баг-репорт", description: "Оформить найденный баг с шагами воспроизведения", icon: "AlertTriangle", iconColor: "#C4857A", config: { prompt: "Помогу оформить баг-репорт. Опиши что произошло.", templates: [{ id: "bugreport-standard", name: "Стандартный баг-репорт", description: "Структурированный отчёт о баге для Jira/GitHub Issues", fields: [{ id: "title", label: "Заголовок бага", placeholder: "Кнопка 'Оплатить' не работает на мобильных", type: "text", required: true }, { id: "url", label: "URL страницы", placeholder: "https://app.example.com/checkout", type: "text", required: true }, { id: "steps", label: "Шаги воспроизведения", placeholder: "1. Открыть корзину\n2. Нажать Оформить заказ\n3. Заполнить форму\n4. Нажать Оплатить", type: "textarea", required: true }, { id: "expected", label: "Ожидаемый результат", placeholder: "Переход на страницу оплаты", type: "text", required: true }, { id: "actual", label: "Фактический результат", placeholder: "Ничего не происходит, в консоли TypeError", type: "text", required: true }, { id: "severity", label: "Критичность", placeholder: "Critical / Major / Minor / Trivial", type: "text", required: false }], promptTemplate: "Оформи баг-репорт. Заголовок: {{title}}. URL: {{url}}. Шаги: {{steps}}. Ожидалось: {{expected}}. Фактически: {{actual}}. Критичность: {{severity}}. Используй Playwright MCP чтобы: 1) Воспроизвести баг, 2) Сделать скриншот, 3) Проверить console errors. Оформи в формате: Summary, Environment, Steps, Expected/Actual, Screenshots, Console logs, Severity, Assignee suggestion." }] }, sortOrder: 18, agentId: AGENT_IDS.qa },
    // ── Таможенный брокер ──
    { id: "tool-broker-classify", name: "Классификация товара", description: "Определить код ТН ВЭД ЕАЭС и ставки пошлин", icon: "Package", iconColor: "#06B6D4", config: { prompt: "Помогу классифицировать товар по ТН ВЭД ЕАЭС. Опиши товар подробно.", templates: [{ id: "classify-goods", name: "Классификация товара", description: "Определение кода ТН ВЭД и применимых ставок", fields: [{ id: "goodsDescription", label: "Описание товара", placeholder: "Смартфон Apple iPhone 16 Pro, 256GB, новый", type: "textarea", required: true }, { id: "material", label: "Материал/Состав", placeholder: "Металл, стекло, литий-ионный аккумулятор", type: "text", required: false }, { id: "purpose", label: "Назначение", placeholder: "Для личного использования / коммерческий ввоз", type: "text", required: false }], promptTemplate: "Классифицируй товар по ТН ВЭД ЕАЭС: {{goodsDescription}}. Материал: {{material}}. Назначение: {{purpose}}. Используй classify_goods для определения кода и ставок. Покажи: 1) Код ТН ВЭД (10 знаков), 2) Наименование позиции, 3) Ставка пошлины, 4) НДС, 5) Акциз (если применимо)." }] }, sortOrder: 20, agentId: AGENT_IDS.broker },
    { id: "tool-broker-duties", name: "Расчёт пошлин", description: "Рассчитать таможенные платежи для ввоза товара", icon: "Calculator", iconColor: "#06B6D4", config: { prompt: "Рассчитаю таможенные платежи. Укажи товар, стоимость и страну происхождения.", templates: [{ id: "calc-duties", name: "Расчёт таможенных платежей", description: "Полный расчёт пошлин, НДС и акцизов", fields: [{ id: "goodsDescription", label: "Товар", placeholder: "Автомобиль Toyota Camry 2024, 2.5L бензин", type: "textarea", required: true }, { id: "customsValue", label: "Таможенная стоимость ($)", placeholder: "35000", type: "number", required: true }, { id: "originCountry", label: "Страна происхождения", placeholder: "Япония / Китай / Германия", type: "text", required: true }, { id: "weight", label: "Вес (кг)", placeholder: "1500", type: "number", required: false }], promptTemplate: "Рассчитай таможенные платежи для ввоза в РК. Товар: {{goodsDescription}}. Стоимость: ${{customsValue}}. Страна: {{originCountry}}. Вес: {{weight}} кг. Используй classify_goods и calculate_duties. Покажи: 1) Код ТН ВЭД, 2) Таможенная пошлина, 3) НДС, 4) Акциз, 5) Таможенный сбор, 6) ИТОГО к оплате в тенге." }] }, sortOrder: 21, agentId: AGENT_IDS.broker },
    { id: "tool-broker-declaration", name: "Таможенная декларация", description: "Создать таможенную декларацию (ДТ) ЕАЭС в формате PDF", icon: "FileText", iconColor: "#06B6D4", config: { prompt: "Создам таможенную декларацию ЕАЭС. Укажи данные о декларанте, товаре и условиях поставки.", templates: [{ id: "create-declaration", name: "Декларация на товары (ДТ)", description: "PDF декларации по форме Решения Комиссии ТС №257", fields: [{ id: "declarantName", label: "Декларант", placeholder: 'ТОО "Импорт КЗ", БИН 230440012345', type: "text", required: true }, { id: "goodsDescription", label: "Товар", placeholder: "Электроника, бытовая техника", type: "textarea", required: true }, { id: "originCountry", label: "Страна происхождения", placeholder: "CN — Китай", type: "text", required: true }, { id: "customsValue", label: "Таможенная стоимость ($)", placeholder: "50000", type: "number", required: true }, { id: "deliveryTerms", label: "Условия поставки", placeholder: "CIF Алматы / DAP Достык", type: "text", required: true }], promptTemplate: "Подготовь данные и создай таможенную декларацию (ДТ) ЕАЭС. Декларант: {{declarantName}}. Товар: {{goodsDescription}}. Страна: {{originCountry}}. Стоимость: ${{customsValue}}. Условия: {{deliveryTerms}}. Используй classify_goods для кода ТН ВЭД, calculate_duties для платежей, get_required_docs для списка документов, затем generate_declaration для создания PDF." }] }, sortOrder: 22, agentId: AGENT_IDS.broker },
    // ── Файловый Ассистент ──
    { id: "tool-file-organize", name: "Организация проекта", description: "Создать или реорганизовать файловую структуру проекта", icon: "FileText", iconColor: "#F59E0B", config: { prompt: "Помогу организовать файлы проекта. Опиши тип проекта и текущее состояние.", templates: [{ id: "organize-project", name: "Структура проекта", description: "Оптимальная файловая структура для вашего стека", fields: [{ id: "projectType", label: "Тип проекта", placeholder: "Next.js SaaS / Python ML / React Native app", type: "text", required: true }, { id: "currentState", label: "Текущее состояние", placeholder: "Все файлы в корне / Запутанная структура / Начинаем с нуля", type: "text", required: true }, { id: "features", label: "Основные модули", placeholder: "Auth, Dashboard, API, Tests, Docs", type: "textarea", required: false }], promptTemplate: "Организуй файловую структуру проекта. Тип: {{projectType}}. Состояние: {{currentState}}. Модули: {{features}}. Используй Filesystem MCP чтобы увидеть текущую структуру. Создай: 1) Оптимальное дерево директорий, 2) Описание назначения каждой папки, 3) План перемещения файлов если реорганизация, 4) .gitignore и конфиги. Следуй best practices для данного стека." }] }, sortOrder: 28, agentId: AGENT_IDS.filemanager },
  ];

  for (const t of specializedTools) {
    await upsertToolsWithAgentLink(prisma, [t], t.agentId);
  }

  console.log(`Specialized tools seeded: ${specializedTools.length} tools`);
}
