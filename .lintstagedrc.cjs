module.exports = {
  'backend/**/*.{ts,js,json}': ['prettier --write'],
  'backend/**/*.ts': ['eslint --fix --max-warnings 0 --config backend/eslint.config.mjs'],
  'frontend/**/*.{ts,tsx,js,jsx,json}': ['prettier --write'],
  'frontend/**/*.{ts,tsx}': ['eslint --fix --max-warnings 0 --config frontend/eslint.config.mjs'],
  'packages/create-nest-next-auth/**/*.{ts,js,json,mjs}': ['prettier --write'],
  'packages/create-nest-next-auth/**/*.ts': [
    'eslint --fix --max-warnings 0 --config packages/create-nest-next-auth/eslint.config.mjs',
  ],
  'shared/**/*.{ts,tsx,js,json}': ['prettier --write'],
  'shared/core/**/*.ts': ['eslint --fix --max-warnings 0 --config shared/core/eslint.config.mjs'],
  'mobile/**/*.{ts,tsx,js,jsx,json}': ['prettier --write'],
  '*.{md,yml,yaml}': ['prettier --write'],
};
