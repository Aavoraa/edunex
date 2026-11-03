import type { Permission, RoleScope } from './config/rbac.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  title: string | null;
  roleKey: string;
  roleName: string;
  scope: RoleScope;
  homeRoute: string;
  campusId: string | null;
  permissions: Set<Permission>;
  employeeId: string | null;
  parentId: string | null;
  studentId: string | null;
  clientType: 'web' | 'mobile' | 'integration';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      valid?: Partial<Record<'body' | 'query' | 'params', any>>;
      requestId?: string;
    }
  }
}
