import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyUsersController } from './company-users.controller';
import { CompanyUsersService } from './company-users.service';

const JWT_SECRET = 'test-secret-with-more-than-32-bytes-of-length';

describe('CompaniesController and CompanyUsersController', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const companiesService = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    get: jest.fn().mockResolvedValue({ id: 5 }),
    create: jest.fn().mockResolvedValue({ id: 5 }),
    update: jest.fn().mockResolvedValue({ id: 5 }),
    disable: jest.fn().mockResolvedValue({ id: 5 }),
    enable: jest.fn().mockResolvedValue({ id: 5 }),
  };
  const companyUsersService = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ user: { id: 9 } }),
    update: jest.fn().mockResolvedValue({ id: 9 }),
    resetPassword: jest.fn().mockResolvedValue({}),
    disable: jest.fn().mockResolvedValue({ id: 9 }),
    enable: jest.fn().mockResolvedValue({ id: 9 }),
  };
  const roles: Record<number, UserRole> = {
    1: UserRole.ADMIN,
    2: UserRole.CLIENT,
  };

  const http = () => request(app.getHttpServer() as Server);
  const tokenFor = (id: 1 | 2) =>
    jwtService.sign({
      sub: id,
      email: 'u@example.com',
      role: roles[id],
      tv: 0,
    });
  const asAdmin = () => `Bearer ${tokenFor(1)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET })],
        }),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET }),
      ],
      controllers: [CompaniesController, CompanyUsersController],
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: ({ where }: { where: { id: number } }) =>
                Promise.resolve({
                  id: where.id,
                  email: 'u@example.com',
                  role: roles[where.id],
                  tokenVersion: 0,
                  mustChangePassword: false,
                  disabledAt: null,
                  companyId: roles[where.id] === UserRole.CLIENT ? 5 : null,
                  company: null,
                }),
            },
          },
        },
        { provide: CompaniesService, useValue: companiesService },
        { provide: CompanyUsersService, useValue: companyUsersService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const user = { name: 'Ana', email: 'ana@empresa.com' };
  const routes = [
    ['GET /companies', () => http().get('/companies')],
    ['GET /companies/5', () => http().get('/companies/5')],
    [
      'POST /companies',
      () => http().post('/companies').send({ name: 'Empresa' }),
    ],
    [
      'PATCH /companies/5',
      () => http().patch('/companies/5').send({ name: 'x' }),
    ],
    ['POST company disable', () => http().post('/companies/5/disable')],
    ['POST company enable', () => http().post('/companies/5/enable')],
    ['GET users', () => http().get('/companies/5/users')],
    ['POST users', () => http().post('/companies/5/users').send(user)],
    [
      'PATCH user',
      () => http().patch('/companies/5/users/9').send({ name: 'x' }),
    ],
    [
      'POST password-reset',
      () => http().post('/companies/5/users/9/password-reset'),
    ],
    ['POST user disable', () => http().post('/companies/5/users/9/disable')],
    ['POST user enable', () => http().post('/companies/5/users/9/enable')],
  ] as const;

  it.each(routes)('%s requires a token', async (_, call) => {
    await call().expect(401);
  });

  it.each(routes)('%s is forbidden to clients', async (_, call) => {
    await call()
      .set('Authorization', `Bearer ${tokenFor(2)}`)
      .expect(403);

    [
      ...Object.values(companiesService),
      ...Object.values(companyUsersService),
    ].forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });

  describe('companies', () => {
    it.each([
      ['with punctuation', ' 11.222.333/0001-81 ', '11222333000181'],
      ['alphanumeric, in lowercase', '12.abc.345/01de-35', '12ABC34501DE35'],
    ])('normalizes a CNPJ %s and trims the name', async (_, cnpj, expected) => {
      await http()
        .post('/companies')
        .set('Authorization', asAdmin())
        .send({ name: '  Empresa  ', cnpj })
        .expect(201);

      expect(companiesService.create).toHaveBeenCalledWith({
        name: 'Empresa',
        cnpj: expected,
      });
    });

    it('accepts a company without a CNPJ', async () => {
      await http()
        .post('/companies')
        .set('Authorization', asAdmin())
        .send({ name: 'Empresa', cnpj: '' })
        .expect(201);

      expect(companiesService.create).toHaveBeenCalledWith({
        name: 'Empresa',
        cnpj: null,
      });
    });

    it.each([
      ['with a blank name', { name: '  ' }],
      ['without a name', { cnpj: '11222333000181' }],
      ['with an invalid CNPJ', { name: 'E', cnpj: '11.222.333/0001-82' }],
      ['with a non-text CNPJ', { name: 'E', cnpj: 11222333000181 }],
      ['with extra fields', { name: 'E', disabledAt: null }],
    ])('rejects a company %s', async (_, body) => {
      await http()
        .post('/companies')
        .set('Authorization', asAdmin())
        .send(body)
        .expect(400);

      expect(companiesService.create).not.toHaveBeenCalled();
    });

    it('removes the CNPJ when an edit sends it empty', async () => {
      await http()
        .patch('/companies/5')
        .set('Authorization', asAdmin())
        .send({ cnpj: '' })
        .expect(200);

      expect(companiesService.update).toHaveBeenCalledWith(5, { cnpj: null });
    });

    it('passes numeric ids and the query to the service', async () => {
      const admin = asAdmin();

      await http()
        .get('/companies?page=2&pageSize=50&q=acme&status=active')
        .set('Authorization', admin)
        .expect(200);
      await http().get('/companies/5').set('Authorization', admin).expect(200);
      await http()
        .post('/companies/5/disable')
        .set('Authorization', admin)
        .expect(200);
      await http()
        .post('/companies/5/enable')
        .set('Authorization', admin)
        .expect(200);

      expect(companiesService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 50,
        q: 'acme',
        status: 'active',
      });
      expect(companiesService.get).toHaveBeenCalledWith(5);
      expect(companiesService.disable).toHaveBeenCalledWith(5);
      expect(companiesService.enable).toHaveBeenCalledWith(5);
    });

    it.each([
      ['a page size over 100', '/companies?pageSize=101'],
      ['an unknown status', '/companies?status=all'],
    ])('rejects %s', async (_, url) => {
      await http().get(url).set('Authorization', asAdmin()).expect(400);
    });
  });

  describe('company users', () => {
    it('normalizes the e-mail and trims the name on creation', async () => {
      await http()
        .post('/companies/5/users')
        .set('Authorization', asAdmin())
        .send({ name: '  Ana  ', email: '  Ana@Empresa.COM ' })
        .expect(201);

      expect(companyUsersService.create).toHaveBeenCalledWith(5, {
        name: 'Ana',
        email: 'ana@empresa.com',
      });
    });

    it.each([
      ['without an e-mail', { name: 'Ana' }],
      ['with an invalid e-mail', { name: 'Ana', email: 'nao-e-email' }],
      ['with a blank name', { name: '  ', email: 'a@example.com' }],
      ['choosing a role', { ...user, role: 'ADMIN' }],
      ['choosing another company', { ...user, companyId: 6 }],
      ['choosing a password', { ...user, password: 'x'.repeat(14) }],
    ])('rejects a user %s', async (_, body) => {
      await http()
        .post('/companies/5/users')
        .set('Authorization', asAdmin())
        .send(body)
        .expect(400);

      expect(companyUsersService.create).not.toHaveBeenCalled();
    });

    it('passes the company and the user to the service', async () => {
      const admin = asAdmin();

      await http()
        .get('/companies/5/users')
        .set('Authorization', admin)
        .expect(200);
      await http()
        .patch('/companies/5/users/9')
        .set('Authorization', admin)
        .send({ email: 'Novo@Example.com' })
        .expect(200);
      await http()
        .post('/companies/5/users/9/password-reset')
        .set('Authorization', admin)
        .expect(200);
      await http()
        .post('/companies/5/users/9/disable')
        .set('Authorization', admin)
        .expect(200);
      await http()
        .post('/companies/5/users/9/enable')
        .set('Authorization', admin)
        .expect(200);

      expect(companyUsersService.list).toHaveBeenCalledWith(5);
      expect(companyUsersService.update).toHaveBeenCalledWith(5, 9, {
        email: 'novo@example.com',
      });
      expect(companyUsersService.resetPassword).toHaveBeenCalledWith(5, 9);
      expect(companyUsersService.disable).toHaveBeenCalledWith(5, 9);
      expect(companyUsersService.enable).toHaveBeenCalledWith(5, 9);
    });

    it.each([
      ['company', '/companies/abc/users/9/disable'],
      ['user', '/companies/5/users/abc/disable'],
    ])('rejects a non-numeric %s id', async (_, url) => {
      await http().post(url).set('Authorization', asAdmin()).expect(400);
    });
  });
});
