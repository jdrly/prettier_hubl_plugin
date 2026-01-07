/**
 * HubL Formatting Rules - Defines formatting behavior for different HubL constructs.
 *
 * @module hubl/rules
 */

import type { ModuleArg } from './tokenize.js';

/**
 * Options for HubL formatting, typically derived from Prettier options.
 */
export interface FormatOptions {
  /** Maximum line width before wrapping (from Prettier printWidth). */
  readonly printWidth: number;
  /** Number of spaces per indentation level (from Prettier tabWidth). */
  readonly tabWidth: number;
  /** Use tabs instead of spaces for indentation. */
  readonly useTabs: boolean;
}

/** Default formatting options. */
export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
};

/**
 * Creates an indentation string based on options.
 *
 * @param level - Number of indentation levels.
 * @param options - Format options.
 * @returns The indentation string.
 */
export const createIndent = (level: number, options: FormatOptions): string => {
  if (options.useTabs) {
    return '\t'.repeat(level);
  }
  return ' '.repeat(level * options.tabWidth);
};

/**
 * Normalizes whitespace in a string, collapsing multiple spaces/tabs/newlines to single spaces.
 * Preserves content inside quoted strings.
 *
 * @param input - Input string.
 * @returns Normalized string.
 */
export const normalizeWhitespace = (input: string): string => {
  const result: string[] = [];
  let inString = false;
  let quote = '';
  let escaped = false;
  let lastWasWhitespace = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escaped) {
      result.push(char);
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result.push(char);
      escaped = true;
      lastWasWhitespace = false;
      continue;
    }

    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        quote = char;
        result.push(char);
        lastWasWhitespace = false;
      } else if (/\s/.test(char)) {
        if (!lastWasWhitespace) {
          result.push(' ');
          lastWasWhitespace = true;
        }
      } else {
        result.push(char);
        lastWasWhitespace = false;
      }
    } else {
      result.push(char);
      if (char === quote) {
        inString = false;
        quote = '';
      }
    }
  }

  return result.join('').trim();
};

/**
 * Checks if formatted content fits within printWidth.
 *
 * @param content - The formatted content.
 * @param baseIndent - The base indentation string.
 * @param options - Format options.
 * @returns True if content fits on one line.
 */
export const fitsOnOneLine = (
  content: string,
  baseIndent: string,
  options: FormatOptions
): boolean => {
  const totalLength = baseIndent.length + content.length;
  return totalLength <= options.printWidth;
};

/**
 * Formats module arguments for single-line output.
 *
 * @param args - Parsed module arguments.
 * @returns Formatted argument string.
 */
export const formatModuleArgsSingleLine = (args: ModuleArg[]): string => {
  return args
    .map((arg) => {
      let str = '';

      if (arg.isBareFlag) {
        str = arg.name;
      } else {
        str = `${arg.name}=${arg.value}`;
      }

      // Add comma if original had one
      if (arg.hasTrailingComma) {
        str += ',';
      }

      return str;
    })
    .join(' ');
};

/**
 * Formats module arguments for multi-line output.
 *
 * @param args - Parsed module arguments.
 * @param baseIndent - The base indentation for the module tag.
 * @param options - Format options.
 * @returns Formatted multi-line argument string (without first arg on same line as 'module').
 */
export const formatModuleArgsMultiLine = (
  args: ModuleArg[],
  baseIndent: string,
  options: FormatOptions
): string => {
  if (args.length === 0) return '';

  const argIndent = baseIndent + createIndent(1, options);
  const lines: string[] = [];

  // First arg (module name) stays on same line as 'module'
  const firstArg = args[0];
  let firstLine = '';
  if (firstArg.isBareFlag) {
    firstLine = firstArg.name;
  } else {
    firstLine = `${firstArg.name}=${firstArg.value}`;
  }

  // Remaining args go on separate lines
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    let line = '';

    if (arg.isBareFlag) {
      line = arg.name;
    } else {
      line = `${arg.name}=${arg.value}`;
    }

    // Add comma if original had one
    if (arg.hasTrailingComma) {
      line += ',';
    }

    lines.push(argIndent + line);
  }

  // Return first arg (for same line as module) and rest (for new lines)
  return [firstLine, ...lines].join('\n');
};

/**
 * Determines if module should be formatted multi-line.
 *
 * @param singleLineContent - The single-line formatted content.
 * @param baseIndent - Base indentation.
 * @param options - Format options.
 * @returns True if should use multi-line format.
 */
export const shouldUseMultiLine = (
  singleLineContent: string,
  baseIndent: string,
  options: FormatOptions
): boolean => {
  return !fitsOnOneLine(singleLineContent, baseIndent, options);
};

/**
 * Keywords that are control flow statements.
 */
export const CONTROL_FLOW_KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'endif',
  'for',
  'endfor',
  'unless',
  'endunless',
  'while',
  'endwhile',
  'switch',
  'case',
  'default',
  'endswitch',
  'break',
  'continue',
]);

/**
 * Keywords that define blocks (for indentation context).
 */
export const BLOCK_KEYWORDS = new Set([
  'block',
  'endblock',
  'macro',
  'endmacro',
  'call',
  'endcall',
  'filter',
  'endfilter',
  'raw',
  'endraw',
]);

/**
 * Checks if a keyword is a control flow keyword.
 *
 * @param keyword - The keyword to check.
 * @returns True if it's a control flow keyword.
 */
export const isControlFlowKeyword = (keyword: string): boolean => {
  return CONTROL_FLOW_KEYWORDS.has(keyword);
};

/**
 * Checks if a keyword is a block keyword.
 *
 * @param keyword - The keyword to check.
 * @returns True if it's a block keyword.
 */
export const isBlockKeyword = (keyword: string): boolean => {
  return BLOCK_KEYWORDS.has(keyword);
};
