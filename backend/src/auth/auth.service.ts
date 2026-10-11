import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { LoginRateLimitService } from './login-rate-limit.service';

// Hash bcrypt (custo 10) de uma senha aleatória descartada. É comparado quando o
// e-mail não existe, para o login levar o mesmo tempo com ou sem usuário.
export const DUMMY_PASSWORD_HASH =
  '$2b$10$0cP4LD2EPKWyAxCJz0f0xemJis7A0IrUUst30frydgCUcl08b/Owu';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly loginRateLimitService: LoginRateLimitService,
  ) {}

  async login({ email, password }: LoginDto, ipAddress: string) {
    const normalizedEmail = email.toLowerCase();

    this.loginRateLimitService.check(ipAddress, normalizedEmail);

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    const passwordMatches = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      this.loginRateLimitService.registerFailure(ipAddress, normalizedEmail);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.loginRateLimitService.reset(ipAddress, normalizedEmail);

    // Só chega aqui com a senha certa, então dizer que a conta está desativada
    // não ajuda quem tenta adivinhar e-mails.
    if (user.disabledAt) {
      throw new ForbiddenException(
        'Conta desativada. Fale com o administrador.',
      );
    }

    return this.issueSession(user);
  }

  /** Token novo para o usuário, com a versão de token atual dele. */
  async issueSession(user: User) {
    return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        role: user.role,
        email: user.email,
        tv: user.tokenVersion,
      }),
      user: this.serializeUser(user),
    };
  }

  /** Invalida todos os tokens já emitidos para o usuário. */
  async logout(userId: number) {
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
