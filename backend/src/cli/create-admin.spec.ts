import { randomBytes } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateAdminError, createAdmin, parseArgs } from './create-admin';

// Tudo montado em tempo de execução: nenhuma credencial literal no arquivo.
const randomPassword = () => randomBytes(18).toString('base64url');
const randomEmail = () =>
  `owner-${randomBytes(4).toString('hex')}@example.test`;

type CreateCall = { data: Record<string, unknown> };

describe('createAdmin', () => {
  const create = jest.fn<Promise<unknown>, [CreateCall]>();
  const prisma = { user: { create } } as unknown as Parameters<
    typeof createAdmin
  >[0];

  beforeEach(() => {
    create.mockReset();
    create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, name: 'Dona do Sistema', email: data.email }),
    );
  });

  it('creates an ADMIN with the chosen password, hashed, and no company', async () => {
    const password = randomPassword();
    const email = randomEmail();

    const admin = await createAdmin(prisma, {
      name: 'Dona do Sistema',
      email,
      password,
    });

    expect(admin).toEqual({ id: 1, name: 'Dona do Sistema', email });
    expect(create).toHaveBeenCalledTimes(1);

    const { data } = create.mock.calls[0][0];

    expect(data).toMatchObject({
      name: 'Dona do Sistema',
      email,
      role: UserRole.ADMIN,
    });
    // Escolheu a senha: não precisa trocá-la, e administrador não tem empresa.
    expect(data).not.toHaveProperty('mustChangePassword');
    expect(data).not.toHaveProperty('companyId');
    expect(data.password).not.toBe(password);
    expect(await bcrypt.compare(password, data.password as string)).toBe(true);
  });

  it('trims the name and lowercases the e-mail, as the login looks it up', async () => {
    const email = randomEmail();

    await createAdmin(prisma, {
      name: '  Dona do Sistema  ',
      email: `  ${email.toUpperCase()} `,
      password: randomPassword(),
    });

    expect(create.mock.calls[0][0]).toMatchObject({
      data: { name: 'Dona do Sistema', email },
    });
  });

  it('rejects a password that breaks the policy, without touching the database', async () => {
    const email = randomEmail();
    const repeated = 'k'.repeat(16);
    const short = randomBytes(4).toString('hex');
    const withEmailStart = `${email.split('@')[0]}${randomBytes(4).toString('hex')}`;

    for (const password of [repeated, short, withEmailStart, '']) {
      await expect(
        createAdmin(prisma, { name: 'Dona', email, password }),
      ).rejects.toThrow(/^A senha precisa /);
    }

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a blank name and an invalid e-mail, naming each problem', async () => {
    await expect(
      createAdmin(prisma, {
        name: '   ',
        email: 'not-an-email',
        password: randomPassword(),
      }),
    ).rejects.toThrow(
      /informe o nome.*e-mail inválido|e-mail inválido.*informe o nome/,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an e-mail that already exists instead of changing that user', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const email = randomEmail();

    await expect(
      createAdmin(prisma, {
        name: 'Dona',
        email: email.toUpperCase(),
        password: randomPassword(),
      }),
    ).rejects.toThrow(
      new CreateAdminError(
        `Já existe um usuário com o e-mail ${email}; nada foi alterado`,
      ),
    );
  });

  it('lets unexpected database errors through untouched', async () => {
    const failure = new Error('connection lost');

    create.mockRejectedValue(failure);

    await expect(
      createAdmin(prisma, {
        name: 'Dona',
        email: randomEmail(),
        password: randomPassword(),
      }),
    ).rejects.toBe(failure);
  });
});

describe('parseArgs', () => {
  it('reads the flags with a space or with =', () => {
    expect(
      parseArgs(['--name', 'Dona do Sistema', '--email=a@b.test']),
    ).toEqual({ name: 'Dona do Sistema', email: 'a@b.test', help: false });
  });

  it('keeps an = inside the value', () => {
    expect(parseArgs(['--name=a=b']).name).toBe('a=b');
  });

  it('accepts no arguments and the help flags', () => {
    expect(parseArgs([])).toEqual({ help: false });
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('refuses the password as an argument and says where it comes from', () => {
    const value = randomPassword();

    expect(() => parseArgs(['--password', value])).toThrow(
      /CREATE_ADMIN_PASSWORD/,
    );
    expect(() => parseArgs([`--password=${value}`])).toThrow(
      /CREATE_ADMIN_PASSWORD/,
    );
    // A mensagem nunca repete o valor digitado.
    try {
      parseArgs([`--password=${value}`]);
    } catch (error) {
      expect((error as Error).message).not.toContain(value);
    }
  });

  it('refuses unknown flags and flags without a value', () => {
    expect(() => parseArgs(['--role', 'x'])).toThrow(
      'Argumento desconhecido: --role',
    );
    expect(() => parseArgs(['--email'])).toThrow('--email precisa de um valor');
  });
});
