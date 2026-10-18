import { IncidentLevel, IncidentStatus } from '@prisma/client';

/*
 * SLA de primeira resposta, contado em horas úteis: seg. a sex., das 9h às 18h
 * no horário de Brasília, sem os feriados nacionais. O relógio para na
 * primeira mensagem ou mudança de status de um admin (firstRespondedAt).
 */

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;
// Brasília não tem horário de verão desde 2019: UTC-3 o ano inteiro.
const UTC_OFFSET_MINUTES = -3 * 60;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Um dia útil é um expediente inteiro: 9h. */
export const BUSINESS_DAY_MINUTES =
  (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60;

export const FIRST_RESPONSE_TARGET_MINUTES: Record<IncidentLevel, number> = {
  CRITICAL: 2 * 60,
  ERROR: 4 * 60,
  WARNING: BUSINESS_DAY_MINUTES,
  INFO: 2 * BUSINESS_DAY_MINUTES,
};

export const FIRST_RESPONSE_TARGET_LABEL: Record<IncidentLevel, string> = {
  CRITICAL: 'até 2h úteis',
  ERROR: 'até 4h úteis',
  WARNING: 'até 1 dia útil',
  INFO: 'até 2 dias úteis',
};

// Lei 662/1949, Lei 6.802/1980 (12/10) e Lei 14.759/2023 (20/11), em MM-DD.
const FIXED_NATIONAL_HOLIDAYS = new Set([
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '11-20',
  '12-25',
]);

// Os cálculos andam num relógio "local": o instante deslocado para Brasília e
// lido com os métodos UTC do Date.
const toLocal = (date: Date) => date.getTime() + UTC_OFFSET_MINUTES * MINUTE_MS;
const fromLocal = (localMs: number) =>
  new Date(localMs - UTC_OFFSET_MINUTES * MINUTE_MS);
const startOfLocalDay = (localMs: number) =>
  Math.floor(localMs / DAY_MS) * DAY_MS;

const goodFridayByYear = new Map<number, number>();

/** Sexta-feira Santa: dois dias antes da Páscoa (algoritmo de Meeus/Jones/Butcher). */
function goodFriday(year: number) {
  const cached = goodFridayByYear.get(year);

  if (cached !== undefined) {
    return cached;
  }

  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const result = Date.UTC(year, month - 1, day) - 2 * DAY_MS;

  goodFridayByYear.set(year, result);

  return result;
}

function isBusinessDay(dayStart: number) {
  const day = new Date(dayStart);
  const weekday = day.getUTCDay();

  if (weekday === 0 || weekday === 6) {
    return false;
  }

  const monthDay = `${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(
    day.getUTCDate(),
  ).padStart(2, '0')}`;

  return (
    !FIXED_NATIONAL_HOLIDAYS.has(monthDay) &&
    dayStart !== goodFriday(day.getUTCFullYear())
  );
}

/** O instante em que se completam `minutes` minutos úteis a partir de `start`. */
export function addBusinessMinutes(start: Date, minutes: number) {
  // Um prazo inválido faria o laço abaixo nunca terminar.
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`Prazo inválido: ${minutes} minutos`);
  }

  let cursor = toLocal(start);
  let left = minutes;

  for (;;) {
    const dayStart = startOfLocalDay(cursor);
    const close = dayStart + BUSINESS_END_HOUR * HOUR_MS;

    if (isBusinessDay(dayStart) && cursor < close) {
      const from = Math.max(cursor, dayStart + BUSINESS_START_HOUR * HOUR_MS);
      const available = (close - from) / MINUTE_MS;

      if (left <= available) {
        return fromLocal(from + left * MINUTE_MS);
      }

      left -= available;
    }

    cursor = dayStart + DAY_MS;
  }
}

/** Minutos úteis inteiros entre dois instantes; 0 se `to` não vem depois de `from`. */
export function businessMinutesBetween(from: Date, to: Date) {
  const end = toLocal(to);
  let cursor = toLocal(from);
  let total = 0;

  while (cursor < end) {
    const dayStart = startOfLocalDay(cursor);

    if (isBusinessDay(dayStart)) {
      const open = Math.max(cursor, dayStart + BUSINESS_START_HOUR * HOUR_MS);
      const close = Math.min(end, dayStart + BUSINESS_END_HOUR * HOUR_MS);

      if (close > open) {
        total += close - open;
      }
    }

    cursor = dayStart + DAY_MS;
  }

  return Math.floor(total / MINUTE_MS);
}

export function firstResponseDueAt(createdAt: Date, priority: IncidentLevel) {
  return addBusinessMinutes(createdAt, FIRST_RESPONSE_TARGET_MINUTES[priority]);
}

export type FirstResponseSlaState =
  /** Sem resposta, dentro do prazo. */
  | 'ON_TIME'
  /** Sem resposta, com menos de um quarto do prazo sobrando. */
  | 'AT_RISK'
  /** Sem resposta e com o prazo vencido. */
  | 'BREACHED'
  | 'MET'
  | 'MISSED'
  /** Resolvido (pelo cliente) antes de a equipe responder: o relógio parou. */
  | 'CLOSED';

export type FirstResponseSla = {
  state: FirstResponseSlaState;
  /** A criticidade que define o prazo: a da primeira resposta, ou a atual. */
  priority: IncidentLevel;
  target: string;
  dueAt: Date;
  respondedAt: Date | null;
  /** Minutos úteis até o prazo, enquanto o relógio corre. */
  remainingMinutes: number | null;
  /** Minutos úteis além do prazo: até agora (BREACHED) ou até a resposta (MISSED). */
  overdueMinutes: number | null;
  /** Minutos úteis da abertura à primeira resposta. */
  responseMinutes: number | null;
};

export type SlaIncident = {
  createdAt: Date;
  priority: IncidentLevel;
  status: IncidentStatus;
  firstRespondedAt: Date | null;
  responsePriority: IncidentLevel | null;
};

/**
 * O SLA de primeira resposta do chamado agora. Respondido, vale a criticidade
 * gravada na resposta; sem resposta (ou nos chamados respondidos antes de o
 * SLA existir), vale a criticidade atual.
 */
export function firstResponseSla(
  incident: SlaIncident,
  now = new Date(),
): FirstResponseSla {
  const respondedAt = incident.firstRespondedAt;
  const priority =
    (respondedAt && incident.responsePriority) || incident.priority;
  const dueAt = firstResponseDueAt(incident.createdAt, priority);
  const base = {
    priority,
    target: FIRST_RESPONSE_TARGET_LABEL[priority],
    dueAt,
    respondedAt,
    remainingMinutes: null,
    overdueMinutes: null,
    responseMinutes: null,
  };

  if (respondedAt) {
    const missed = respondedAt > dueAt;

    return {
      ...base,
      state: missed ? 'MISSED' : 'MET',
      overdueMinutes: missed
        ? businessMinutesBetween(dueAt, respondedAt)
        : null,
      responseMinutes: businessMinutesBetween(incident.createdAt, respondedAt),
    };
  }

  if (incident.status === IncidentStatus.RESOLVED) {
    return { ...base, state: 'CLOSED' };
  }

  if (now > dueAt) {
    return {
      ...base,
      state: 'BREACHED',
      overdueMinutes: businessMinutesBetween(dueAt, now),
    };
  }

  const remainingMinutes = businessMinutesBetween(now, dueAt);

  return {
    ...base,
    state:
      remainingMinutes * 4 < FIRST_RESPONSE_TARGET_MINUTES[priority]
        ? 'AT_RISK'
        : 'ON_TIME',
    remainingMinutes,
  };
}
