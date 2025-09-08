# Матрицы прав, переходы статусов, и минимальные правки в схеме/Guard’ах и UI.

Документ описывает модель ролей и прав YachtPricer, переходы статусов в workflow, а также расширения для мультитенантности и биллинга.

---

## 🎭 Роли и режимы владельца

**Роли:**
- `ADMIN`
- `FLEET_MANAGER`
- `OWNER`
- `MANAGER`

**OwnerMode:**
- `ACTIVE` — владелец может Approve / Reject по своим яхтам.
- `VIEW_ONLY` — видит свои яхты (цены, историю), без действий.
- `HIDDEN` — не имеет доступа к ценам/истории по своим яхтам.

---

## ✅ Матрица прав (с учётом OwnerMode)

| Действие / Статус              | MANAGER (своя яхта) | FLEET_MANAGER | OWNER (ACTIVE) | OWNER (VIEW_ONLY) | OWNER (HIDDEN) | ADMIN |
|--------------------------------|---------------------|---------------|----------------|-------------------|----------------|-------|
| Просмотр карточки «яхта×неделя» | ✅                  | ✅            | ✅             | ✅                | ❌             | ✅    |
| Просмотр истории (audit)       | ✅ (свои)           | ✅ (все)      | ✅ (свои)      | ✅ (свои)         | ❌             | ✅    |
| Редактировать DRAFT            | ✅                  | ✅            | 🔸 (обычно ❌) | ❌                | ❌             | ✅    |
| Submit из DRAFT/REJECTED       | ✅                  | ✅            | ❌             | ❌                | ❌             | ✅    |
| Approve в SUBMITTED            | ❌                  | ✅            | ✅             | ❌                | ❌             | ✅    |
| Reject в SUBMITTED             | ❌                  | ✅            | ✅             | ❌                | ❌             | ✅    |

🔸 — по умолчанию владелец не редактирует; можно включить `allowEdit`, но это вне стандартного сценария.

---

## 🔄 Переходы статусов (state machine)

Разрешённые переходы и инициаторы:

- `DRAFT → SUBMITTED` — Manager, Fleet Manager, Admin
- `SUBMITTED → APPROVED` — Fleet Manager, Owner(ACTIVE), Admin
- `SUBMITTED → REJECTED` — Fleet Manager, Owner(ACTIVE), Admin (комментарий обязателен)
- `REJECTED → SUBMITTED` — Manager, Fleet Manager, Admin

Любые другие переходы запрещены.

---

## 🗄 Prisma: enum и связи

```prisma
enum OwnerMode {
  ACTIVE
  VIEW_ONLY
  HIDDEN
}

model OwnerYacht {
  id        String    @id @default(cuid())
  ownerId   String
  yachtId   String
  owner     User      @relation(fields: [ownerId], references: [id])
  yacht     Yacht     @relation(fields: [yachtId], references: [id])
  mode      OwnerMode @default(VIEW_ONLY)
  allowEdit Boolean   @default(false)

  @@unique([ownerId, yachtId])
}

🛡 Проверки доступа (helpers)
⸻

type AccessCtx = {
  isManagerOfYacht: boolean;
  isOwnerOfYacht: boolean;
  ownerMode?: 'ACTIVE' | 'VIEW_ONLY' | 'HIDDEN';
};

export function canView(user: User, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER') return ctx.isManagerOfYacht;
  if (user.role === 'OWNER' && ctx.isOwnerOfYacht) return ctx.ownerMode !== 'HIDDEN';
  return false;
}

export function canSeeAudit(user: User, ctx: AccessCtx) {
  return canView(user, ctx);
}

export function canEditDraft(user: User, price: WeekPrice, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER' && ctx.isManagerOfYacht && price.status === 'DRAFT') return true;
  return false;
}

export function canSubmit(user: User, price: WeekPrice, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'MANAGER' && ctx.isManagerOfYacht && ['DRAFT','REJECTED'].includes(price.status)) return true;
  return false;
}

export function canApproveOrReject(user: User, price: WeekPrice, ctx: AccessCtx) {
  if (['ADMIN','FLEET_MANAGER'].includes(user.role)) return true;
  if (user.role === 'OWNER' && ctx.isOwnerOfYacht && ctx.ownerMode === 'ACTIVE' && price.status === 'SUBMITTED') return true;
  return false;
}

⸻

🖥 UI/UX: условия отображения
	•	Карточка «яхта×неделя»:
	•	Показывать карточку, если canView(user, ctx) === true.
	•	Блок истории (audit): отображать, если canSeeAudit(...).
	•	Кнопки:
	•	Submit (из DRAFT/REJECTED) — если canSubmit(...).
	•	Approve/Reject (в SUBMITTED) — если canApproveOrReject(...).
Reject требует обязательный комментарий.
	•	Owner(HIDDEN):
	•	Не видит список яхт, карточек и истории — UI даже не грузит данные.
	•	Owner(VIEW_ONLY):
	•	Видит статусы и историю, без кнопок.

⸻

🔧 API: валидация действий (коротко)
	•	В хэндлерах submit/approve/reject делать:
	1.	загрузку WeekPrice + связей,
	2.	сбор accessCtx (из Guard),
	3.	проверку соответствующей функции can*,
	4.	валидацию статуса источника/назначения,
	5.	запись в PriceAuditLog.

(Твои текущие методы из прошлой версии подходят — логика can* уже учитывает HIDDEN.)

⸻

✅ Чек-лист внедрения
	1.	Обновить OwnerMode в schema.prisma → prisma migrate.
	2.	Дополнить Guard: в req.accessCtx.ownerMode класть ownerLink?.mode.
	3.	Применить обновлённые can*-хелперы в контроллерах.
	4.	На фронте: условный рендер по canView/canSubmit/canApproveOrReject; для HIDDEN — не запрашивать данные из API.
	5.	В админке Owners: переключатель OwnerMode = ACTIVE / VIEW_ONLY / HIDDEN.

Если нужно — подготовлю diff-патч для твоего репо (NestJS + React) с минимальными правками по файлам.

Для мультитенантности (несколько чартерных компаний) + оплаты за доступ я предлагаю такую схему — коротко и по делу.

1) Мультитенантность (orgs/tenants)

Модель данных (Prisma — доп. сущности)

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique   // для subdomain: acme.yachtpricer.app
  owners      OrganizationMember[]
  members     OrganizationMember[]
  yachts      Yacht[]
  credentials ProviderCredential[] // NauSYS/BookingManager логины per org
  subscription Subscription?
  createdAt   DateTime @default(now())
}

model OrganizationMember {
  id        String   @id @default(cuid())
  orgId     String
  userId    String
  role      Role      // ADMIN, FLEET_MANAGER, OWNER, MANAGER (в контексте org)
  user      User      @relation(fields: [userId], references: [id])
  org       Organization @relation(fields: [orgId], references: [id])

  @@unique([orgId, userId])
}

model Yacht {
  // + добавляем orgId:
  orgId   String
  org     Organization @relation(fields: [orgId], references: [id])
  // остальное без изменений
}

model OwnerYacht {
  // + тоже подвязываем к org, чтобы не «мигрировали» между организациями
  orgId   String
  org     Organization @relation(fields: [orgId], references: [id])
  // ...
}

model ProviderCredential {
  id      String   @id @default(cuid())
  orgId   String
  type    String   // "NAUSYS" | "BOOKING_MANAGER"
  data    Json     // токены/логины (зашифрованно на уровне приложения)
  org     Organization @relation(fields: [orgId], references: [id])

  @@unique([orgId, type])
}

API-скоуп
	•	Каждый запрос идёт с контекстом orgId (из субдомена или из селектора в UI).
	•	Все выборки — с обязательным where: { orgId }.
	•	Авторизация: пользователь должен быть member этой org и иметь нужную роль.
	•	Удобно добавить Prisma middleware, который автоматически проставляет/фильтрует orgId по списку моделей.

UI
	•	Org switcher в шапке (как в Slack/Linear).
	•	Поддержка subdomain per org: acme.sandbox.leonidk.de → извлекаем slug.

⸻

2) Биллинг и доступ

Stripe (рекомендовано)
	•	Customer = Organization.
	•	Product/Price:
	•	План по tier’ам (например: Starter/Pro/Enterprise).
	•	Биллинг за:
	•	Seats (кол-во активных OrganizationMember с ролью не ниже MANAGER)
	•	Лимиты (яхты, активные недели, запросы к API/скраперу)
	•	Usage-based опционально: метрики scrapes/API calls сохраняем и репортим в Stripe (metered billing).

Таблицы состояний

model Subscription {
  id            String   @id @default(cuid())
  orgId         String   @unique
  stripeSubId   String?  @unique
  plan          String   // STARTER | PRO | ENTERPRISE
  status        String   // active | past_due | canceled | trialing | unpaid
  currentPeriodEnd DateTime?
  seatsAllowed  Int?
  yachtsAllowed Int?
  // и/или feature-флаги
  org           Organization @relation(fields: [orgId], references: [id])
}

model UsageEvent {
  id        String   @id @default(cuid())
  orgId     String
  type      String   // "SCRAPE_CALL" | "API_REQUEST"
  qty       Int      @default(1)
  at        DateTime @default(now())
  org       Organization @relation(fields: [orgId], references: [id])

  @@index([orgId, type, at])
}

Логика доступа по подписке
	•	Before action (скрапинг, создание новой яхты, добавление членов): проверяем лимиты из Subscription.
	•	Grace period: при past_due — предупреждения в UI + мягкие ограничения; при unpaid/canceled — «read-only» или полный lock (конфигурируемо).
	•	Owner(HIDDEN) не влияет на расчёт seats; VIEW_ONLY можно не считать в платные места (решение продукта).
	•	Billing hooks:
	•	При покупке/изменении плана: Stripe Checkout → webhook checkout.session.completed → создаём/обновляем Subscription.
	•	invoice.paid/failed, customer.subscription.updated → обновляем status, currentPeriodEnd, лимиты.

Платёжные документы
	•	Показываем Invoice history (ссылки на Stripe-hosted invoices).
	•	Для VAT: храним реквизиты в Organization (страна, VATIN), пробрасываем в Stripe Customer Tax.

⸻

3) Учёт прав: роли + подписка + tenancy
	•	RBAC уже есть (Role на уровне OrganizationMember).
	•	ABAC добавляется через проверки: orgId match + subscription status + лимиты.
	•	На бэке делаем Policy слой:
	•	requireMembership(orgId)
	•	requireRole(orgId, minRole)
	•	requireFeature(orgId, featureKey)
	•	checkLimit(orgId, 'yachts')

⸻

4) Интеграции провайдеров per org
	•	ProviderCredential хранит NauSYS/BookingManager ключи на org.
	•	Скрэперы/адаптеры читают конкретные учётные данные по orgId.
	•	Ротация ключей и healthchecks — фоном по org.

⸻

5) Безопасность и изоляция
	•	Soft: обязательный orgId во всех запросах + middleware.
	•	Hard (по желанию): Postgres RLS (Row Level Security) по orgId.
	•	Секреты: шифрование ProviderCredential.data (например, AES-GCM, ключ в KMS/ENV).
	•	Логи: все административные изменения (план/лимиты/ролей) — в audit.

⸻

6) Быстрый план внедрения
	1.	Миграции: добавить Organization, OrganizationMember, Subscription, ProviderCredential, UsageEvent; добавить orgId в Yacht, OwnerYacht, WeekPrice, PriceAuditLog.
	2.	Аутентификация: в Clerk включить organizations (или своя таблица + UI).
	3.	Org context: парсим субдомен/селектор → кладём orgId в req.orgId.
	4.	Prisma middleware: авто-скоуп по orgId + валидации.
	5.	Stripe: Checkout/Portal ссылки, вебхуки, обновление Subscription.
	6.	Лимиты: хук перед критич. действиями (создать яхту, запустить скрапер).
	7.	UI: org-switcher, страница Billing (план, seats, usage, кнопка «Manage in Stripe»).
	8.	Оплаты → доступ: обработка статусов active/past_due/unpaid, баннеры и блокировки.
	9.	Мониторинг: ежесуточный job по Usage/лимитам + email/Slack оповещения.

⸻

Минимальные решения по тарифам (пример)
	•	Starter: до 10 яхт, 3 менеджера, 500 скрап-запросов/мес, Owner VIEW_ONLY.
	•	Pro: до 50 яхт, 10 менеджеров, 5k скрап-запросов/мес, Owner ACTIVE, интеграции.
	•	Enterprise: кастомные лимиты, SSO, приоритетная поддержка.

