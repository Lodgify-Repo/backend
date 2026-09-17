import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { DomainError } from '@/common/domain/error';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, pass: string): Promise<any> {
    try {
      const user = await this.authService.validateUser(email, pass);
      return user;
    } catch (e) {
      if (e instanceof DomainError) {
        throw new UnauthorizedException(e.message);
      }
      throw e;
    }
  }
}
