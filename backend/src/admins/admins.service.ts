import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { generateTemporaryPassword, hashPassword } from '../auth/passwords';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManagedUserDto } from '../users/dto/create-managed-user.dto';
import { UpdateManagedUserDto } from '../users/dto/update-managed-user.dto';
import { MANAGED_USER_SELECT, withUniqueEmail } from '../users/managed-users';

/**
 * Os outros admins, geridos por um admin no painel. O primeiro admin continua
 * saindo do comando create-admin (sem admin não há quem entre no painel).
 * Ninguém mexe na própria conta por aqui: nome e senha mudam em "Meu perfil"
 * (a troca de senha pede a atual), e o e-mail só outro admin muda. Como quem
 * age é um admin ativo e não pode se desativar, sobra pelo menos um admin ativo
 * (a não ser que dois se desativem ao mesmo tempo; aí o comando cria outro).
 * Usuários CLIENT dão 404.
 */
@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: MANAGED_USER_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  /** Cria o admin com uma senha temporária, devolvida só nesta resposta. */
  async create(data: CreateManagedUserDto) {
    const temporaryPassword = generateTemporaryPassword(data.email);
    const user = await withUniqueEmail(async () =>
      this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await hashPassword(temporaryPassword),
          role: UserRole.ADMIN,
          mustChangePassword: true,
        },
        select: MANAGED_USER_SELECT,
      }),
    );

    return { user, temporaryPassword };
  }

  async update(actorId: number, userId: number, data: UpdateManagedUserDto) {
    await this.findOtherAdmin(actorId, userId);

    return withUniqueEmail(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { name: data.name, email: data.email },
        select: MANAGED_USER_SELECT,
      }),
    );
  }

  /**
   * Senha temporária nova: derruba as sessões do admin e exige a troca no
   * próximo acesso. A senha só aparece nesta resposta.
   */
  async resetPassword(actorId: number, userId: number) {
    const user = await this.findOtherAdmin(actorId, userId);
    const temporaryPassword = generateTemporaryPassword(user.email);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        tokenVersion: { increment: 1 },
      },
    });

    return { temporaryPassword };
  }

  /** Bloqueia o login e derruba as sessões do admin. */
  async disable(actorId: number, userId: number) {
    const user = await this.findOtherAdmin(actorId, userId);

    if (user.disabledAt) {
      return this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: MANAGED_USER_SELECT,
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { disabledAt: new Date(), tokenVersion: { increment: 1 } },
      select: MANAGED_USER_SELECT,
    });
  }

  async enable(actorId: number, userId: number) {
    await this.findOtherAdmin(actorId, userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { disabledAt: null },
      select: MANAGED_USER_SELECT,
    });
  }

  private async findOtherAdmin(actorId: number, userId: number) {
    if (userId === actorId) {
      throw new ForbiddenException(
        'A sua própria conta se altera em Meu perfil',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, disabledAt: true },
    });

    if (!user || user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Admin não encontrado');
    }

    return user;
  }
}
