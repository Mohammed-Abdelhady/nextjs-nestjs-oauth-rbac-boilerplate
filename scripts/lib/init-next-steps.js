import { colors } from './cli-utils.js';

/**
 * The lines printed after setup. Markers sit between array elements, never
 * inside a line, so an unpruned template still prints no marker text.
 */
export function buildNextStepLines(config) {
  return [
    `${colors.dim}Next steps:${colors.reset}`,
    '',
    '  1. Review the generated .env files:',
    `     ${colors.cyan}backend/.env${colors.reset}`,
    `     ${colors.cyan}frontend/.env.local${colors.reset}`,
    '',
    '  2. Install dependencies:',
    `     ${colors.cyan}pnpm install --frozen-lockfile${colors.reset}`,
    '',
    '  3. Start the development servers:',
    // feature:docker:start
    `     ${colors.cyan}# With Docker (recommended)${colors.reset}`,
    '     docker compose up',
    '',
    // feature:docker:end
    `     ${colors.cyan}# Run them locally:${colors.reset}`,
    `     ${colors.cyan}# Start a single-node replica set first (sign-in uses transactions):${colors.reset}`,
    '     mkdir -p ./mongodb-data',
    '     mongod --replSet rs0 --dbpath ./mongodb-data',
    `     ${colors.cyan}# leave mongod running, then in a second terminal:${colors.reset}`,
    '     mongosh --eval "rs.initiate()"',
    '     pnpm --filter backend run start:dev',
    '     pnpm --filter frontend run dev',
    '',
    '  4. Access your app:',
    `     Frontend: ${colors.cyan}http://localhost:${config.env.frontendPort}${colors.reset}`,
    `     Backend:  ${colors.cyan}http://localhost:${config.env.backendPort}${colors.reset}`,
    `     API Docs: ${colors.cyan}http://localhost:${config.env.backendPort}/api/docs${colors.reset}`,
    '',
    // feature:production:start
    '  5. For production deployment:',
    `     ${colors.cyan}pnpm run setup:prod${colors.reset}`,
    '',
    // feature:production:end
    `${colors.dim}Documentation: ./docs/README.md${colors.reset}`,
  ];
}
