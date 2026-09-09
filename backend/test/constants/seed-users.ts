/** Credentials created by `npm run seed`. The e2e suites log in as these. */
export interface SeedUser {
  email: string;
  password: string;
}

export const SEED_ADMIN: SeedUser = {
  email: 'admin@seed.local',
  password: 'Admin123!',
};

export const SEED_MANAGER: SeedUser = {
  email: 'manager@seed.local',
  password: 'Manager123!',
};

export const SEED_SUPPORT: SeedUser = {
  email: 'support@seed.local',
  password: 'Support123!',
};

export const SEED_USER: SeedUser = {
  email: 'user@seed.local',
  password: 'User123!',
};
