/** Response shapes the e2e suites read. Kept here so specs need no casts to any. */

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  isVerified: boolean;
}

export interface PermissionsResponse {
  permissions: string[];
}

export interface RegisterResponse {
  user: {
    role: string;
  };
}

export interface RoleResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiBody<T> {
  success: boolean;
  data: T;
}
