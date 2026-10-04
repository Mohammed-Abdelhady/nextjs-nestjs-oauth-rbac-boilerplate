module.exports = {
  'backend/**/*.{ts,js,json}': ['prettier --write'],
  'backend/**/*.ts': ['pnpm --filter backend exec eslint --fix --max-warnings 0'],
  'frontend/**/*.{ts,tsx,js,jsx,json}': ['prettier --write'],
  'frontend/**/*.{ts,tsx}': ['pnpm --filter frontend exec eslint --fix --max-warnings 0'],
  'packages/create-nest-next-auth/**/*.{ts,js,json,mjs}': ['prettier --write'],
  'packages/create-nest-next-auth/**/*.ts': [
    'pnpm --filter create-nest-next-auth exec eslint --fix --max-warnings 0',
  ],
  'shared/**/*.{ts,tsx,js,json}': ['prettier --write'],
  'shared/core/**/*.ts': ['pnpm --filter @app/core exec eslint --fix --max-warnings 0'],
  'shared/sdk/**/*.ts': ['pnpm --filter @app/sdk exec eslint --fix --max-warnings 0'],
  'mobile/**/*.{ts,tsx,js,jsx,json}': ['prettier --write'],
  'mobile/auth/**/*.ts': ['eslint --fix --max-warnings 0 --config mobile/auth/eslint.config.mjs'],
  '*.{md,yml,yaml}': ['prettier --write'],
};
