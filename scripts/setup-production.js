#!/usr/bin/env node

/**
 * Production Setup Script
 *
 * Interactive CLI to configure the application for production deployment.
 * Handles domain configuration, SSL certificates, Docker, and environment setup.
 *
 * Usage: node scripts/setup-production.js
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  colors,
  log,
  drawBox,
  writeFile,
  fileExists,
  backupFile,
  validateAppName,
  commandExists,
  exec,
  createPrompt,
  askRequired,
  askYesNo,
  ROOT_DIR,
} from './lib/cli-utils.js';
import {
  generateEnvFile,
  generateSSLCertificates,
  updateDockerCompose,
  updateNginxConfig,
} from './lib/production-files.js';
import {
  configureDatabase,
  configureDomains,
  configurePorts,
  configureSSL,
} from './lib/production-prompts.js';
import { printFinalInstructions, printSummary } from './lib/production-summary.js';

const REQUIRED_COMMANDS = ['docker', 'openssl'];

// ═══════════════════════════════════════════════════════════════
// Prerequisite Checks
// ═══════════════════════════════════════════════════════════════
async function checkPrerequisites() {
  log.step('Checking prerequisites...');

  const missing = [];

  for (const cmd of REQUIRED_COMMANDS) {
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
    const appName = await askRequired(rl, 'Application name', (value) => {
      if (!validateAppName(value)) {
        log.error('Use letters, numbers, spaces, dots, hyphens or underscores (max 64)');
        return false;
      }
      return true;
    });

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
    fs.mkdirSync(path.join(ROOT_DIR, 'nginx', 'ssl'), { recursive: true });
    fs.mkdirSync(path.join(ROOT_DIR, 'logs', 'nginx'), { recursive: true });
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
