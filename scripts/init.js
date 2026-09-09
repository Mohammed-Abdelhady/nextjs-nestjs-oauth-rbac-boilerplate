#!/usr/bin/env node
import { configureBackendPort, configureFrontendPort } from './lib/config-transforms.js';

/**
 * Project Initialization Script
 *
 * Interactive CLI to configure the boilerplate for your project.
 * Updates app name, env files, package.json, Docker configs, and more.
 *
 * Usage: node scripts/init.js
 */

import crypto from 'node:crypto';
import path from 'node:path';
import {
  colors,
  log,
  drawBox,
  toKebabCase,
  toTitleCase,
  toSnakeCase,
  readJson,
  writeJson,
  readFile,
  writeFile,
  fileExists,
  backupFile,
  createPrompt,
  ask,
  askRequired,
  askYesNo,
  printKeyValue,
  ROOT_DIR,
} from './lib/cli-utils.js';

// ═══════════════════════════════════════════════════════════════
// Configuration Collection
// ═══════════════════════════════════════════════════════════════
async function collectBasicInfo(rl) {
  log.step('Basic Project Information');

  const appName = await askRequired(rl, 'App name (e.g., My Awesome App)', (value) => {
    if (value.length < 2) {
      log.error('App name must be at least 2 characters');
      return false;
    }
    return true;
  });

  const appSlug = toKebabCase(appName);
  const appTitle = toTitleCase(appName);
  const dbName = toSnakeCase(appName);

  log.info(`Slug: ${colors.cyan}${appSlug}${colors.reset}`);
  log.info(`Database: ${colors.cyan}${dbName}${colors.reset}`);

  const description = await ask(
    rl,
    'Project description',
    `${appTitle} - Full-stack authentication application`,
  );

  const authorName = await ask(rl, 'Author name', '');

  return { appName, appSlug, appTitle, dbName, description, authorName };
}

async function collectEnvironmentConfig(rl, dbName) {
  log.step('Environment Configuration');

  const frontendPort = await ask(rl, 'Frontend host port (Docker container stays on 3000)', '3000');
  const backendPort = await ask(rl, 'Backend port', '5001');
  const mongoUri = await ask(rl, 'MongoDB URI', `mongodb://localhost:27017/${dbName}`);

  return {
    frontendPort: Number.parseInt(frontendPort, 10) || 3000,
    backendPort: Number.parseInt(backendPort, 10) || 5001,
    mongoUri: mongoUri || `mongodb://localhost:27017/${dbName}`,
  };
}

async function collectSmtpConfig(rl) {
  log.step('SMTP Configuration (for sending emails)');

  const configureSmtp = await askYesNo(rl, 'Configure SMTP now?', false);

  if (!configureSmtp) {
    return { host: '', port: '587', secure: 'false', user: '', pass: '', from: '' };
  }

  const host = await ask(rl, 'SMTP host (e.g., smtp.gmail.com)', '');
  const port = await ask(rl, 'SMTP port', '587');
  const user = await ask(rl, 'SMTP user (email)', '');
  const pass = await ask(rl, 'SMTP password (app password)', '');
  const from = await ask(rl, 'From email', user);

  return { host, port, secure: 'false', user, pass, from: from || user };
}

async function collectOAuthConfig(rl) {
  log.step('OAuth Configuration (optional)');

  const configureOAuth = await askYesNo(rl, 'Configure OAuth providers now?', false);

  const oauth = {
    google: { clientId: '', clientSecret: '' },
    facebook: { clientId: '', clientSecret: '' },
    github: { clientId: '', clientSecret: '' },
  };

  if (!configureOAuth) {
    return oauth;
  }

  // Google
  if (await askYesNo(rl, 'Configure Google OAuth?', false)) {
    oauth.google.clientId = await ask(rl, 'Google Client ID', '');
    oauth.google.clientSecret = await ask(rl, 'Google Client Secret', '');
  }

  // Facebook
  if (await askYesNo(rl, 'Configure Facebook OAuth?', false)) {
    oauth.facebook.clientId = await ask(rl, 'Facebook App ID', '');
    oauth.facebook.clientSecret = await ask(rl, 'Facebook App Secret', '');
  }

  // GitHub
  if (await askYesNo(rl, 'Configure GitHub OAuth?', false)) {
    oauth.github.clientId = await ask(rl, 'GitHub Client ID', '');
    oauth.github.clientSecret = await ask(rl, 'GitHub Client Secret', '');
  }

  return oauth;
}

// ═══════════════════════════════════════════════════════════════
// File Update Functions
// ═══════════════════════════════════════════════════════════════
function updatePackageJson(config) {
  // Root package.json
  const rootPkg = readJson(path.join(ROOT_DIR, 'package.json'));
  if (rootPkg) {
    rootPkg.name = config.appSlug;
    rootPkg.description = config.description;
    writeJson(path.join(ROOT_DIR, 'package.json'), rootPkg);
    log.success('Root package.json updated');
  }

  // Backend package.json
  const backendPkg = readJson(path.join(ROOT_DIR, 'backend', 'package.json'));
  if (backendPkg) {
    backendPkg.name = `${config.appSlug}-backend`;
    backendPkg.description = `${config.appTitle} Backend API`;
    backendPkg.author = config.authorName;
    writeJson(path.join(ROOT_DIR, 'backend', 'package.json'), backendPkg);
    log.success('Backend package.json updated');
  }

  // Frontend package.json
  const frontendPkg = readJson(path.join(ROOT_DIR, 'frontend', 'package.json'));
  if (frontendPkg) {
    frontendPkg.name = `${config.appSlug}-frontend`;
    writeJson(path.join(ROOT_DIR, 'frontend', 'package.json'), frontendPkg);
    log.success('Frontend package.json updated');
  }
}

function generateBackendEnv(config) {
  const { env, smtp, oauth } = config;

  return `# ${config.appTitle} Backend Configuration
# Generated by init script

# Application Environment
NODE_ENV=development

# Server Port
PORT=${env.backendPort}

# MongoDB Connection URI
MONGO_URI=${env.mongoUri}

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:${env.frontendPort}

# Rate Limiting Configuration
THROTTLE_TTL=60
THROTTLE_LIMIT=60

# SMTP Configuration
${smtp.host ? `SMTP_HOST=${smtp.host}` : '# SMTP_HOST=smtp.gmail.com'}
${smtp.port ? `SMTP_PORT=${smtp.port}` : '# SMTP_PORT=587'}
SMTP_SECURE=${smtp.secure}
${smtp.user ? `SMTP_USER=${smtp.user}` : '# SMTP_USER=your-email@gmail.com'}
${smtp.pass ? `SMTP_PASS=${smtp.pass}` : '# SMTP_PASS=your-app-password'}
${smtp.from ? `EMAIL_FROM=${smtp.from}` : '# EMAIL_FROM=your-email@gmail.com'}

# Bcrypt Configuration
BCRYPT_ROUNDS=10

# Session Configuration
SESSION_COOKIE_NAME=sid
SESSION_COOKIE_MAX_AGE=604800000

# API origin used by OAuth callbacks and generated clients
API_URL=http://localhost:${env.backendPort}
OAUTH_CALLBACK_BASE_URL=http://localhost:${env.backendPort}/api/auth/oauth
OAUTH_STATE_SECRET=${config.stateSecret}

# Activation Code Configuration
ACTIVATION_CODE_EXPIRES_IN=900000

# Google OAuth
${oauth.google.clientId ? `OAUTH_GOOGLE_CLIENT_ID=${oauth.google.clientId}` : '# OAUTH_GOOGLE_CLIENT_ID=your-google-client-id'}
${oauth.google.clientSecret ? `OAUTH_GOOGLE_CLIENT_SECRET=${oauth.google.clientSecret}` : '# OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret'}

# Facebook OAuth
${oauth.facebook.clientId ? `OAUTH_FACEBOOK_CLIENT_ID=${oauth.facebook.clientId}` : '# OAUTH_FACEBOOK_CLIENT_ID=your-facebook-app-id'}
${oauth.facebook.clientSecret ? `OAUTH_FACEBOOK_CLIENT_SECRET=${oauth.facebook.clientSecret}` : '# OAUTH_FACEBOOK_CLIENT_SECRET=your-facebook-app-secret'}

# GitHub OAuth
${oauth.github.clientId ? `OAUTH_GITHUB_CLIENT_ID=${oauth.github.clientId}` : '# OAUTH_GITHUB_CLIENT_ID=your-github-client-id'}
${oauth.github.clientSecret ? `OAUTH_GITHUB_CLIENT_SECRET=${oauth.github.clientSecret}` : '# OAUTH_GITHUB_CLIENT_SECRET=your-github-client-secret'}

# Swagger/OpenAPI Documentation
SWAGGER_ENABLED=true
`;
}

function generateFrontendEnv(config) {
  const { env } = config;

  return `# ${config.appTitle} Frontend Configuration
# Generated by init script

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:${env.backendPort}
`;
}

function updateDockerFiles(config) {
  const files = ['docker-compose.yml', 'docker-compose.prod.yml', '.env.docker.example'];

  for (const file of files) {
    const filePath = path.join(ROOT_DIR, file);
    if (!fileExists(filePath)) continue;

    const backupPath = backupFile(filePath);
    if (backupPath) {
      log.info(`Backed up ${file} to ${path.basename(backupPath)}`);
    }

    let content = readFile(filePath);

    // Update container names and database
    content = content.replaceAll('authboiler-mongodb', `${config.appSlug}-mongodb`);
    content = content.replaceAll('authboiler-backend', `${config.appSlug}-backend`);
    content = content.replaceAll('authboiler-frontend', `${config.appSlug}-frontend`);
    content = content.replaceAll('authboiler-nginx', `${config.appSlug}-nginx`);
    content = content.replaceAll('authboiler-certbot', `${config.appSlug}-certbot`);
    content = content.replaceAll('MONGO_DATABASE:-authboiler', `MONGO_DATABASE:-${config.dbName}`);
    content = content.replaceAll('/authboiler', `/${config.dbName}`);
    content = content.replaceAll(
      'MONGO_INITDB_DATABASE: authboiler',
      `MONGO_INITDB_DATABASE: ${config.dbName}`,
    );

    if (file.endsWith('.yml')) {
      content = configureBackendPort(content, config.env.backendPort);
      content = configureFrontendPort(content, config.env.frontendPort);
    }

    // Update frontend NEXT_PUBLIC_API_URL in compose
    content = content.replace(
      /(NEXT_PUBLIC_API_URL:\s*\${NEXT_PUBLIC_API_URL:-http:\/\/localhost:)\d+(\})/g,
      `$1${config.env.backendPort}$2`,
    );

    // Update .env.docker.example PORT and API URL
    content = content.replace(/^PORT=\d+/m, `PORT=${config.env.backendPort}`);
    content = content.replace(
      /^NEXT_PUBLIC_API_URL=http:\/\/localhost:\d+/m,
      `NEXT_PUBLIC_API_URL=http://localhost:${config.env.backendPort}`,
    );

    content = content.replace(
      /(CLIENT_URL:\s*\${CLIENT_URL:-http:\/\/localhost:)\d+(\})/g,
      `$1${config.env.frontendPort}$2`,
    );
    content = content.replace(
      /^CLIENT_URL=http:\/\/localhost:\d+/m,
      `CLIENT_URL=http://localhost:${config.env.frontendPort}`,
    );

    writeFile(filePath, content);
    log.success(`${file} updated`);
  }
}

function updateReadmeFiles(config) {
  // Root README
  const rootReadmePath = path.join(ROOT_DIR, 'README.md');
  if (fileExists(rootReadmePath)) {
    let content = readFile(rootReadmePath);
    content = content.replace(/^# .+$/m, `# ${config.appTitle}`);
    content = content.replace(/Production-ready authentication system.+$/m, config.description);
    content = content.replace(
      /git clone.+\.git/,
      `git clone https://github.com/your-username/${config.appSlug}.git`,
    );
    content = content.replaceAll('cd FULL-MERN-AUTH-Boilerplate', `cd ${config.appSlug}`);
    writeFile(rootReadmePath, content);
    log.success('README.md updated');
  }

  // Frontend README
  const frontendReadmePath = path.join(ROOT_DIR, 'frontend', 'README.md');
  if (fileExists(frontendReadmePath)) {
    let content = readFile(frontendReadmePath);
    content = content.replace(/^# .+$/m, `# ${config.appTitle} - Frontend`);
    writeFile(frontendReadmePath, content);
    log.success('Frontend README.md updated');
  }

  // Backend README
  const backendReadmePath = path.join(ROOT_DIR, 'backend', 'README.md');
  if (fileExists(backendReadmePath)) {
    let content = readFile(backendReadmePath);
    content = content.replace(/^# .+$/m, `# ${config.appTitle} - Backend API`);
    writeFile(backendReadmePath, content);
    log.success('Backend README.md updated');
  }
}

// ═══════════════════════════════════════════════════════════════
// Summary Display
// ═══════════════════════════════════════════════════════════════
function printSummary(config) {
  drawBox('Configuration Summary', { color: colors.cyan });

  console.log(`${colors.cyan}Project:${colors.reset}`);
  printKeyValue({
    'App Name': config.appTitle,
    Slug: config.appSlug,
    Database: config.dbName,
    Description: config.description,
  });

  console.log(`\n${colors.cyan}Environment:${colors.reset}`);
  printKeyValue({
    'Frontend Port': config.env.frontendPort,
    'Backend Port': config.env.backendPort,
    'MongoDB URI': config.env.mongoUri,
  });

  console.log(`\n${colors.cyan}SMTP:${colors.reset}`);
  printKeyValue({
    Host: config.smtp.host,
    User: config.smtp.user,
  });

  console.log(`\n${colors.cyan}OAuth:${colors.reset}`);
  printKeyValue({
    Google: config.oauth.google.clientId ? 'Configured' : 'Not configured',
    Facebook: config.oauth.facebook.clientId ? 'Configured' : 'Not configured',
    GitHub: config.oauth.github.clientId ? 'Configured' : 'Not configured',
  });

  console.log('');
}

function printNextSteps(config) {
  drawBox('Setup Complete!', { color: colors.green });

  log.success(`Project "${colors.cyan}${config.appTitle}${colors.reset}" has been configured!`);

  console.log(`
${colors.dim}Next steps:${colors.reset}

  1. Review the generated .env files:
     ${colors.cyan}backend/.env${colors.reset}
     ${colors.cyan}frontend/.env.local${colors.reset}

  2. Install dependencies:
     ${colors.cyan}npm install${colors.reset}

  3. Start the development servers:
     ${colors.cyan}# With Docker (recommended)${colors.reset}
     docker compose up

     ${colors.cyan}# Or manually${colors.reset}
     cd backend && npm run start:dev
     cd frontend && npm run dev

  4. Access your app:
     Frontend: ${colors.cyan}http://localhost:${config.env.frontendPort}${colors.reset}
     Backend:  ${colors.cyan}http://localhost:${config.env.backendPort}${colors.reset}
     API Docs: ${colors.cyan}http://localhost:${config.env.backendPort}/api/docs${colors.reset}

  5. For production deployment:
     ${colors.cyan}npm run setup:prod${colors.reset}

${colors.dim}Documentation: ./docs/README.md${colors.reset}
`);
}

// ═══════════════════════════════════════════════════════════════
// Main Function
// ═══════════════════════════════════════════════════════════════
async function init() {
  drawBox('Project Setup', { color: colors.cyan });

  log.info('This script will configure the boilerplate for your project.');
  log.info('Press Ctrl+C at any time to cancel.\n');

  const rl = await createPrompt();

  try {
    // Collect configuration
    const basic = await collectBasicInfo(rl);
    const env = await collectEnvironmentConfig(rl, basic.dbName);
    const smtp = await collectSmtpConfig(rl);
    const oauth = await collectOAuthConfig(rl);

    const config = {
      ...basic,
      env,
      smtp,
      oauth,
      stateSecret: crypto.randomBytes(48).toString('base64url'),
    };

    // Show summary
    printSummary(config);

    // Confirm
    const proceed = await askYesNo(rl, 'Proceed with this configuration?', true);

    if (!proceed) {
      log.warn('Setup cancelled by user.');
      rl.close();
      process.exit(0);
    }

    rl.close();

    // Apply configuration
    log.title('Applying Configuration...');

    // Update package.json files
    log.info('Updating package.json files...');
    updatePackageJson(config);

    // Create backend .env
    log.info('Creating backend/.env...');
    const backendEnvPath = path.join(ROOT_DIR, 'backend', '.env');
    if (fileExists(backendEnvPath)) {
      const backupPath = backupFile(backendEnvPath);
      if (backupPath) {
        log.info(`Backed up backend/.env to ${path.basename(backupPath)}`);
      }
    }
    writeFile(backendEnvPath, generateBackendEnv(config), { mode: 0o600 });
    log.success('Backend .env created');

    // Create frontend .env.local
    log.info('Creating frontend/.env.local...');
    const frontendEnvPath = path.join(ROOT_DIR, 'frontend', '.env.local');
    if (fileExists(frontendEnvPath)) {
      const backupPath = backupFile(frontendEnvPath);
      if (backupPath) {
        log.info(`Backed up frontend/.env.local to ${path.basename(backupPath)}`);
      }
    }
    writeFile(frontendEnvPath, generateFrontendEnv(config), { mode: 0o600 });
    log.success('Frontend .env.local created');

    // Update Docker files
    log.info('Updating Docker configuration...');
    updateDockerFiles(config);

    // Update README files
    log.info('Updating README files...');
    updateReadmeFiles(config);

    // Print next steps
    printNextSteps(config);
  } catch (error) {
    rl.close();
    throw error;
  }
}

// Run
try {
  await init();
} catch (error) {
  log.error(`Initialization failed: ${error.message}`);
  process.exit(1);
}
