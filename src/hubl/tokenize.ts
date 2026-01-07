/**
 * HubL Tokenizer - Lightweight tokenization for HubL block content.
 *
 * Provides enough understanding to format `{% module ... %}` and normalize
 * other tags safely without being a full HubL compiler.
 *
 * @module hubl/tokenize
 */

/** Token types supported by the tokenizer. */
export type TokenType =
  | 'identifier'
  | 'string'
  | 'number'
  | 'boolean'
  | 'operator'
  | 'punctuation'
  | 'whitespace'
  | 'unknown';

/**
 * Represents a single token in HubL block content.
 */
export interface Token {
  /** The type of token. */
  readonly type: TokenType;
  /** The raw text value of the token. */
  readonly value: string;
  /** Start position in the input string. */
  readonly start: number;
  /** End position in the input string (exclusive). */
  readonly end: number;
}

/** Regular expressions for token matching. */
const TOKEN_PATTERNS = {
  whitespace: /^\s+/,
  // Identifiers: letters, underscores, and can contain numbers after first char
  identifier: /^[a-zA-Z_][a-zA-Z0-9_]*/,
  // Numbers: integers and floats
  number: /^-?\d+(?:\.\d+)?/,
  // Single-quoted string
  singleQuotedString: /^'(?:[^'\\]|\\.)*'/,
  // Double-quoted string
  doubleQuotedString: /^"(?:[^"\\]|\\.)*"/,
  // Multi-char operators
  multiCharOperator: /^(?:==|!=|<=|>=|<>|\|\||&&|\/\/|\*\*)/,
  // Single char operators
  singleCharOperator: /^[+\-*/%<>=!|&~^]/,
  // Punctuation
  punctuation: /^[.,:()\[\]{}]/,
};

/** Keywords that are boolean values. */
const BOOLEAN_KEYWORDS = new Set(['true', 'false', 'True', 'False']);

/**
 * Tokenizes the inner content of a HubL block.
 *
 * @param input - The inner content of a HubL block (without delimiters).
 * @returns Array of tokens.
 *
 * @example
 * ```typescript
 * const tokens = tokenize('module "Name" path="./path" no_wrapper=True');
 * // Returns tokens for: identifier, whitespace, string, whitespace, ...
 * ```
 */
export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    let matched = false;

    // Try whitespace first
    const wsMatch = input.slice(pos).match(TOKEN_PATTERNS.whitespace);
    if (wsMatch) {
      tokens.push({
        type: 'whitespace',
        value: wsMatch[0],
        start: pos,
        end: pos + wsMatch[0].length,
      });
      pos += wsMatch[0].length;
      matched = true;
      continue;
    }

    // Try single-quoted string
    const sqMatch = input.slice(pos).match(TOKEN_PATTERNS.singleQuotedString);
    if (sqMatch) {
      tokens.push({
        type: 'string',
        value: sqMatch[0],
        start: pos,
        end: pos + sqMatch[0].length,
      });
      pos += sqMatch[0].length;
      matched = true;
      continue;
    }

    // Try double-quoted string
    const dqMatch = input.slice(pos).match(TOKEN_PATTERNS.doubleQuotedString);
    if (dqMatch) {
      tokens.push({
        type: 'string',
        value: dqMatch[0],
        start: pos,
        end: pos + dqMatch[0].length,
      });
      pos += dqMatch[0].length;
      matched = true;
      continue;
    }

    // Try identifier (must check before number to handle things like "true")
    const idMatch = input.slice(pos).match(TOKEN_PATTERNS.identifier);
    if (idMatch) {
      const value = idMatch[0];
      const type: TokenType = BOOLEAN_KEYWORDS.has(value)
        ? 'boolean'
        : 'identifier';
      tokens.push({
        type,
        value,
        start: pos,
        end: pos + value.length,
      });
      pos += value.length;
      matched = true;
      continue;
    }

    // Try number
    const numMatch = input.slice(pos).match(TOKEN_PATTERNS.number);
    if (numMatch) {
      tokens.push({
        type: 'number',
        value: numMatch[0],
        start: pos,
        end: pos + numMatch[0].length,
      });
      pos += numMatch[0].length;
      matched = true;
      continue;
    }

    // Try multi-char operator
    const multiOpMatch = input
      .slice(pos)
      .match(TOKEN_PATTERNS.multiCharOperator);
    if (multiOpMatch) {
      tokens.push({
        type: 'operator',
        value: multiOpMatch[0],
        start: pos,
        end: pos + multiOpMatch[0].length,
      });
      pos += multiOpMatch[0].length;
      matched = true;
      continue;
    }

    // Try single char operator
    const singleOpMatch = input
      .slice(pos)
      .match(TOKEN_PATTERNS.singleCharOperator);
    if (singleOpMatch) {
      tokens.push({
        type: 'operator',
        value: singleOpMatch[0],
        start: pos,
        end: pos + singleOpMatch[0].length,
      });
      pos += singleOpMatch[0].length;
      matched = true;
      continue;
    }

    // Try punctuation
    const punctMatch = input.slice(pos).match(TOKEN_PATTERNS.punctuation);
    if (punctMatch) {
      tokens.push({
        type: 'punctuation',
        value: punctMatch[0],
        start: pos,
        end: pos + punctMatch[0].length,
      });
      pos += punctMatch[0].length;
      matched = true;
      continue;
    }

    // Unknown character - consume one char
    if (!matched) {
      tokens.push({
        type: 'unknown',
        value: input[pos],
        start: pos,
        end: pos + 1,
      });
      pos++;
    }
  }

  return tokens;
};

/**
 * Filters out whitespace tokens from a token array.
 *
 * @param tokens - Array of tokens.
 * @returns Array of non-whitespace tokens.
 */
export const filterWhitespace = (tokens: Token[]): Token[] => {
  return tokens.filter((t) => t.type !== 'whitespace');
};

/**
 * Checks if a token array contains commas (used for comma preservation).
 *
 * @param tokens - Array of tokens.
 * @returns True if any comma punctuation is present.
 */
export const hasCommas = (tokens: Token[]): boolean => {
  return tokens.some((t) => t.type === 'punctuation' && t.value === ',');
};

/**
 * Represents a parsed module argument.
 */
export interface ModuleArg {
  /** The argument name (e.g., 'path', 'no_wrapper'). */
  readonly name: string;
  /** The argument value (string/number/boolean/null for bare flags). */
  readonly value: string | null;
  /** Whether this arg was followed by a comma in the original. */
  readonly hasTrailingComma: boolean;
  /** Whether this is a bare flag (e.g., 'enable' without '='). */
  readonly isBareFlag: boolean;
}

/**
 * Parses module arguments from tokens.
 *
 * Handles:
 * - Named arguments: `path="./path"`, `no_wrapper=True`
 * - Bare flags: `enable`
 * - Preserves comma information
 *
 * @param tokens - Array of tokens (can include whitespace).
 * @returns Array of parsed module arguments.
 *
 * @example
 * ```typescript
 * const args = parseModuleArgs(tokenize('module "Name" path="./path" enable, no_wrapper=True'));
 * // Returns: [
 * //   { name: '"Name"', value: null, isBareFlag: true, hasTrailingComma: false },
 * //   { name: 'path', value: '"./path"', isBareFlag: false, hasTrailingComma: false },
 * //   { name: 'enable', value: null, isBareFlag: true, hasTrailingComma: true },
 * //   { name: 'no_wrapper', value: 'True', isBareFlag: false, hasTrailingComma: false }
 * // ]
 * ```
 */
export const parseModuleArgs = (tokens: Token[]): ModuleArg[] => {
  const filtered = filterWhitespace(tokens);
  const args: ModuleArg[] = [];

  // Skip 'module' keyword
  let i = 0;
  if (filtered[0]?.type === 'identifier' && filtered[0].value === 'module') {
    i = 1;
  }

  while (i < filtered.length) {
    const token = filtered[i];

    // Skip commas (but note them for the previous arg)
    if (token.type === 'punctuation' && token.value === ',') {
      if (args.length > 0) {
        const lastArg = args[args.length - 1];
        args[args.length - 1] = { ...lastArg, hasTrailingComma: true };
      }
      i++;
      continue;
    }

    // Handle string as module name (first arg is typically the module name)
    if (token.type === 'string' && args.length === 0) {
      args.push({
        name: token.value,
        value: null,
        hasTrailingComma: false,
        isBareFlag: true,
      });
      i++;
      continue;
    }

    // Handle identifier (could be named arg or bare flag)
    if (token.type === 'identifier') {
      const nextToken = filtered[i + 1];

      // Check if it's a named argument (followed by '=')
      if (nextToken?.type === 'operator' && nextToken.value === '=') {
        const valueToken = filtered[i + 2];
        if (valueToken) {
          args.push({
            name: token.value,
            value: valueToken.value,
            hasTrailingComma: false,
            isBareFlag: false,
          });
          i += 3;
          continue;
        }
      }

      // It's a bare flag
      args.push({
        name: token.value,
        value: null,
        hasTrailingComma: false,
        isBareFlag: true,
      });
      i++;
      continue;
    }

    // Handle boolean as bare value (shouldn't normally happen but safe)
    if (token.type === 'boolean') {
      args.push({
        name: token.value,
        value: null,
        hasTrailingComma: false,
        isBareFlag: true,
      });
      i++;
      continue;
    }

    // Skip other tokens
    i++;
  }

  return args;
};

/**
 * Extracts the keyword from a statement block's inner content.
 *
 * @param innerContent - The inner content of the statement (without delimiters).
 * @returns The keyword (e.g., 'if', 'for', 'module', 'set').
 */
export const extractStatementKeyword = (innerContent: string): string => {
  const trimmed = innerContent.trim();
  const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
  return match ? match[1] : '';
};
