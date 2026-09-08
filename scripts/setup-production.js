#!/usr/bin/env node

/**
 * Production Setup Script
 *
 * Interactive CLI to configure the application for production deployment.
 * Handles domain configuration, SSL certificates, Docker, and environment setup.
 *
 * Usage: node scripts/setup-production.js
 */

import crypto from 'node:crypto';
import { configureNginxDomains } from './lib/config-transforms.js';
import path from 'node:path';
import {
  colors,
  log,
  drawBox,
  toSnakeCase,
  readFile,
  writeFile,
  fileExists,
  backupFile,
  validateDomain,
  validateEmail,
  validatePort,
  commandExists,
  exec,
  execAsync,
  createPrompt,
  ask,
  askRequired,
  askYesNo,
  askChoice,
  createSpinner,
  printKeyValue,
  ROOT_DIR,
} from './lib/cli-utils.js';

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  requiredCommands: ['docker', 'openssl'],
  optionalCommands: ['docker-compose'],
  sslTypes: [
    { label: "Let's Encrypt", value: 'letsencrypt', hint: 'Recommended for production' },
    { label: 'Self-Signed', value: 'self-signed', hint: 'Development/testing only' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Prerequisite Checks
// ═══════════════════════════════════════════════════════════════
async function checkPrerequisites() {
  log.step('Checking prerequisites...');

  const missing = [];

  for (const cmd of CONFIG.requiredCommands) {
    if (commandExists(cmd)) {
      log.success(`${cmd} is installed`);
    } else {
      missing.push(cmd);
      log.error(`${cmd} is not installed`);
    }
  }

  // Check docker compose (v2 style)
  if (commandExists('docker')) {
    const result = exec('docker compose version', { silent: true });
    if (result.success) {
      log.success('Docker Compose is available');
    } else if (commandExists('docker-compose')) {
      log.success('docker-compose is installed');
    } else {
      missing.push('docker-compose');
      log.error('Docker Compose is not available');
    }
  }

  if (missing.length > 0) {
    log.error(`\nMissing required tools: ${missing.join(', ')}`);
    log.info('Please install the missing tools and try again.');
    process.exit(1);
  }

  console.log('');
}

// ═══════════════════════════════════════════════════════════════
// Domain Configuration
// ═══════════════════════════════════════════════════════════════
async function configureDomains(rl) {
  log.step('Domain Configuration');

  const mainDomain = await askRequired(rl, 'Main domain (e.g., example.com)', (value) => {
    if (!validateDomain(value)) {
      log.error('Invalid domain format');
      return false;
    }
    return true;
  });

  const frontendDomain = await ask(rl, 'Frontend domain', `www.${mainDomain}`);
  if (frontendDomain && !validateDomain(frontendDomain)) {
    log.warn('Invalid frontend domain, using default');
  }

  const backendDomain = await ask(rl, 'Backend API domain', `api.${mainDomain}`);
  if (backendDomain && !validateDomain(backendDomain)) {
    log.warn('Invalid backend domain, using default');
  }

  return {
    mainDomain,
    frontendDomain: frontendDomain || `www.${mainDomain}`,
    backendDomain: backendDomain || `api.${mainDomain}`,
  };
}

// ═══════════════════════════════════════════════════════════════
// SSL Configuration
// ═══════════════════════════════════════════════════════════════
async function configureSSL(rl) {
  log.step('SSL Certificate Configuration');

  const email = await askRequired(rl, 'Email for SSL certificates', (value) => {
    if (!validateEmail(value)) {
      log.error('Invalid email format');
      return false;
    }
    return true;
  });

  const sslType = await askChoice(rl, 'Choose SSL certificate type:', CONFIG.sslTypes);

  if (sslType === 'self-signed') {
    log.warn('Self-signed certificates should NOT be used in production!');
    log.warn('Browsers will show security warnings.');
  }

  return { email, sslType };
}

// ═══════════════════════════════════════════════════════════════
// Database Configuration
// ═══════════════════════════════════════════════════════════════
async function configureDatabase(rl, appSlug) {
  log.step('MongoDB Configuration');

  const username = await ask(rl, 'MongoDB username', 'admin');
  const passwordInput = await ask(rl, 'MongoDB password (leave empty to generate)', '');
  const password = passwordInput || crypto.randomBytes(32).toString('base64url');
  const dbName = await ask(rl, 'Database name', toSnakeCase(appSlug));

  return { username, password, dbName };
}

// ═══════════════════════════════════════════════════════════════
// Port Configuration
// ═══════════════════════════════════════════════════════════════
async function configurePorts(rl) {
  log.step('Port Configuration');

  const httpPort = await ask(rl, 'Nginx HTTP port', '80');
  const httpsPort = await ask(rl, 'Nginx HTTPS port', '443');

  if (!validatePort(httpPort)) {
    log.warn('Invalid HTTP port, using 80');
  }
  if (!validatePort(httpsPort)) {
    log.warn('Invalid HTTPS port, using 443');
  }

  return {
    httpPort: validatePort(httpPort) ? httpPort : '80',
    httpsPort: validatePort(httpsPort) ? httpsPort : '443',
  };
}

// ═══════════════════════════════════════════════════════════════
// Generate Configuration Files
// ═══════════════════════════════════════════════════════════════
function generateEnvFile(config) {
  return `# Production Environment Configuration
# Generated by setup-production script

# ══════════════════════════════════════════
# Domain Configuration
# ══════════════════════════════════════════
NGINX_HOST=${config.domains.mainDomain}
MAIN_DOMAIN=${config.domains.mainDomain}
FRONTEND_DOMAIN=${config.domains.frontendDomain}
BACKEND_DOMAIN=${config.domains.backendDomain}

# ══════════════════════════════════════════
# Frontend Configuration
# ══════════════════════════════════════════
NEXT_PUBLIC_API_URL=https://${config.domains.backendDomain}

# ══════════════════════════════════════════
# Backend Configuration
# ══════════════════════════════════════════
NODE_ENV=production
CLIENT_URL=https://${config.domains.frontendDomain}
PORT=5000

# ══════════════════════════════════════════
# MongoDB Configuration
# ══════════════════════════════════════════
MONGO_DATABASE=${config.database.dbName}
MONGO_USERNAME=${config.database.username}
MONGO_PASSWORD=${config.database.password}
MONGO_URI=mongodb://${config.database.username}:${config.database.password}@mongodb:27017/${config.database.dbName}?authSource=admin

# ══════════════════════════════════════════
# SSL Configuration
# ══════════════════════════════════════════
SSL_TYPE=${config.ssl.sslType}
SSL_EMAIL=${config.ssl.email}

# ══════════════════════════════════════════
# Port Configuration
# ══════════════════════════════════════════
NGINX_HTTP_PORT=${config.ports.httpPort}
NGINX_HTTPS_PORT=${config.ports.httpsPort}

# ══════════════════════════════════════════
# Application Configuration
# ══════════════════════════════════════════
APP_NAME=${config.appName}

# ══════════════════════════════════════════
# Security
# ══════════════════════════════════════════
# JWT_SECRET=

# ══════════════════════════════════════════
# SMTP Configuration
# ══════════════════════════════════════════
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# EMAIL_FROM=noreply@${config.domains.mainDomain}
`;
}

// ═══════════════════════════════════════════════════════════════
// Update Docker Compose
// ═══════════════════════════════════════════════════════════════
function updateDockerCompose(config) {
  const filePath = path.join(ROOT_DIR, 'docker-compose.prod.yml');

  if (!fileExists(filePath)) {
    log.warn('docker-compose.prod.yml not found, skipping...');
    return;
  }

  // Backup original
  const backupPath = backupFile(filePath);
  if (backupPath) {
    log.info(`Backed up to ${path.basename(backupPath)}`);
  }

  let content = readFile(filePath);
  const appSlug = toSnakeCase(config.appName).replaceAll('_', '-');

  // Update container names
  content = content.replaceAll('authboiler-mongodb', `${appSlug}-mongodb`);
  content = content.replaceAll('authboiler-backend', `${appSlug}-backend`);
  content = content.replaceAll('authboiler-frontend', `${appSlug}-frontend`);
  content = content.replaceAll('authboiler-nginx', `${appSlug}-nginx`);
  content = content.replaceAll('authboiler-certbot', `${appSlug}-certbot`);

  // Update database name
  content = content.replaceAll(
    'MONGO_DATABASE:-authboiler',
    `MONGO_DATABASE:-${config.database.dbName}`,
  );
  content = content.replaceAll('/authboiler', `/${config.database.dbName}`);
  content = content.replaceAll(
    'MONGO_INITDB_DATABASE: authboiler',
    `MONGO_INITDB_DATABASE: ${config.database.dbName}`,
  );

  writeFile(filePath, content);
  log.success('docker-compose.prod.yml updated');
}

// ═══════════════════════════════════════════════════════════════
// Update Nginx Configuration
// ═══════════════════════════════════════════════════════════════
function updateNginxConfig(config) {
  const configFiles = ['nginx/nginx.conf', 'nginx/production-nginx.conf'];
  for (const file of configFiles) {
    const filePath = path.join(ROOT_DIR, file);

    if (!fileExists(filePath)) {
      continue;
    }

    const backupPath = backupFile(filePath);
    if (backupPath) {
      log.info(`Backed up ${file}`);
    }

    const content = configureNginxDomains(readFile(filePath), config.domains);

    writeFile(filePath, content);
    log.success(`${file} updated`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Generate SSL Certificates
// ═══════════════════════════════════════════════════════════════
async function generateSSLCertificates(config) {
  log.step('Setting up SSL certificates...');

  const sslDir = path.join(ROOT_DIR, 'nginx', 'ssl');

  // Create SSL directory
  exec(`mkdir -p ${sslDir}`, { silent: true });

  if (config.ssl.sslType === 'self-signed') {
    log.warn('Generating self-signed certificates (DEVELOPMENT ONLY)...');

    const spinner = createSpinner('Generating certificates...');
    spinner.start();

    const result = exec(
      `openssl req -x509 -nodes -days 365 -newkey rsa:2048 ` +
        `-keyout ${sslDir}/privkey.pem ` +
        `-out ${sslDir}/fullchain.pem ` +
        `-subj "/C=US/ST=State/L=City/O=${config.appName}/CN=${config.domains.mainDomain}"`,
      { silent: true },
    );

    if (result.success) {
      // Create chain.pem (copy of fullchain for self-signed)
      exec(`cp ${sslDir}/fullchain.pem ${sslDir}/chain.pem`, { silent: true });
      exec(`chmod 644 ${sslDir}/*.pem`, { silent: true });
      exec(`chmod 600 ${sslDir}/privkey.pem`, { silent: true });
      spinner.stop(true);
      log.success('Self-signed certificates generated');
    } else {
      spinner.stop(false);
      log.error('Failed to generate certificates');
      log.error(result.error);
    }
  } else {
    log.info("Let's Encrypt certificates will be obtained when services start.");
    log.info('Make sure your domain DNS points to this server before starting.');
    log.info('');
    log.info('To obtain certificates, run:');
    console.log(`  ${colors.cyan}docker compose -f docker-compose.prod.yml up -d${colors.reset}`);
    console.log(
      `  ${colors.cyan}docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path /var/www/certbot --email ${config.ssl.email} --agree-tos --no-eff-email -d ${config.domains.mainDomain} -d ${config.domains.frontendDomain} -d ${config.domains.backendDomain}${colors.reset}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Print Summary
// ═══════════════════════════════════════════════════════════════
function printSummary(config) {
  drawBox('Configuration Summary', { color: colors.cyan });

  console.log(`${colors.cyan}Domain Configuration:${colors.reset}`);
  printKeyValue({
    'Main Domain': config.domains.mainDomain,
    'Frontend Domain': config.domains.frontendDomain,
    'Backend Domain': config.domains.backendDomain,
  });

  console.log(`\n${colors.cyan}SSL Configuration:${colors.reset}`);
  printKeyValue({
    Email: config.ssl.email,
    'Certificate Type': config.ssl.sslType,
  });

  console.log(`\n${colors.cyan}MongoDB Configuration:${colors.reset}`);
  printKeyValue({
    Username: config.database.username,
    Password: '***',
    Database: config.database.dbName,
  });

  console.log(`\n${colors.cyan}Port Configuration:${colors.reset}`);
  printKeyValue({
    'HTTP Port': config.ports.httpPort,
    'HTTPS Port': config.ports.httpsPort,
  });

  console.log('');
}

// ═══════════════════════════════════════════════════════════════
// Print Final Instructions
// ═══════════════════════════════════════════════════════════════
function printFinalInstructions(config) {
  drawBox('Setup Complete!', { color: colors.green });

  console.log(`${colors.cyan}Access your application:${colors.reset}`);
  console.log(
    `  Frontend:    ${colors.green}https://${config.domains.frontendDomain}${colors.reset}`,
  );
  console.log(
    `  Backend:     ${colors.green}https://${config.domains.backendDomain}${colors.reset}`,
  );
  console.log(
    `  Health:      ${colors.green}https://${config.domains.backendDomain}/health${colors.reset}`,
  );

  console.log(`\n${colors.cyan}Useful commands:${colors.reset}`);
  console.log(
    `  Start services:    ${colors.green}docker compose -f docker-compose.prod.yml up -d${colors.reset}`,
  );
  console.log(
    `  View logs:         ${colors.green}docker compose -f docker-compose.prod.yml logs -f${colors.reset}`,
  );
  console.log(
    `  Stop services:     ${colors.green}docker compose -f docker-compose.prod.yml down${colors.reset}`,
  );
  console.log(
    `  Check status:      ${colors.green}docker compose -f docker-compose.prod.yml ps${colors.reset}`,
  );

  console.log(`\n${colors.cyan}Important notes:${colors.reset}`);
  if (config.ssl.sslType === 'self-signed') {
    log.warn('You are using self-signed certificates. Browsers will show security warnings.');
    log.warn('Do NOT use self-signed certificates in production!');
  }
  log.info('Make sure your DNS records point to this server.');
  log.info('Review and update the generated .env file with your secrets.');
  log.info('Configure SMTP settings for email functionality.');

  console.log('');
}

// ═══════════════════════════════════════════════════════════════
// Main Function
// ═══════════════════════════════════════════════════════════════
async function main() {
  drawBox('Production Setup', { color: colors.cyan });

  log.info('This script will configure your application for production deployment.');
  log.info('Press Ctrl+C at any time to cancel.\n');

  // Check prerequisites
  await checkPrerequisites();

  const rl = await createPrompt();

  try {
    // Get app name
    log.step('Application Configuration');
    const appName = await ask(rl, 'Application name', 'My App');

    // Gather configuration
    const domains = await configureDomains(rl);
    const ssl = await configureSSL(rl);
    const database = await configureDatabase(rl, appName);
    const ports = await configurePorts(rl);

    const config = {
      appName,
      domains,
      ssl,
      database,
      ports,
    };

    // Print summary
    printSummary(config);

    // Confirm
    const proceed = await askYesNo(rl, 'Proceed with this configuration?', false);

    if (!proceed) {
      log.warn('Setup cancelled by user.');
      rl.close();
      process.exit(0);
    }

    rl.close();

    // Apply configuration
    log.title('Applying Configuration...');

    // Create directories
    log.info('Creating directories...');
    exec('mkdir -p nginx/ssl logs/nginx', { silent: true });
    log.success('Directories created');

    // Generate .env file
    log.info('Creating .env file...');
    const envContent = generateEnvFile(config);
    const envPath = path.join(ROOT_DIR, '.env');
    if (fileExists(envPath)) {
      backupFile(envPath);
    }
    writeFile(envPath, envContent, { mode: 0o600 });
    log.success('.env file created');

    // Update Docker Compose
    log.info('Updating Docker Compose configuration...');
    updateDockerCompose(config);

    // Update Nginx config
    log.info('Updating Nginx configuration...');
    updateNginxConfig(config);

    // Generate SSL certificates
    await generateSSLCertificates(config);

    // Print final instructions
    printFinalInstructions(config);

    log.success('Production setup completed successfully!');
  } catch (error) {
    rl.close();
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run
try {
  await main();
} catch (error) {
  log.error(`Setup failed: ${error.message}`);
  process.exit(1);
}
