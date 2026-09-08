/**
 * CLI Utilities
 * Shared utilities for CLI scripts
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..', '..');

// ═══════════════════════════════════════════════════════════════
// ANSI Colors
// ═══════════════════════════════════════════════════════════════
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Background
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// ═══════════════════════════════════════════════════════════════
// Logging Utilities
// ═══════════════════════════════════════════════════════════════
export const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.bright}${colors.blue}▸${colors.reset} ${colors.bright}${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`),
  debug: (msg) => process.env.DEBUG && console.log(`${colors.dim}[DEBUG] ${msg}${colors.reset}`),
  divider: () => console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`),
};

// ═══════════════════════════════════════════════════════════════
// Box Drawing
// ═══════════════════════════════════════════════════════════════
export function drawBox(title, options = {}) {
  const { width = 64, color = colors.cyan } = options;
  const padding = Math.max(0, width - title.length - 4);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;

  console.log(`
${colors.bright}${color}╔${'═'.repeat(width - 2)}╗
║${' '.repeat(leftPad)} ${title} ${' '.repeat(rightPad)}║
╚${'═'.repeat(width - 2)}╝${colors.reset}
`);
}

// ═══════════════════════════════════════════════════════════════
// String Utilities
// ═══════════════════════════════════════════════════════════════
export function toKebabCase(str) {
  return str
    .replaceAll(/([a-z])([A-Z])/g, '$1-$2')
    .replaceAll(/[\s_]+/g, '-')
    .toLowerCase();
}

export function toSnakeCase(str) {
  return str
    .replaceAll(/([a-z])([A-Z])/g, '$1_$2')
    .replaceAll(/[\s-]+/g, '_')
    .toLowerCase();
}

export function toPascalCase(str) {
  return str
    .replaceAll(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

export function toTitleCase(str) {
  return str.replaceAll(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

// ═══════════════════════════════════════════════════════════════
// File Utilities
// ═══════════════════════════════════════════════════════════════
export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

export function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function writeFile(filePath, content, options = {}) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, options);
  if (typeof options === 'object' && options !== null && options.mode !== undefined) {
    fs.chmodSync(filePath, options.mode);
  }
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

export function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Validation Utilities
// ═══════════════════════════════════════════════════════════════
export function validateDomain(domain) {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

export function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function validatePort(port) {
  const portNum = Number.parseInt(port, 10);
  return !Number.isNaN(portNum) && portNum >= 1 && portNum <= 65535;
}

export function validateMongoUri(uri) {
  return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
}

// ═══════════════════════════════════════════════════════════════
// Command Execution
// ═══════════════════════════════════════════════════════════════
export function commandExists(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function exec(command, options = {}) {
  const { silent = false, cwd = ROOT_DIR } = options;
  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit',
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function execAsync(command, options = {}) {
  const { cwd = ROOT_DIR } = options;
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// Prompt Utilities
// ═══════════════════════════════════════════════════════════════
export async function createPrompt() {
  return readline.createInterface({ input, output });
}

export async function ask(rl, question, defaultValue = '') {
  const defaultHint = defaultValue ? ` ${colors.dim}(${defaultValue})${colors.reset}` : '';
  const answer = await rl.question(`${colors.cyan}?${colors.reset} ${question}${defaultHint}: `);
  return answer.trim() || defaultValue;
}

export async function askRequired(rl, question, validator = null, errorMsg = 'This field is required') {
  while (true) {
    const answer = await rl.question(`${colors.cyan}?${colors.reset} ${question}: `);
    const trimmed = answer.trim();

    if (!trimmed) {
      log.error(errorMsg);
      continue;
    }

    if (validator && !validator(trimmed)) {
      continue;
    }

    return trimmed;
  }
}

export async function askYesNo(rl, question, defaultValue = false) {
  const defaultHint = defaultValue ? 'Y/n' : 'y/N';
  const answer = await rl.question(`${colors.cyan}?${colors.reset} ${question} ${colors.dim}(${defaultHint})${colors.reset}: `);
  const trimmed = answer.trim().toLowerCase();

  if (!trimmed) return defaultValue;
  return trimmed === 'y' || trimmed === 'yes';
}

export async function askChoice(rl, question, choices) {
  console.log(`\n${colors.cyan}?${colors.reset} ${question}`);

  choices.forEach((choice, index) => {
    console.log(`  ${colors.cyan}${index + 1})${colors.reset} ${choice.label}${choice.hint ? ` ${colors.dim}(${choice.hint})${colors.reset}` : ''}`);
  });

  while (true) {
    const answer = await rl.question(`${colors.cyan}?${colors.reset} Enter choice ${colors.dim}(1-${choices.length})${colors.reset}: `);
    const choiceNum = Number.parseInt(answer.trim(), 10);

    if (choiceNum >= 1 && choiceNum <= choices.length) {
      return choices[choiceNum - 1].value;
    }

    log.error(`Invalid choice. Please enter a number between 1 and ${choices.length}.`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Progress Spinner (simple)
// ═══════════════════════════════════════════════════════════════
export function createSpinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let intervalId = null;

  return {
    start() {
      process.stdout.write(`${colors.cyan}${frames[0]}${colors.reset} ${text}`);
      intervalId = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.write(`\r${colors.cyan}${frames[i]}${colors.reset} ${text}`);
      }, 80);
    },
    stop(success = true) {
      if (intervalId) {
        clearInterval(intervalId);
        const icon = success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
        process.stdout.write(`\r${icon} ${text}\n`);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Table Utilities
// ═══════════════════════════════════════════════════════════════
export function printTable(data, options = {}) {
  const { headers = [], minWidth = 20 } = options;

  if (headers.length > 0) {
    console.log(
      headers.map((h) => `${colors.bright}${h.padEnd(minWidth)}${colors.reset}`).join('')
    );
    console.log(colors.dim + '─'.repeat(headers.length * minWidth) + colors.reset);
  }

  data.forEach((row) => {
    console.log(row.map((cell) => String(cell).padEnd(minWidth)).join(''));
  });
}

export function printKeyValue(data, options = {}) {
  const { keyWidth = 20, indent = 2 } = options;
  const prefix = ' '.repeat(indent);

  Object.entries(data).forEach(([key, value]) => {
    const displayValue = value === '' || value === undefined ? colors.dim + '(not set)' + colors.reset : colors.green + value + colors.reset;
    console.log(`${prefix}${key.padEnd(keyWidth)}${displayValue}`);
  });
}
