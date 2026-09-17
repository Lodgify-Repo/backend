import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Service } from '@/common/domain/base.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { RegisterDto, ResetPasswordDto, NewPasswordDto } from '../dto/auth.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DomainError } from '@/common/domain/error';
import { AuthErrorCodes } from '../errors';
import { User } from '@prisma/client';

export type SanitizedUser = Omit<User, 'password' | 'refreshToken' | 'resetToken' | 'resetTokenExpires'>;
export type UserPrincipal = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role'>;

export interface GoogleProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  googleId?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: UserPrincipal;
}

@Injectable()
export class AuthService extends Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    super();
  }

  async validateUser(email: string, pass: string): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new DomainError(AuthErrorCodes.USER_NOT_FOUND, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new DomainError(AuthErrorCodes.ACCOUNT_DISABLED, 'Account is disabled');
    }

    if (!user.password) {
      throw new DomainError(AuthErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new DomainError(AuthErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials');
    }

    const { password, ...result } = user;
    return result;
  }

  async login(user: UserPrincipal): Promise<AuthSession> {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      tenantId: user.id,
      tier: 'standard' as const,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = crypto.randomUUID();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async refreshToken(token: string): Promise<AuthSession> {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken: token },
    });
    if (!user) {
      throw new DomainError(AuthErrorCodes.INVALID_CREDENTIALS, 'Invalid refresh token');
    }
    return this.login(user);
  }

  async googleLogin(profile: GoogleProfile): Promise<AuthSession> {
    if (!profile?.email) {
      throw new DomainError(AuthErrorCodes.INVALID_CREDENTIALS, 'No valid profile from Google');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!existingUser) {
      const newUser = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl,
        },
      });
      return this.login(newUser);
    }

    if (!existingUser.googleId && profile.googleId) {
      const linkedUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl },
      });
      return this.login(linkedUser);
    }

    return this.login(existingUser);
  }

  async register(dto: RegisterDto): Promise<Omit<User, 'password'>> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new DomainError(AuthErrorCodes.USER_ALREADY_EXISTS, 'User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const newUser = await this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        role: dto.role,
      },
    });

    const { password, ...result } = newUser;
    return result;
  }

  async forgotPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    this.logger.info(`Password reset requested for ${user.email}. Token generated.`);
  }

  async resetPassword(dto: NewPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new DomainError(AuthErrorCodes.INVALID_CREDENTIALS, 'Invalid or expired reset token');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
  }
}
