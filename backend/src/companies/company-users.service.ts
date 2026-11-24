import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { generateTemporaryPassword, hashPassword } from '../auth/passwords';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManagedUserDto } from '../users/dto/create-managed-user.dto';
import { UpdateManagedUserDto } from '../users/dto/update-managed-user.dto';
import { MANAGED_USER_SELECT, withUniqueEmail } from '../users/managed-users';

/**
 * Usuários de uma empresa cliente, geridos pelo admin. Só mexe em usuários
 * CLIENT da empresa da rota: admins e usuários de outra empresa dão 404.
 * Usuário não é apagado, é desativado (eventos e chamados apontam para ele).
 */
@Injectable()
export class CompanyUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: number) {
    await this.assertCompany(companyId);

    return this.prisma.user.findMany({
      where: { companyId, role: UserRole.CLIENT },
      select: MANAGED_USER_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  /** Cria o usuário com uma senha temporária, devolvida só nesta resposta. */
  async create(companyId: number, data: CreateManagedUserDto) {
    await this.assertCompany(companyId);

    const temporaryPassword = generateTemporaryPassword(data.email);
    const user = await withUniqueEmail(async () =>
      this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await hashPassword(temporaryPassword),
          role: UserRole.CLIENT,
          companyId,
          mustChangePassword: true,
        },
        select: MANAGED_USER_SELECT,
      }),
    );

    return { user, temporaryPassword };
  }

  async update(companyId: number, userId: number, data: UpdateManagedUserDto) {
    await this.findUser(companyId, userId);

    return withUniqueEmail(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { name: data.name, email: data.email },
        select: MANAGED_USER_SELECT,
      }),
    );
  }

  /**
   * Senha temporária nova: derruba as sessões do usuário e exige a troca no
   * próximo acesso. A senha só aparece nesta resposta.
   */
  async resetPassword(companyId: number, userId: number) {
    const user = await this.findUser(companyId, userId);
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

  /** Bloqueia o login e derruba as sessões do usuário. */
  async disable(companyId: number, userId: number) {
    const user = await this.findUser(companyId, userId);

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

  async enable(companyId: number, userId: number) {
    await this.findUser(companyId, userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { disabledAt: null },
      select: MANAGED_USER_SELECT,
    });
  }

  private async assertCompany(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
  }

  private async findUser(companyId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        disabledAt: true,
      },
    });

    if (
      !user ||
      user.role !== UserRole.CLIENT ||
      user.companyId !== companyId
    ) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }
}
