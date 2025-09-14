План отличный 💪 Давай сразу оформлю его в стройную дорожную карту, чтобы вы с Лидой могли “разыгрывать” процесс вживую.

Что доделать (и как)

1) Статусы по кнопкам (Submit/Approve/Reject)

Бэкенд
	•	Оставляем единый эндпоинт (как сейчас): POST /api/pricing/status
Тело: { yachtId, week, status: 'SUBMITTED'|'APPROVED'|'REJECTED', comment?: string }
	•	RBAC уже есть в PricingService.changeStatus — добавим туда приём comment и запись в журнал (см. п.3).
	•	Возвращаем обновлённую строку решения + актуальные perms.

Фронт
	•	Кнопки уже есть. Добавляем в обработчик:
	•	Перед APPROVED/REJECTED и по желанию при SUBMITTED открывать модалку комментария (см. п.2).
	•	После await changeStatus(...) делать оптимистичное обновление строки (как сейчас), либо рефетч одной строки (если будет /rows/:id — не обяз.)

2) Окно комментария (модалка)
	•	Реализуем единый компонент DecisionCommentModal:
	•	Поля: textarea, счётчик символов, кнопки OK/Cancel.
	•	Валидация: обязательно при REJECTED, необязательно при SUBMITTED/APPROVED.
	•	Проброс onConfirm(comment: string) в родителя — он вызывает changeStatus(..., { comment }).

UI-детали:
	•	Лёгкая подсветка действия (синяя — Submit, зелёная — Approve, красная — Reject).
	•	Disable Primary, если comment пустой и status==='REJECTED'.

3) Сохранение комментариев + аудит

Чтобы не терять контекст решений и обсуждений — вводим историю.

Схема (Prisma)

model PricingDecision {
  yachtId     String
  weekStart   DateTime
  // ... существующие поля ...
  status      DecisionStatus   @default(DRAFT)
  submittedById String?        @db.Uuid
  approvedById  String?        @db.Uuid
  rejectedById  String?        @db.Uuid
  approvedAt    DateTime?
  // связь с аудиторией:
  comments    PricingDecisionComment[]

  @@id([yachtId, weekStart])
}

model PricingDecisionComment {
  id          String            @id @default(uuid())
  yachtId     String
  weekStart   DateTime
  authorId    String            @db.Uuid
  action      DecisionAction    // 'SUBMIT' | 'APPROVE' | 'REJECT' | 'COMMENT'
  message     String
  createdAt   DateTime          @default(now())

  decision    PricingDecision   @relation(fields: [yachtId, weekStart], references: [yachtId, weekStart], onDelete: Cascade)

  @@index([yachtId, weekStart])
}

enum DecisionAction {
  SUBMIT
  APPROVE
  REJECT
  COMMENT
}

Бэкенд
	•	В changeStatus() после смены статуса:
	•	Записывать submittedById/approvedById/rejectedById и approvedAt где уместно.
	•	Добавлять запись в PricingDecisionComment с action и message (если пусто при SUBMIT/APPROVE — сохранять только action без message, или message = ‘’).
	•	(Опционально) В upsertDecision() — добавить эндпоинт для “просто комментария” без смены статуса:
POST /api/pricing/comment { yachtId, week, message } → action: 'COMMENT'.

Фронт
	•	После changeStatus(...) получаем обновлённую строку и перерисовываем.
	•	В карточке/строке показывать иконку “speech bubble” → раскрытие истории.

4) Сохранение финального решения
	•	Уже сохраняем discountPct/finalPrice через upsertDecision.
	•	Добавим правило: при APPROVED фиксируем финалку:
	•	На бэке: если статус меняется на APPROVED, то запретить дальнейший upsertDecision (RBAC canEditDraft уже почти всё делает; можно жестко заблокировать апдейты для non-draft).
	•	(Опционально) При APPROVED писать в PriceHistory/PriceAuditLog (если таблица есть).

5) Что ещё важно учесть
	•	Пермишены в rows: добавить perms.canEditDraft (чтобы поля ввода были неактивны, если нельзя править).
	•	Блокировки переходов: сейчас контролируем через canSubmit/canApproveOrReject. Зафиксируй жёсткую матрицу:
	•	DRAFT -> SUBMITTED (Submit)
	•	SUBMITTED -> APPROVED (Approve)
	•	SUBMITTED -> REJECTED (Reject)
	•	REJECTED -> SUBMITTED (повторная отправка)
	•	Остальное — 400/409.
	•	Разные org: уже учтено в AccessCtxService. Не забываем про аварийные полномочия Admin/Fleet.
	•	Тексты ошибок: фронт уже показывает “Недостаточно прав” по 403; добавь тост “Нельзя поменять статус из текущего” по 409/400.
	•	Тесты сценариев (минимум):
	1.	MANAGER редактирует и Submit → FLEET_MANAGER/ADMIN видит Approve/Reject.
	2.	FLEET_MANAGER делает Reject с обязательным комментом → MANAGER снова видит Submit.
	3.	FLEET_MANAGER делает Approve → MANAGER не может редактировать, поля disabled, кнопки скрыты.
	4.	Разные org → кнопки скрыты у фронта и 403 у бэка.
	5.	ADMIN “аварийно” может всё на любом объекте.
	•	История (UI): компактный список под строкой или модалка “History”:
	•	2025-09-14 19:05 — Leonid (MANAGER): SUBMIT
	•	2025-09-14 19:12 — Bob (FLEET_MANAGER): REJECT — "слишком дёшево"
	•	…

⸻

Хочешь — я сразу накину:
	•	миграцию Prisma под PricingDecisionComment,
	•	патчи в PricingService.changeStatus() (создание комментария, фиксация полей submittedById/approvedById/...),
	•	фронтовую модалку комментария и показ истории в PricingPage.

Скажи — двигаем миграцию/бэкенд первым шагом и затем фронт?