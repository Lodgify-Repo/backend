import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      throw new UnauthorizedException(info?.message || 'Unauthorized');
    }
    return user;
  }
}
