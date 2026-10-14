import { UnsupportedMediaTypeException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

const file = (
  buffer: Buffer,
  originalname = 'print.png',
  mimetype = 'image/png',
) => ({
  buffer,
  originalname,
  mimetype,
  size: buffer.length,
});

describe('IncidentsService uploads', () => {
  const admin: JwtPayload = {
    sub: 1,
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    companyId: null,
  };
  const body = {
    companyId: 1,
    title: 'Erro na emissão',
    description: 'Nota rejeitada',
    environment: 'production',
  };

  let prisma: {
    incident: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    company: { findUnique: jest.Mock };
  };
  let storage: {
    uploadObject: jest.Mock;
    deleteObject: jest.Mock;
    getDownloadUrl: jest.Mock;
  };
  let service: IncidentsService;

  const incidentRow = {
    id: 10,
    companyId: 1,
    attachments: [],
    logs: [],
    events: [],
    company: {},
  };

  beforeEach(() => {
    prisma = {
      incident: {
        create: jest.fn().mockResolvedValue(incidentRow),
        update: jest.fn().mockResolvedValue(incidentRow),
        findUnique: jest.fn().mockResolvedValue(incidentRow),
      },
      company: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    storage = {
      uploadObject: jest.fn(({ key }: { key: string }) =>
        Promise.resolve({ key }),
      ),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      getDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/x'),
    };
    service = new IncidentsService(prisma as unknown as PrismaService, storage);
  });

  const uploadedKeys = () =>
    (storage.uploadObject.mock.calls as [[{ key: string }]]).map(
      ([input]) => input.key,
    );
  const createdAttachments = () =>
    (
      prisma.incident.create.mock.calls as [
        [{ data: { attachments: { create: Record<string, string>[] } } }],
      ]
    )[0][0].data.attachments.create;

  describe('file type validation', () => {
    it('rejects HTML sent as image/png with 415 and uploads nothing', async () => {
      await expect(
        service.createIncident(body, [file(HTML, 'x.png', 'image/png')], admin),
      ).rejects.toThrow(UnsupportedMediaTypeException);

      expect(storage.uploadObject).not.toHaveBeenCalled();
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('validates every file before uploading any of them', async () => {
      await expect(
        service.createIncident(body, [file(PNG), file(HTML, 'bad.png')], admin),
      ).rejects.toThrow(UnsupportedMediaTypeException);

      expect(storage.uploadObject).not.toHaveBeenCalled();
    });

    it('stores the detected type instead of the one declared by the client', async () => {
      await service.createIncident(
        body,
        [file(PNG, 'print.html', 'text/html')],
        admin,
      );

      expect(storage.uploadObject).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'image/png' }),
      );
      expect(createdAttachments()[0]).toMatchObject({ mimeType: 'image/png' });
    });

    it('applies the same validation to corrective attachments', async () => {
      await expect(
        service.updateIncident(10, {}, admin, [file(HTML, 'fix.png')]),
      ).rejects.toThrow(UnsupportedMediaTypeException);

      expect(prisma.incident.update).not.toHaveBeenCalled();
    });
  });

  describe('orphan cleanup', () => {
    it('deletes the uploaded objects when the insert fails on create', async () => {
      prisma.incident.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.createIncident(
          body,
          [file(PNG, 'a.png'), file(JPEG, 'b.jpg')],
          admin,
        ),
      ).rejects.toThrow('db down');

      expect(
        storage.deleteObject.mock.calls.map(([key]) => key as string).sort(),
      ).toEqual(uploadedKeys().sort());
    });

    it('uploads nothing when the admin picks a company that does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.createIncident(body, [file(PNG, 'a.png')], admin),
      ).rejects.toThrow('Empresa não encontrada');

      expect(storage.uploadObject).not.toHaveBeenCalled();
    });

    it('deletes the uploaded objects when the update fails', async () => {
      prisma.incident.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.updateIncident(10, {}, admin, [file(PNG)]),
      ).rejects.toThrow('db down');

      expect(storage.deleteObject).toHaveBeenCalledWith(uploadedKeys()[0]);
    });

    it('deletes what was already uploaded when a later upload fails', async () => {
      storage.uploadObject
        .mockImplementationOnce(({ key }: { key: string }) =>
          Promise.resolve({ key }),
        )
        .mockRejectedValueOnce(new Error('storage down'));

      await expect(
        service.createIncident(
          body,
          [file(PNG, 'a.png'), file(PNG, 'b.png')],
          admin,
        ),
      ).rejects.toThrow('storage down');

      expect(storage.deleteObject).toHaveBeenCalledTimes(1);
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('still reports the original error when the cleanup itself fails', async () => {
      prisma.incident.create.mockRejectedValue(new Error('db down'));
      storage.deleteObject.mockRejectedValue(new Error('storage down'));

      await expect(
        service.createIncident(body, [file(PNG)], admin),
      ).rejects.toThrow('db down');
    });
  });

  describe('corrective attachments on update', () => {
    it('adds new files without deleting the existing ones', async () => {
      await service.updateIncident(10, { correctiveActions: 'ok' }, admin, [
        file(PNG),
      ]);

      const { data } = (
        prisma.incident.update.mock.calls as [
          [{ data: { attachments: Record<string, unknown> } }],
        ]
      )[0][0];
      expect(data.attachments).not.toHaveProperty('deleteMany');
      expect(data.attachments).toHaveProperty('create');
    });

    it('leaves the attachments untouched when the update has no files', async () => {
      await service.updateIncident(10, { correctiveActions: 'ok' }, admin);

      const { data } = (
        prisma.incident.update.mock.calls as [
          [{ data: Record<string, unknown> }],
        ]
      )[0][0];
      expect(data).not.toHaveProperty('attachments');
    });
  });

  describe('long file names', () => {
    it('keeps the stored name and the object key within the column size', async () => {
      await service.createIncident(
        body,
        [file(PNG, `${'a'.repeat(400)}.png`)],
        admin,
      );

      expect(uploadedKeys()[0].length).toBeLessThanOrEqual(191);
      expect(createdAttachments()[0].filename.length).toBeLessThanOrEqual(191);
      expect(createdAttachments()[0].url.length).toBeLessThanOrEqual(191);
    });
  });
});
