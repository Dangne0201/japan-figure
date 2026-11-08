import type { UserRole } from '../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerifiedAt: Date;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
