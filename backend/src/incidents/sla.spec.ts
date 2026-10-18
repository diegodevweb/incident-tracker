import { IncidentLevel, IncidentStatus } from '@prisma/client';
import {
  addBusinessMinutes,
  businessMinutesBetween,
  firstResponseDueAt,
  firstResponseSla,
  type SlaIncident,
} from './sla';

// Horário de Brasília (UTC-3), para os casos lerem como o expediente.
const brt = (local: string) => new Date(`${local}:00-03:00`);

describe('first response SLA', () => {
  describe('addBusinessMinutes', () => {
    it.each([
      ['within the same day', '2026-10-15T10:00', 120, '2026-10-15T12:00'],
      ['into the next day', '2026-10-15T17:00', 240, '2026-10-16T12:00'],
      ['from Friday into Monday', '2026-10-16T17:00', 120, '2026-10-19T10:00'],
      ['from a Saturday', '2026-10-17T10:00', 120, '2026-10-19T11:00'],
      [
        'from before opening hours',
        '2026-10-14T06:00',
        120,
        '2026-10-14T11:00',
      ],
      ['from after closing hours', '2026-10-14T19:30', 120, '2026-10-15T11:00'],
      // 23h em Brasília já é o dia seguinte em UTC: o dia que vale é o local.
      ['from late night', '2026-10-14T23:00', 120, '2026-10-15T11:00'],
      ['up to closing time', '2026-10-14T09:00', 540, '2026-10-14T18:00'],
      ['over two business days', '2026-10-14T09:00', 1080, '2026-10-15T18:00'],
    ])('counts %s', (_case, start, minutes, due) => {
      expect(addBusinessMinutes(brt(start), minutes)).toEqual(brt(due));
    });

    it.each([
      // Domingo, e segunda 12/10 é Nossa Senhora Aparecida.
      ['a fixed holiday', '2026-10-11T10:00', 120, '2026-10-13T11:00'],
      ['Black Consciousness Day', '2026-11-19T17:00', 120, '2026-11-23T10:00'],
      // Sexta-feira Santa: 3/4/2026 e 26/3/2027.
      ['Good Friday', '2026-04-02T17:00', 240, '2026-04-06T12:00'],
      [
        'Good Friday of another year',
        '2027-03-25T17:30',
        120,
        '2027-03-29T10:30',
      ],
      ['Christmas and New Year', '2026-12-24T17:00', 540, '2026-12-28T17:00'],
    ])('skips %s', (_case, start, minutes, due) => {
      expect(addBusinessMinutes(brt(start), minutes)).toEqual(brt(due));
    });

    it('counts Carnival and Corpus Christi as business days', () => {
      // Carnaval 8-9/2/2027 e Corpus Christi 4/6/2026 são ponto facultativo.
      expect(addBusinessMinutes(brt('2027-02-08T17:00'), 120)).toEqual(
        brt('2027-02-09T10:00'),
      );
      expect(addBusinessMinutes(brt('2026-06-03T17:00'), 120)).toEqual(
        brt('2026-06-04T10:00'),
      );
    });

    it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
      'rejects %s minutes instead of looping forever',
      (minutes) => {
        expect(() => addBusinessMinutes(new Date(), minutes)).toThrow(
          RangeError,
        );
      },
    );
  });

  describe('businessMinutesBetween', () => {
    it.each([
      ['the same day', '2026-10-15T10:00', '2026-10-15T11:30', 90],
      ['over a weekend', '2026-10-16T17:00', '2026-10-19T10:00', 120],
      ['outside business hours', '2026-10-15T18:30', '2026-10-16T07:00', 0],
      ['a whole week', '2026-10-19T08:00', '2026-10-23T18:00', 2700],
      ['a reversed range', '2026-10-15T11:00', '2026-10-15T10:00', 0],
    ])('counts %s', (_case, from, to, minutes) => {
      expect(businessMinutesBetween(brt(from), brt(to))).toBe(minutes);
    });
  });

  describe('firstResponseDueAt', () => {
    it.each([
      [IncidentLevel.CRITICAL, '2026-10-15T12:00'],
      [IncidentLevel.ERROR, '2026-10-15T14:00'],
      [IncidentLevel.WARNING, '2026-10-16T10:00'],
      [IncidentLevel.INFO, '2026-10-19T10:00'],
    ])('gives %s its target', (priority, due) => {
      expect(firstResponseDueAt(brt('2026-10-15T10:00'), priority)).toEqual(
        brt(due),
      );
    });
  });

  describe('firstResponseSla', () => {
    // Crítico aberto às 10h de quinta: vence às 12h.
    const incident = (overrides: Partial<SlaIncident> = {}): SlaIncident => ({
      createdAt: brt('2026-10-15T10:00'),
      priority: IncidentLevel.CRITICAL,
      status: IncidentStatus.OPEN,
      firstRespondedAt: null,
      responsePriority: null,
      ...overrides,
    });

    it('is on time while most of the target is left', () => {
      expect(firstResponseSla(incident(), brt('2026-10-15T11:00'))).toEqual({
        state: 'ON_TIME',
        priority: IncidentLevel.CRITICAL,
        target: 'até 2h úteis',
        dueAt: brt('2026-10-15T12:00'),
        respondedAt: null,
        remainingMinutes: 60,
        overdueMinutes: null,
        responseMinutes: null,
      });
    });

    it('is at risk with less than a quarter of the target left', () => {
      expect(
        firstResponseSla(incident(), brt('2026-10-15T11:31')),
      ).toMatchObject({ state: 'AT_RISK', remainingMinutes: 29 });
    });

    it('is breached past the due time, counting business minutes late', () => {
      // Das 12h de quinta às 10h de sexta: 7h úteis.
      expect(
        firstResponseSla(incident(), brt('2026-10-16T10:00')),
      ).toMatchObject({
        state: 'BREACHED',
        remainingMinutes: null,
        overdueMinutes: 420,
      });
    });

    it('is met when the team answered before the due time', () => {
      expect(
        firstResponseSla(
          incident({
            firstRespondedAt: brt('2026-10-15T10:45'),
            responsePriority: IncidentLevel.CRITICAL,
          }),
          brt('2026-10-20T10:00'),
        ),
      ).toMatchObject({
        state: 'MET',
        respondedAt: brt('2026-10-15T10:45'),
        responseMinutes: 45,
        overdueMinutes: null,
      });
    });

    it('is missed when the team answered after the due time', () => {
      expect(
        firstResponseSla(
          incident({
            firstRespondedAt: brt('2026-10-15T13:10'),
            responsePriority: IncidentLevel.CRITICAL,
          }),
        ),
      ).toMatchObject({
        state: 'MISSED',
        overdueMinutes: 70,
        responseMinutes: 190,
      });
    });

    it('keeps the priority of the first response when it changes later', () => {
      // Respondido em 3h como Alta (4h), depois elevado a Crítica (2h).
      expect(
        firstResponseSla(
          incident({
            priority: IncidentLevel.CRITICAL,
            firstRespondedAt: brt('2026-10-15T13:00'),
            responsePriority: IncidentLevel.ERROR,
          }),
        ),
      ).toMatchObject({
        state: 'MET',
        priority: IncidentLevel.ERROR,
        target: 'até 4h úteis',
        dueAt: brt('2026-10-15T14:00'),
      });
    });

    it('follows the current priority while there is no answer', () => {
      expect(
        firstResponseSla(
          incident({ priority: IncidentLevel.INFO }),
          brt('2026-10-15T11:00'),
        ),
      ).toMatchObject({
        state: 'ON_TIME',
        priority: IncidentLevel.INFO,
        dueAt: brt('2026-10-19T10:00'),
      });
    });

    it('uses the current priority for answers recorded before the SLA', () => {
      expect(
        firstResponseSla(
          incident({ firstRespondedAt: brt('2026-10-15T11:00') }),
        ),
      ).toMatchObject({ state: 'MET', priority: IncidentLevel.CRITICAL });
    });

    it('stops the clock when the client resolves before any answer', () => {
      expect(
        firstResponseSla(
          incident({ status: IncidentStatus.RESOLVED }),
          brt('2026-10-20T10:00'),
        ),
      ).toMatchObject({
        state: 'CLOSED',
        remainingMinutes: null,
        overdueMinutes: null,
      });
    });
  });
});
