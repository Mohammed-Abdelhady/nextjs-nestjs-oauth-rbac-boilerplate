const EXPRESSION_PREFIXES = new Set([
  '(', '[', '{', '=', ':', ',', ';', '!', '?', '+', '-', '*', '&', '|',
  'return', 'throw', 'yield', 'await', 'case', 'else', 'do', '=>',
]);
const CONTROL_STATEMENTS = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);

function tokensOf(source) {
  const tokens = [];
  const add = (value, literal = false) => tokens.push({ value, literal });
  function expressionStart() {
    if (!tokens.length || EXPRESSION_PREFIXES.has(tokens.at(-1).value)) return true;
    if (tokens.at(-1).value !== ')') return false;
    let depth = 0;
    for (let index = tokens.length - 1; index >= 0; index--) {
      if (tokens[index].value === ')') depth++;
      if (tokens[index].value === '(' && --depth === 0)
        return CONTROL_STATEMENTS.has(tokens[index - 1]?.value);
    }
    return false;
  }

  function stringAt(start, quote) {
    let index = start + 1;
    for (; index < source.length; index++) {
      if (source[index] === '\\') {
        index++;
        continue;
      }
      if (source[index] === quote) break;
    }
    const value = source.slice(start + 1, index).replace(/\\(['"`\\])/g, '$1');
    add(value, true);
    return index + 1;
  }

  function templateAt(start) {
    let index = start + 1;
    let interpolated = false;
    for (; index < source.length; index++) {
      if (source[index] === '\\') {
        index++;
        continue;
      }
      if (source[index] === '`') break;
      if (source.startsWith('${', index)) {
        interpolated = true;
        add('{');
        index = codeAt(index + 2, true) - 1;
        add('}');
      }
    }
    if (!interpolated) add(source.slice(start + 1, index), true);
    return index + 1;
  }

  function regexAt(start) {
    let index = start + 1;
    let characterClass = false;
    for (; index < source.length; index++) {
      const char = source[index];
      if (char === '\\') {
        index++;
        continue;
      }
      if (char === '[') characterClass = true;
      if (char === ']') characterClass = false;
      if (char === '/' && !characterClass) break;
    }
    while (/[a-z]/i.test(source[index + 1] ?? '')) index++;
    add('/regex/');
    return index + 1;
  }

  function tagAt(start) {
    let index = start + 1;
    let angles = 1;
    for (; index < source.length; index++) {
      const char = source[index];
      if (char === '"' || char === "'") {
        index = stringAt(index, char) - 1;
        continue;
      }
      if (char === '{') {
        index = codeAt(index + 1, true) - 1;
        continue;
      }
      if (char === '<') angles++;
      if (char === '>' && --angles === 0) break;
    }
    return index + 1;
  }

  function jsxAt(start) {
    let index = start;
    let depth = 0;
    do {
      if (source[index] === '<') {
        const closing = source[index + 1] === '/';
        const end = tagAt(index);
        const selfClosing = source[end - 2] === '/';
        depth += closing ? -1 : selfClosing ? 0 : 1;
        index = end;
      } else if (source[index] === '{') {
        add('{');
        index = codeAt(index + 1, true);
        add('}');
      } else index++;
    } while (index < source.length && depth > 0);
    add('<jsx>');
    return index;
  }

  function isJsx(start) {
    if (!expressionStart()) return false;
    const tag = source.slice(start).match(/^<([A-Za-z][\w.:-]*|>)/)?.[1];
    if (!tag) return false;
    if (tag === '>') return true;
    const end = source.indexOf('>', start);
    return source[end - 1] === '/' || source.includes(`</${tag}`, end);
  }

  function codeAt(start, stopAtBrace = false) {
    let index = start;
    let braces = 0;
    while (index < source.length) {
      const char = source[index];
      if (/\s/.test(char)) {
        index++;
        continue;
      }
      if (source.startsWith('//', index)) {
        const end = source.indexOf('\n', index);
        index = end === -1 ? source.length : end + 1;
        continue;
      }
      if (source.startsWith('/*', index)) {
        const end = source.indexOf('*/', index + 2);
        index = end === -1 ? source.length : end + 2;
        continue;
      }
      if (char === '"' || char === "'") {
        index = stringAt(index, char);
        continue;
      }
      if (char === '`') {
        index = templateAt(index);
        continue;
      }
      if (char === '/' && expressionStart()) {
        index = regexAt(index);
        continue;
      }
      if (char === '<' && isJsx(index)) {
        index = jsxAt(index);
        continue;
      }
      if (char === '{') braces++;
      if (char === '}') {
        if (stopAtBrace && braces === 0) return index + 1;
        braces--;
      }
      const word = source.slice(index).match(/^[\w$]+|^=>/)?.[0] ?? char;
      add(word);
      index += word.length;
    }
    return index;
  }

  codeAt(0);
  return tokens;
}

export function packageImports(source) {
  const tokens = tokensOf(source);
  const imports = new Set();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.literal || tokens[index - 1]?.value === '.') continue;
    let literal;
    if (token.value === 'from') literal = tokens[index + 1];
    if (token.value === 'import')
      literal = tokens[index + 1]?.value === '(' ? tokens[index + 2] : tokens[index + 1];
    if (token.value === 'require') {
      if (tokens[index + 1]?.value === '(') literal = tokens[index + 2];
      if (
        tokens[index + 1]?.value === '.' &&
        tokens[index + 2]?.value === 'resolve' &&
        tokens[index + 3]?.value === '('
      )
        literal = tokens[index + 4];
    }
    if (literal?.literal) imports.add(literal.value);
  }
  return [...imports];
}
