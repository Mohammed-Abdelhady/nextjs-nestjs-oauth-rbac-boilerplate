import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import { INPUT_BASE_CLASSES } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  CODE_ENTRY_FONT_SIZE,
  FORM_STYLES,
  getInputClassName,
  RECOVERY_CODE_FONT_SIZE,
  TEXT_CONTROL_FONT_SIZE,
} from './form-styles';

const MIN_PHONE_TEXT_SIZE_PX = 16;
const ROOT_FONT_SIZE_PX = 16;
const CONTROL_STYLES = [
  ...Object.entries(FORM_STYLES).flatMap(([name, style]) =>
    typeof style === 'string' ? [] : [[`shared ${name}`, style.base] as const],
  ),
  ['Input / Textarea / SelectTrigger / SearchBar', TEXT_CONTROL_FONT_SIZE] as const,
];

// Compile configuration data with the app's real theme, without rendering markup.
async function fontSizeAtWidth(style: string, width: number): Promise<number> {
  const stylesheet = fileURLToPath(new URL('../../app/globals.css', import.meta.url));
  const compiler = await compile(readFileSync(stylesheet, 'utf8'), {
    base: dirname(stylesheet),
    loadStylesheet: async (id, base) => {
      const path =
        id === 'tailwindcss'
          ? fileURLToPath(import.meta.resolve('tailwindcss/index.css'))
          : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  const css = postcss.parse(compiler.build(style.split(/\s+/)));
  const variables = new Map<string, string>();
  css.walkDecls(/^--/, (declaration) => {
    variables.set(declaration.prop, declaration.value);
  });
  const pixels = (value: string): number => {
    const variable = /^var\((--[\w-]+)\)$/.exec(value);
    const resolved = variable ? variables.get(variable[1]) : value;
    const dimension = /^(\d*\.?\d+)(rem|px)$/.exec(resolved ?? '');
    if (!dimension) throw new Error(`Unsupported font dimension: ${value}`);
    return Number(dimension[1]) * (dimension[2] === 'rem' ? ROOT_FONT_SIZE_PX : 1);
  };
  let fontSize = Number.NaN;
  css.walkDecls('font-size', (declaration) => {
    // Only emitted utilities belong to this configuration, not Preflight's resets.
    if (
      declaration.parent?.type !== 'rule' ||
      !declaration.parent.selector.startsWith('.') ||
      declaration.parent.selector.includes('::')
    )
      return;
    let parent: postcss.AnyNode | undefined = declaration.parent.parent;
    while (parent) {
      if (parent.type === 'atrule' && parent.name === 'media') {
        const minimumWidth = /^\(width >= ([\d.]+(?:rem|px))\)$/.exec(parent.params);
        if (!minimumWidth) throw new Error(`Unsupported media query: ${parent.params}`);
        if (width < pixels(minimumWidth[1])) return;
      }
      parent = parent.parent;
    }
    fontSize = pixels(declaration.value);
  });
  return fontSize;
}

describe.each(CONTROL_STYLES)('%s font size configuration', (_name, style) => {
  it.each([0, 420, 767])('meets the phone font-size minimum at a width of %i px', async (width) => {
    expect(await fontSizeAtWidth(style, width)).toBeGreaterThanOrEqual(MIN_PHONE_TEXT_SIZE_PX);
  });

  it.each([768, 769, 1024])('preserves the desktop size at a width of %i px', async (width) => {
    expect(await fontSizeAtWidth(style, width)).toBe(14);
  });
});

const MERGED_FONT_TOKENS: ReadonlyArray<{
  name: string;
  fontSize: string;
  cases: ReadonlyArray<readonly [width: number, expectedSize: number]>;
}> = [
  {
    name: 'TEXT_CONTROL_FONT_SIZE',
    fontSize: TEXT_CONTROL_FONT_SIZE,
    cases: [
      [420, 16],
      [767, 16],
      [768, 14],
      [1024, 14],
    ],
  },
  {
    name: 'CODE_ENTRY_FONT_SIZE',
    fontSize: CODE_ENTRY_FONT_SIZE,
    cases: [
      [420, 24],
      [767, 24],
      [768, 24],
      [1024, 24],
    ],
  },
  {
    name: 'RECOVERY_CODE_FONT_SIZE',
    fontSize: RECOVERY_CODE_FONT_SIZE,
    cases: [
      [420, 18],
      [767, 18],
      [768, 18],
      [1024, 18],
    ],
  },
] as const;

describe.each(MERGED_FONT_TOKENS)('$name merged font size', ({ fontSize, cases }) => {
  it.each(cases)('resolves at %i px to %i px', async (width, expectedSize) => {
    const formStyle = cn(getInputClassName(), fontSize);
    const mergedStyle = cn(INPUT_BASE_CLASSES, formStyle);
    expect(await fontSizeAtWidth(mergedStyle, width)).toBe(expectedSize);
  });
});
