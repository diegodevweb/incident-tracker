import 'dotenv/config';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { PrismaClient } from '@prisma/client';
import { CreateAdminError, createAdmin, parseArgs } from './create-admin';

const USAGE = `Uso: node dist/cli/run-create-admin --name "Nome" --email pessoa@empresa.com
     (no desenvolvimento, depois de "npm run build": npm run create-admin -- --name ... --email ...)

Cria um usuário ADMIN, que entra com a senha escolhida aqui. A senha é pedida no
terminal (sem eco, duas vezes) ou, sem terminal, lida de CREATE_ADMIN_PASSWORD.
Nome e e-mail que faltarem também são pedidos no terminal. Precisa de DATABASE_URL.
O comando nunca altera um usuário que já existe.`;

/** Lê uma linha do terminal; com `hidden`, sem mostrar o que se digita. */
function ask(question: string, hidden = false) {
  return new Promise<string>((resolve, reject) => {
    const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
    const lines = createInterface({
      input: process.stdin,
      output: hidden ? muted : process.stdout,
      terminal: true,
    });

    if (hidden) {
      process.stdout.write(question);
    }

    lines.on('SIGINT', () => {
      lines.close();
      reject(new CreateAdminError('Cancelado'));
    });
    lines.on('close', () => reject(new CreateAdminError('Cancelado')));
    lines.question(hidden ? '' : question, (answer) => {
      if (hidden) {
        process.stdout.write('\n');
      }

      resolve(answer);
      lines.close();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new CreateAdminError('DATABASE_URL não está definida');
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const password = process.env.CREATE_ADMIN_PASSWORD || undefined;

  if (!interactive) {
    if (!args.name || !args.email) {
      throw new CreateAdminError(
        'Sem terminal para pedir nome e e-mail: use --name e --email',
      );
    }

    if (!password) {
      throw new CreateAdminError(
        'Sem terminal para pedir a senha: defina CREATE_ADMIN_PASSWORD',
      );
    }
  }

  const name = args.name ?? (await ask('Nome: '));
  const email = args.email ?? (await ask('E-mail: '));
  let chosen = password;

  if (!chosen) {
    chosen = await ask('Senha: ', true);

    if (chosen !== (await ask('Repita a senha: ', true))) {
      throw new CreateAdminError('As senhas não conferem');
    }
  }

  const prisma = new PrismaClient();

  try {
    const admin = await createAdmin(prisma, { name, email, password: chosen });

    console.log(`Admin criado: id ${admin.id}, ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof CreateAdminError ? `Erro: ${error.message}` : error,
  );
  process.exitCode = 1;
});
