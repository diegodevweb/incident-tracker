import {
  AttachmentCategory,
  IncidentEventType,
  IncidentLevel,
  IncidentStatus,
  UserRole,
} from '@prisma/client';
import { incidentUpdateEvents, toPublicIncidentEvent } from './incident-events';

describe('incidentUpdateEvents', () => {
  const current = {
    status: IncidentStatus.OPEN,
    priority: IncidentLevel.ERROR,
    correctiveActions: null as string | null,
  };
  const actorId = 7;

  it('records nothing when nothing changes', () => {
    expect(
      incidentUpdateEvents({
        current,
        status: IncidentStatus.OPEN,
        priority: IncidentLevel.ERROR,
        correctiveActions: null,
        attachments: [],
        actorId,
      }),
    ).toEqual([]);
  });

  it('records nothing for fields that were not sent', () => {
    expect(
      incidentUpdateEvents({
        current: { ...current, correctiveActions: 'Reprocessado' },
        attachments: [],
        actorId,
      }),
    ).toEqual([]);
  });

  it.each([
    [true, null, IncidentEventType.N1_CLASSIFIED],
    [false, new Date('2026-10-10T12:00:00Z'), IncidentEventType.N1_REMOVED],
  ])('records n1=%s as its own event', (n1, n1ClassifiedAt, type) => {
    expect(
      incidentUpdateEvents({
        current: { ...current, n1ClassifiedAt },
        n1,
        attachments: [],
        actorId,
      }),
    ).toEqual([{ type, actorId }]);
  });

  it('records nothing when the N1 classification stays the same', () => {
    expect(
      incidentUpdateEvents({
        current: { ...current, n1ClassifiedAt: null },
        n1: false,
        attachments: [],
        actorId,
      }),
    ).toEqual([]);
  });

  it('records a status change with the previous and the new status', () => {
    expect(
      incidentUpdateEvents({
        current,
        status: IncidentStatus.IN_PROGRESS,
        attachments: [],
        actorId,
      }),
    ).toEqual([
      {
        type: IncidentEventType.STATUS_CHANGED,
        actorId,
        metadata: {
          fromStatus: IncidentStatus.OPEN,
          toStatus: IncidentStatus.IN_PROGRESS,
        },
      },
    ]);
  });

  it('records a priority change with the previous and the new priority', () => {
    expect(
      incidentUpdateEvents({
        current,
        priority: IncidentLevel.CRITICAL,
        attachments: [],
        actorId,
      }),
    ).toEqual([
      {
        type: IncidentEventType.PRIORITY_CHANGED,
        actorId,
        metadata: {
          fromPriority: IncidentLevel.ERROR,
          toPriority: IncidentLevel.CRITICAL,
        },
      },
    ]);
  });

  it('records resolving the incident as INCIDENT_RESOLVED', () => {
    expect(
      incidentUpdateEvents({
        current: { ...current, status: IncidentStatus.IN_PROGRESS },
        status: IncidentStatus.RESOLVED,
        attachments: [],
        actorId,
      }),
    ).toEqual([
      {
        type: IncidentEventType.INCIDENT_RESOLVED,
        actorId,
        metadata: {
          fromStatus: IncidentStatus.IN_PROGRESS,
          toStatus: IncidentStatus.RESOLVED,
        },
      },
    ]);
  });

  it('records reopening a resolved incident as a status change', () => {
    const [event] = incidentUpdateEvents({
      current: { ...current, status: IncidentStatus.RESOLVED },
      status: IncidentStatus.IN_PROGRESS,
      attachments: [],
      actorId,
    });

    expect(event.type).toBe(IncidentEventType.STATUS_CHANGED);
  });

  it('records the first corrective action with its text', () => {
    expect(
      incidentUpdateEvents({
        current,
        correctiveActions: 'Certificado renovado',
        attachments: [],
        actorId,
      }),
    ).toEqual([
      {
        type: IncidentEventType.CORRECTIVE_ACTION_ADDED,
        actorId,
        metadata: { description: 'Certificado renovado' },
      },
    ]);
  });

  it('keeps the replaced text when the corrective action is rewritten', () => {
    expect(
      incidentUpdateEvents({
        current: { ...current, correctiveActions: 'Primeira versão' },
        correctiveActions: 'Segunda versão',
        attachments: [],
        actorId,
      }),
    ).toEqual([
      {
        type: IncidentEventType.CORRECTIVE_ACTION_ADDED,
        actorId,
        metadata: {
          description: 'Segunda versão',
          previousDescription: 'Primeira versão',
        },
      },
    ]);
  });

  it('records clearing the corrective action as a removal with the old text', () => {
    expect(
      incidentUpdateEvents({
        current: { ...current, correctiveActions: 'Texto antigo' },
        correctiveActions: null,
        attachments: [],
        actorId,
      }),
    ).toEqual([
      {
        type: IncidentEventType.CORRECTIVE_ACTION_REMOVED,
        actorId,
        metadata: { previousDescription: 'Texto antigo' },
      },
    ]);
  });

  it('records one event per added attachment, after the field changes', () => {
    const events = incidentUpdateEvents({
      current,
      status: IncidentStatus.PENDING,
      attachments: [
        {
          filename: 'antes.png',
          category: AttachmentCategory.CORRECTIVE_ACTION,
        },
        {
          filename: 'depois.jpg',
          category: AttachmentCategory.CORRECTIVE_ACTION,
        },
      ],
      actorId,
    });

    expect(events.map((event) => event.type)).toEqual([
      IncidentEventType.STATUS_CHANGED,
      IncidentEventType.ATTACHMENT_ADDED,
      IncidentEventType.ATTACHMENT_ADDED,
    ]);
    expect(events[1]).toEqual({
      type: IncidentEventType.ATTACHMENT_ADDED,
      actorId,
      metadata: {
        filename: 'antes.png',
        category: AttachmentCategory.CORRECTIVE_ACTION,
      },
    });
  });
});

describe('toPublicIncidentEvent', () => {
  const event = {
    id: 3,
    incidentId: 10,
    type: IncidentEventType.STATUS_CHANGED,
    actorId: 7,
    metadata: { fromStatus: 'OPEN', toStatus: 'PENDING' },
    createdAt: new Date('2026-10-10T12:00:00Z'),
  };

  it('exposes the author by name only', () => {
    expect(
      toPublicIncidentEvent({
        ...event,
        actor: { name: 'Ana Suporte', role: UserRole.ADMIN },
      }),
    ).toEqual({
      id: 3,
      type: IncidentEventType.STATUS_CHANGED,
      createdAt: event.createdAt,
      actorName: 'Ana Suporte',
      metadata: event.metadata,
    });
  });

  it('has no author for events created by the webhook', () => {
    expect(
      toPublicIncidentEvent({ ...event, actorId: null, actor: null }).actorName,
    ).toBeNull();
  });
});
