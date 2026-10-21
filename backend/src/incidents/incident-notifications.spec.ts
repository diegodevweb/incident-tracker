import {
  AttachmentCategory,
  IncidentEventType,
  IncidentLevel,
  IncidentStatus,
  NotificationType,
} from '@prisma/client';
import { incidentUpdateEvents } from './incident-events';
import { noticesForIncidentUpdate } from './incident-notifications';

describe('noticesForIncidentUpdate', () => {
  const current = {
    status: IncidentStatus.OPEN,
    priority: IncidentLevel.ERROR,
    correctiveActions: null as string | null,
  };
  const actorId = 1;
  const print = {
    filename: 'correcao.png',
    category: AttachmentCategory.CORRECTIVE_ACTION,
  };

  it('tells the status change, resolving included, with both statuses', () => {
    expect(
      noticesForIncidentUpdate(
        incidentUpdateEvents({
          current,
          status: IncidentStatus.RESOLVED,
          attachments: [],
          actorId,
        }),
      ),
    ).toEqual([
      {
        type: NotificationType.STATUS_CHANGED,
        metadata: {
          fromStatus: IncidentStatus.OPEN,
          toStatus: IncidentStatus.RESOLVED,
        },
      },
    ]);
  });

  it.each([
    [true, null, NotificationType.N1_CLASSIFIED],
    [false, new Date('2026-10-10T12:00:00Z'), NotificationType.N1_REMOVED],
  ])('tells n1=%s', (n1, n1ClassifiedAt, type) => {
    expect(
      noticesForIncidentUpdate(
        incidentUpdateEvents({
          current: { ...current, n1ClassifiedAt },
          n1,
          attachments: [],
          actorId,
        }),
      ),
    ).toEqual([{ type }]);
  });

  it('tells the priority change with both priorities', () => {
    expect(
      noticesForIncidentUpdate(
        incidentUpdateEvents({
          current,
          priority: IncidentLevel.CRITICAL,
          attachments: [],
          actorId,
        }),
      ),
    ).toEqual([
      {
        type: NotificationType.PRIORITY_CHANGED,
        metadata: {
          fromPriority: IncidentLevel.ERROR,
          toPriority: IncidentLevel.CRITICAL,
        },
      },
    ]);
  });

  it('sends one notice for the solution text and its prints together', () => {
    expect(
      noticesForIncidentUpdate(
        incidentUpdateEvents({
          current,
          correctiveActions: 'Reprocessada a fila',
          attachments: [print, { ...print, filename: 'log.png' }],
          actorId,
        }),
      ),
    ).toEqual([{ type: NotificationType.CORRECTIVE_ACTION_UPDATED }]);
  });

  it('tells prints of the fix sent without text', () => {
    expect(
      noticesForIncidentUpdate(
        incidentUpdateEvents({ current, attachments: [print], actorId }),
      ),
    ).toEqual([{ type: NotificationType.CORRECTIVE_ACTION_UPDATED }]);
  });

  it('does not tell that the solution was erased', () => {
    expect(
      noticesForIncidentUpdate([
        { type: IncidentEventType.CORRECTIVE_ACTION_REMOVED, actorId },
      ]),
    ).toEqual([]);
  });

  it('keeps one notice per kind of change, status first', () => {
    const notices = noticesForIncidentUpdate(
      incidentUpdateEvents({
        current,
        status: IncidentStatus.IN_PROGRESS,
        priority: IncidentLevel.WARNING,
        correctiveActions: 'Ajustado o cadastro',
        attachments: [],
        actorId,
      }),
    );

    expect(notices.map((notice) => notice.type)).toEqual([
      NotificationType.STATUS_CHANGED,
      NotificationType.PRIORITY_CHANGED,
      NotificationType.CORRECTIVE_ACTION_UPDATED,
    ]);
  });
});
