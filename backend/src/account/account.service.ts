import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { checkPasswordPolicy } from '../auth/password-policy';
import { hashPassword } from '../auth/passwords';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  mustChangePassword: true,
  createdAt: true,
  company: { select: { id: true, name: true, cnpj: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getProfile(userId: number) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: ACCOUNT_SELECT,
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    return account;
  }

  updateProfile(userId: number, data: UpdateAccountDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name },
      select: ACCOUNT_SELECT,
    });
  }

  /**
   * Troca a senha conferindo a atual. As outras sessões do usuário caem
   * (tokenVersion muda) e esta recebe um token novo.
   */
  async changePassword(userId: number, data: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Conta não encontrada');
    }

    // 400 e não 401: para o front, 401 significa sessão encerrada.
    if (!(await bcrypt.compare(data.currentPassword, user.password))) {
      throw new BadRequestException('Senha atual incorreta');
    }

    if (data.newPassword === data.currentPassword) {
      throw new BadRequestException(
        'A nova senha precisa ser diferente da atual',
      );
    }

    const problems = checkPasswordPolicy(data.newPassword, {
      email: user.email,
    });

    if (problems.length > 0) {
      throw new BadRequestException(
        `A nova senha precisa ${problems.join(', ')}`,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await hashPassword(data.newPassword),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    return this.authService.issueSession(updated);
  }
}
