import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const lum = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function sRgbToLinear(c) {
  const channel = c / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]) {
  return (
    0.2126 * sRgbToLinear(r) +
    0.7152 * sRgbToLinear(g) +
    0.0722 * sRgbToLinear(b)
  );
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseTokens(cssContent) {
  function extractBlock(selector) {
    const regex = new RegExp(selector + '\\s*\\{([^}]+)\\}', 's');
    const match = cssContent.match(regex);
    if (!match) return {};
    const block = match[1];
    const tokens = {};
    const varRegex = /--([a-z0-9-]+)\s*:\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%/g;
    let m;
    while ((m = varRegex.exec(block)) !== null) {
      tokens[m[1]] = [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
    }
    return tokens;
  }

  return {
    light: extractBlock(':root'),
    dark: extractBlock('\\.dark'),
  };
}

function loadCss() {
  const globalsPath = path.resolve(__dirname, '../frontend/src/app/globals.css');
  let content = fs.readFileSync(globalsPath, 'utf8');

  // Follow relative imports
  const importRegex = /@import\s+['"](\.[^'"]+)['"];/g;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    const importedPath = path.resolve(path.dirname(globalsPath), importMatch[1]);
    if (fs.existsSync(importedPath)) {
      content += '\n' + fs.readFileSync(importedPath, 'utf8');
    }
  }

  return content;
}

const pairs = [
  { token: 'foreground', background: 'background', target: 4.5 },
  { token: 'foreground', background: 'card', target: 4.5 },
  { token: 'card-foreground', background: 'card', target: 4.5 },
  { token: 'muted-foreground', background: 'background', target: 4.5 },
  { token: 'muted-foreground', background: 'card', target: 4.5 },
  { token: 'text-tertiary', background: 'background', target: 4.5 },
  { token: 'text-tertiary', background: 'card', target: 4.5 },
  { token: 'primary-foreground', background: 'primary', target: 4.5 },
  { token: 'destructive-foreground', background: 'destructive', target: 4.5 },
  { token: 'success-foreground', background: 'success', target: 4.5 },
  { token: 'warning-foreground', background: 'warning', target: 4.5 },
  { token: 'info-foreground', background: 'info', target: 4.5 },
  { token: 'status-success', background: 'background', target: 4.5 },
  { token: 'status-warning', background: 'background', target: 4.5 },
  { token: 'status-danger', background: 'background', target: 4.5 },
  { token: 'input', background: 'background', target: 3.0 },
  { token: 'ring', background: 'background', target: 3.0 },
];

function run() {
  const css = loadCss();
  const { light, dark } = parseTokens(css);

  let failedCount = 0;
  let totalCount = 0;

  function evaluateTheme(themeName, tokens) {
    console.log(`\n=== ${themeName.toUpperCase()} THEME CONTRAST AUDIT ===`);
    console.log(
      `${'Token'.padEnd(24)} ${'Background'.padEnd(16)} ${'Ratio'.padEnd(10)} ${'Target'.padEnd(8)} Status`,
    );
    console.log('-'.repeat(68));

    for (const { token, background, target } of pairs) {
      totalCount++;
      const tVal = tokens[token];
      const bgVal = tokens[background];

      if (!tVal || !bgVal) {
        console.log(
          `${token.padEnd(24)} ${background.padEnd(16)} MISSING TOKEN`,
        );
        failedCount++;
        continue;
      }

      const ratio = contrastRatio(hslToRgb(...tVal), hslToRgb(...bgVal));
      const passed = ratio >= target;
      if (!passed) {
        failedCount++;
      }

      const ratioStr = `${ratio.toFixed(2)}:1`;
      const targetStr = `>= ${target}:1`;
      const status = passed ? 'PASS' : 'FAIL';

      console.log(
        `${token.padEnd(24)} ${background.padEnd(16)} ${ratioStr.padEnd(10)} ${targetStr.padEnd(8)} ${status}`,
      );
    }
  }

  evaluateTheme('Light', light);
  evaluateTheme('Dark', dark);

  console.log('\n' + '='.repeat(68));
  console.log(
    `Result: ${totalCount - failedCount}/${totalCount} checks passed. ${failedCount} failures.`,
  );

  if (failedCount > 0) {
    process.exit(1);
  }
}

run();
