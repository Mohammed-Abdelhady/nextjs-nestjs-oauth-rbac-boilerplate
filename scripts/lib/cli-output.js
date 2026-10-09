/**
 * CLI output: colours, log lines, boxes, spinner and tables.
 */

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
