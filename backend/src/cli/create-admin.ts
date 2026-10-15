import { Prisma, UserRole, type PrismaClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  validate,
} from 'class-validator';
import { checkPasswordPolicy } from '../auth/password-policy';
import { hashPassword } from '../auth/passwords';
import { NormalizeEmail, Trim } from '../common/trim';
import { MAX_VARCHAR_LENGTH } from '../incidents/limits';

/** Erro que o comando mostra ao operador sem pilha de execução. */
export class CreateAdminError extends Error {}

// Mesmas regras de nome e e-mail do cadastro pelo painel.
class CreateAdminDto {
  @Trim()
  @IsString({ message: 'informe o nome' })
  @IsNotEmpty({ message: 'informe o nome' })
  @MaxLength(MAX_VARCHAR_LENGTH, {
    message: `o nome aceita no máximo ${MAX_VARCHAR_LENGTH} caracteres`,
  })
  name!: string;

  @NormalizeEmail()
  @IsEmail({}, { message: 'e-mail inválido' })
  @MaxLength(MAX_VARCHAR_LENGTH, {
    message: `o e-mail aceita no máximo ${MAX_VARCHAR_LENGTH} caracteres`,
  })
  email!: string;
}

export type CreateAdminInput = {
  name: string;
  email: string;
  password: string;
};

/**
 * Cria um usuário ADMIN com a senha escolhida (sem troca obrigatória). É o único
 * caminho para o primeiro admin: o seed nunca roda em produção e o painel só
 * cadastra clientes. Nunca altera um usuário que já existe.
 */
export async function createAdmin(
  prisma: Pick<PrismaClient, 'user'>,
  input: CreateAdminInput,
) {
  const data = plainToInstance(CreateAdminDto, {
    name: input.name,
    email: input.email,
  });
  const errors = await validate(data);

  if (errors.length > 0) {
    const reasons = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    throw new CreateAdminError(`Dados inválidos: ${reasons.join('; ')}`);
  }

  const problems = checkPasswordPolicy(input.password, { email: data.email });

  if (problems.length > 0) {
    throw new CreateAdminError(`A senha precisa ${problems.join(', ')}`);
  }

  try {
    return await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: await hashPassword(input.password),
        role: UserRole.ADMIN,
      },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new CreateAdminError(
        `Já existe um usuário com o e-mail ${data.email}; nada foi alterado`,
      );
    }

    throw error;
  }
}

export type CreateAdminArgs = { name?: string; email?: string; help: boolean };

/** Lê `--name`, `--email` (com espaço ou `=`) e `--help`; recusa o resto, inclusive `--password`. */
export function parseArgs(argv: string[]): CreateAdminArgs {
  const args: CreateAdminArgs = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inlineValue] = argv[index].split(/=(.*)/s, 2);

    if (flag === '--help' || flag === '-h') {
      args.help = true;
      continue;
    }

    if (flag !== '--name' && flag !== '--email') {
      throw new CreateAdminError(
        flag === '--password'
          ? 'A senha não é aceita como argumento (ficaria no histórico do shell); ela é pedida no terminal ou lida de CREATE_ADMIN_PASSWORD'
          : `Argumento desconhecido: ${flag}`,
      );
    }

    const value = inlineValue ?? argv[(index += 1)];

    if (value === undefined) {
      throw new CreateAdminError(`${flag} precisa de um valor`);
    }

    args[flag === '--name' ? 'name' : 'email'] = value;
  }

  return args;
}
