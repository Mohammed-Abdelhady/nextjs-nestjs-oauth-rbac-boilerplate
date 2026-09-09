import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../src');

function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        files.push(...getFiles(fullPath));
      }
    } else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

// Regex matching physical direction utilities:
// ml-, mr-, pl-, pr-, left-, right-, -left-, -right-, border-l, border-r, rounded-l, rounded-r, text-left, text-right, space-x-
const UTILITY_REGEX =
  /(?<![\w-])(?:(?<variants>(?:[\w-]+:)+))?(?<token>-?(?:left|right)-\S+|ml-\S+|mr-\S+|pl-\S+|pr-\S+|border-[lr](?:-\S+)?\b|rounded-[lr](?:-\S+)?\b|text-(?:left|right)\b|space-x-\S+)/g;

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
    .replace(/\/\/.*$/gm, (match) => ' '.repeat(match.length));
}

const files = getFiles(SRC_DIR);
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const sanitized = stripComments(content);
  const lines = sanitized.split('\n');

  lines.forEach((line, index) => {
    let match;
    UTILITY_REGEX.lastIndex = 0;
    while ((match = UTILITY_REGEX.exec(line)) !== null) {
      const full = match[0].replace(/['"`\],;}>)]+$/, '');
      const variants = (match.groups?.variants || '').split(':').filter(Boolean);
      const hasDirVariant = variants.includes('ltr') || variants.includes('rtl');

      if (!hasDirVariant) {
        violations.push({
          file: path.relative(process.cwd(), file),
          line: index + 1,
          token: full,
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(
    `Found ${violations.length} physical direction utilities without ltr:/rtl: variant:`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> ${v.token}`);
  }
  process.exit(1);
}

console.log('All direction utilities in frontend/src are RTL-safe.');
process.exit(0);
