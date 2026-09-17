import { SetMetadata } from '@nestjs/common';
import { AccountPersona } from '../domain/user-capability.types';

export const CAPABILITY_KEY = 'capabilities';

export const RequireCapability = (...capabilities: AccountPersona[]) => 
  SetMetadata(CAPABILITY_KEY, capabilities);
