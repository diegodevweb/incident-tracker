import { Request } from 'express';
import { JwtPayload } from './jwt-payload.interface';

export type AuthenticatedRequest = Request & {
  user: JwtPayload;
};
