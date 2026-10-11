import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentStatus, Prisma, UserRole } from '@prisma/client';
import { generateTemporaryPassword, hashPassword } from '../auth/passwords';
import { DEFAULT_PAGE_SIZE } from '../incidents/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

// O que o admin vê de um cliente. Senha e versão de token nunca saem.
const CLIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  disabledAt: true,
  mustChangePassword: true,
  _count: {
    select: {
      incidents: { where: { status: { not: IncidentStatus.RESOLVED } } },
    },
  },
} satisfies Prisma.UserSelect;

type ClientRow = Prisma.UserGetPayload<{ select: typeof CLIENT_SELECT }>;

const toClient = ({ _count, ...client }: ClientRow) => ({
  ...client,
  openIncidents: _count.incidents,
});

/**
 * Gestão de clientes pelo admin. Só mexe em usuários CLIENT: admins não são
 * criados nem alterados por aqui. Cliente não é apagado, é desativado
 * (chamados e eventos apontam para ele).
 */
@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListClientsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.UserWhereInput = {
      role: UserRole.CLIENT,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { email: { contains: query.q } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: CLIENT_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: rows.map(toClient), total, page, pageSize };
  }

  /** Cria o cliente com uma senha temporária, devolvida só nesta resposta. */
  async create(data: CreateClientDto) {
    const temporaryPassword = generateTemporaryPassword(data.email);
    const client = await this.withUniqueEmail(async () =>
      this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await hashPassword(temporaryPassword),
          role: UserRole.CLIENT,
          mustChangePassword: true,
        },
        select: CLIENT_SELECT,
      }),
    );

    return { client: toClient(client), temporaryPassword };
  }

  async update(id: number, data: UpdateClientDto) {
    await this.findClient(id);

    const client = await this.withUniqueEmail(() =>
      this.prisma.user.update({
        where: { id },
        data: { name: data.name, email: data.email },
        select: CLIENT_SELECT,
      }),
    );

    return toClient(client);
  }

  /**
   * Senha temporária nova: derruba as sessões do cliente e exige a troca no
   * próximo acesso. A senha só aparece nesta resposta.
   */
  async resetPassword(id: number) {
    const client = await this.findClient(id);
    const temporaryPassword = generateTemporaryPassword(client.email);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
    });

    return { temporaryPassword };
  }

  /** Bloqueia o login, derruba as sessões e para as chaves de webhook. */
  async disable(id: number) {
    const client = await this.findClient(id);

    if (client.disabledAt) {
      return toClient(
        await this.prisma.user.findUniqueOrThrow({
          where: { id },
          select: CLIENT_SELECT,
        }),
      );
    }

    return toClient(
      await this.prisma.user.update({
        where: { id },
        data: { disabledAt: new Date(), tokenVersion: { increment: 1 } },
        select: CLIENT_SELECT,
      }),
    );
  }

  async enable(id: number) {
    await this.findClient(id);

    return toClient(
      await this.prisma.user.update({
        where: { id },
        data: { disabledAt: null },
        select: CLIENT_SELECT,
      }),
    );
  }

  private async findClient(id: number) {
    const client = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, disabledAt: true },
    });

    if (!client || client.role !== UserRole.CLIENT) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return client;
  }

  private async withUniqueEmail<T>(write: () => Promise<T>) {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um usuário com este e-mail');
      }

      throw error;
    }
  }
}
