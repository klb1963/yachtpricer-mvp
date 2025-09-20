вижу задачу 👍 нам нужно дать пользователю те же «ручки отклонений», что у Fleetrank: управлять допусками по длине/году/кабинам/санузлам, строгостью совпадения типа и правилами сопоставления локаций. Предлагаю сразу сделать это системно — добавить на фронте поля «Deviations» в нашу модалку и протащить параметры в DTO → скрапер. Ниже даю готовые куски кода (можно вставлять по месту).

⸻

1) Frontend — расширяем форму

1.1. Тип фильтров

// frontend/src/pages/CompetitorFiltersPage.tsx (верх файла)
type LocationMode = 'countryOrSubstring' | 'countryOnly' | 'substring';

export interface CompetitorFilters {
  // базовые
  lengthMin: number;
  lengthMax: number;
  capacity: number;
  type: YachtType;
  yearMin: number;
  yearMax: number;
  region: string[];
  priceRange: number;
  rating: number;

  // ─ deviations (новые поля) ─
  lenTolFt: number;          // допуск по длине, футы (±)
  yearWindow: number;        // окно по году (±)
  cabinsDelta: number;       // допускаемая разница по каютах (±)
  headsMinOffset: number;    // насколько можно быть «беднее» по heads (≥ target - offset)
  typeStrict: boolean;       // требовать точное совпадение типа
  locationMode: LocationMode;// режим сравнения локации
}

1.2. Начальные значения и сеттер

// в useState
const [filters, setFilters] = useState<CompetitorFilters>({
  lengthMin: 35,
  lengthMax: 55,
  capacity: 8,
  type: "Sailing",
  yearMin: 2005,
  yearMax: 2022,
  region: [],
  priceRange: 20,
  rating: 4,

  // defaults, совпадающие с нынешней логикой бэка
  lenTolFt: 3,
  yearWindow: 2,
  cabinsDelta: 1,
  headsMinOffset: 0,
  typeStrict: true,
  locationMode: 'countryOrSubstring',
});

1.3. UI: добавим блок «Deviations»

Внизу формы (перед кнопками) вставьте блок:

<hr className="my-2" />
<h3 className="font-semibold">Deviations</h3>

<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  <label className="flex flex-col">
    Length tolerance (± ft)
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={filters.lenTolFt}
      onChange={(e) => setField("lenTolFt", toInt(e.target.value))}
      className="border rounded p-1"
    />
  </label>

  <label className="flex flex-col">
    Year window (± years)
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={filters.yearWindow}
      onChange={(e) => setField("yearWindow", toInt(e.target.value))}
      className="border rounded p-1"
    />
  </label>

  <label className="flex flex-col">
    Cabins delta (±)
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={filters.cabinsDelta}
      onChange={(e) => setField("cabinsDelta", toInt(e.target.value))}
      className="border rounded p-1"
    />
  </label>

  <label className="flex flex-col">
    Heads min offset
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={filters.headsMinOffset}
      onChange={(e) => setField("headsMinOffset", toInt(e.target.value))}
      className="border rounded p-1"
    />
    <span className="text-xs text-gray-500 mt-1">
      Candidate heads must be ≥ (target heads − offset)
    </span>
  </label>

  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={filters.typeStrict}
      onChange={(e) => setField("typeStrict", e.target.checked)}
    />
    Require exact type match
  </label>

  <label className="flex flex-col">
    Location match
    <select
      value={filters.locationMode}
      onChange={(e) => setField("locationMode", e.target.value as LocationMode)}
      className="border rounded p-1"
    >
      <option value="countryOrSubstring">Same country OR substring</option>
      <option value="countryOnly">Same country only</option>
      <option value="substring">Substring match only</option>
    </select>
  </label>
</div>

1.4. Отдаём значения «наверх» и сохраняем их

В handleSubmit() можно (по желанию) положить фильтры в localStorage, чтобы модалка помнила выбор:

function handleSubmit() {
  try {
    localStorage.setItem('competitorFilters:v1', JSON.stringify(filters));
  } catch {}
  onSubmit ? onSubmit(filters) : console.log('Applied competitor filters:', filters);
}

А в useEffect в начале формы — попробовать прочитать:

// после объявления setFilters
useEffect(() => {
  try {
    const raw = localStorage.getItem('competitorFilters:v1');
    if (raw) setFilters((prev) => ({ ...prev, ...JSON.parse(raw) }));
  } catch {}
}, []);

1.5. Dashboard → передаём параметры в «Scan»

В DashboardPage.tsx при сабмите модалки нужно складывать выбранные dev-параметры в состояние и прокидывать их в startScrape. Пример:

// состояние рядом с isCompFiltersOpen
const [compFilters, setCompFilters] = useState<Partial<CompetitorFilters> | null>(null);

const handleCompetitorFiltersSubmit = (filters: CompetitorFilters) => {
  setCompFilters(filters);
  setCompFiltersOpen(false);
};

// а в handleScan:
const { lenTolFt, yearWindow, cabinsDelta, headsMinOffset, typeStrict, locationMode } = compFilters ?? {};
const { jobId } = await startScrape({
  yachtId: y.id,
  weekStart: week,
  source: 'BOATAROUND',
  // новые поля в DTO:
  lenTolFt,
  yearWindow,
  cabinsDelta,
  headsMinOffset,
  typeStrict,
  locationMode,
});


⸻

2) Backend — добавляем поля в DTO и применяем в фильтрах

2.1. DTO

// backend/src/scraper/scraper.dto.ts
import { IsEnum, IsNumber, IsOptional, IsBoolean, IsString } from 'class-validator';

export class StartScrapeDto {
  @IsOptional() @IsString() yachtId?: string;
  @IsOptional() @IsString() weekStart?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() minYear?: number;
  @IsOptional() @IsNumber() maxYear?: number;
  @IsOptional() @IsNumber() minLength?: number; // feet
  @IsOptional() @IsNumber() maxLength?: number; // feet
  @IsOptional() @IsNumber() people?: number;
  @IsOptional() @IsNumber() cabins?: number;
  @IsOptional() @IsNumber() heads?: number;
  @IsOptional() @IsString() source?: 'BOATAROUND';

  // ─ deviations (новые) ─
  @IsOptional() @IsNumber() lenTolFt?: number;
  @IsOptional() @IsNumber() yearWindow?: number;
  @IsOptional() @IsNumber() cabinsDelta?: number;
  @IsOptional() @IsNumber() headsMinOffset?: number;
  @IsOptional() @IsBoolean() typeStrict?: boolean;
  @IsOptional() @IsString() locationMode?: 'countryOrSubstring' | 'countryOnly' | 'substring';
}

И не забудьте расширить dtoToJson():

function dtoToJson(dto: StartScrapeDto): Prisma.InputJsonObject {
  return {
    // ... существующие
    lenTolFt: dto.lenTolFt ?? null,
    yearWindow: dto.yearWindow ?? null,
    cabinsDelta: dto.cabinsDelta ?? null,
    headsMinOffset: dto.headsMinOffset ?? null,
    typeStrict: dto.typeStrict ?? null,
    locationMode: dto.locationMode ?? null,
  };
}

2.2. Правила в passesBusinessFilters

Заменяем жёстко зашитые допуски на «значение из DTO или дефолт»:

function passesBusinessFilters(
  candidate: CandidateLite & { competitorYacht?: string },
  ctx: {
    targetLenFt?: number | null;
    dto: StartScrapeDto;
    targetType?: string | null;
    targetCabins?: number | null;
    targetHeads?: number | null;
    targetYear?: number | null;
    targetLocation?: string | null;
    jobId?: string | null;
  },
) {
  const { dto } = ctx;
  const name = candidate.competitorYacht ?? 'unknown';
  const reasons: string[] = [];

  // 0) вычислим допуски
  const lenTol = typeof dto.lenTolFt === 'number'
    ? Math.max(0, dto.lenTolFt)
    : lengthFtTolerance(ctx.targetLenFt ?? undefined);

  const yearWin = typeof dto.yearWindow === 'number' ? Math.max(0, dto.yearWindow) : 2;
  const cabDelta = typeof dto.cabinsDelta === 'number' ? Math.max(0, dto.cabinsDelta) : 1;
  const headsOff = typeof dto.headsMinOffset === 'number' ? Math.max(0, dto.headsMinOffset) : 0;
  const typeStrict = dto.typeStrict ?? true;
  const locationMode = dto.locationMode ?? 'countryOrSubstring';

  // 1) Тип корпуса — в зависимости от флага
  if (typeStrict && ctx.targetType) {
    const ct = norm(candidate.type);
    const tt = norm(ctx.targetType);
    if (!ct || ct !== tt) reasons.push(`type mismatch: cand=${ct ?? '∅'} target=${tt}`);
  }

  // 2) Длина с допуском
  if (typeof ctx.targetLenFt === 'number' && candidate.lengthFt != null) {
    if (candidate.lengthFt < ctx.targetLenFt - lenTol ||
        candidate.lengthFt > ctx.targetLenFt + lenTol) {
      reasons.push(`length ${candidate.lengthFt}ft ∉ [${(ctx.targetLenFt - lenTol).toFixed(1)}; ${(ctx.targetLenFt + lenTol).toFixed(1)}]`);
    }
  }

  // 3) Кабины: |cand - target| ≤ cabDelta
  if (typeof ctx.targetCabins === 'number' && candidate.cabins != null) {
    if (Math.abs(candidate.cabins - ctx.targetCabins) > cabDelta) {
      reasons.push(`cabins ${candidate.cabins} vs target ${ctx.targetCabins} (±${cabDelta})`);
    }
  }

  // 4) Санузлы: cand.heads ≥ targetHeads - headsOff
  if (typeof ctx.targetHeads === 'number' && candidate.heads != null) {
    if (candidate.heads < ctx.targetHeads - headsOff) {
      reasons.push(`heads ${candidate.heads} < targetMin ${ctx.targetHeads - headsOff}`);
    }
  }

  // 5) Год: |cand - target| ≤ yearWin
  if (typeof ctx.targetYear === 'number' && candidate.year != null) {
    if (Math.abs(candidate.year - ctx.targetYear) > yearWin) {
      reasons.push(`year ${candidate.year} not in ±${yearWin} of ${ctx.targetYear}`);
    }
  }

  // 6) Локация по режиму
  const applyLocation = (cand?: string | null, targ?: string | null) => {
    const candStr = norm(cand);
    const targStr = norm(targ);
    const candCountry = guessCountry(candStr);
    const targCountry = guessCountry(targStr);

    if (locationMode === 'countryOnly') {
      return !!candCountry && !!targCountry && candCountry === targCountry;
    }
    if (locationMode === 'substring') {
      return !!candStr && !!targStr && candStr.includes(targStr);
    }
    // 'countryOrSubstring'
    const sameCountry =
      candCountry && targCountry ? candCountry === targCountry : false;
    const substringOk = targStr && candStr ? candStr.includes(targStr) : false;
    return sameCountry || substringOk;
  };

  if (ctx.targetLocation && !applyLocation(candidate.marina, ctx.targetLocation)) {
    reasons.push(`location "${candidate.marina}" !~ "${ctx.targetLocation}" [mode=${locationMode}]`);
  }

  // 7) Жёсткие ограничения из dto (как и прежде)
  // ... (оставляем ваш существующий блок проверок dto.* без изменений)

  if (reasons.length) {
    filterLog.log(`[${ctx.jobId ?? '-'}] DROP "${name}": ${reasons.join(' | ')}`);
    return false;
  }
  filterLog.log(`[${ctx.jobId ?? '-'}] KEEP "${name}"`);
  return true;
}

Цена/рейтинг (из формы) пока пропускаем в пайплайн: их можно учесть либо как пост-фильтрацию сырых предложений (price внутри ± priceRange% от целевой базовой цены), либо как дополнительную метку в snapshot. Если нужно — добавлю сразу.

⸻

3) Что получится для пользователя
	•	В модалке «Competitor filters» появится секция Deviations — менеджер сам задаёт «ширину окна» по ключевым атрибутам и правила сравнения локации/типа.
	•	Эти настройки (по умолчанию равные текущей жёсткой логике) сохраняются в LocalStorage и применяются при каждом Scan.
	•	Бэкенд использует переданные допуски, никаких «магических» констант внутри фильтра больше нет.

Если хочешь — могу сразу добавить priceRangePct в фильтрацию (например, оставлять только те карточки, чья цена в пределах ±filters.priceRange% от target.basePrice).