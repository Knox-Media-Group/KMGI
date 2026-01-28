import { Request } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
