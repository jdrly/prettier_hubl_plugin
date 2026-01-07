/**
 * HubL Formatter - Core formatting logic for HubL blocks.
 *
 * Provides formatting functions for:
 * - Statement blocks `{% ... %}`
 * - Expression blocks `{{ ... }}`
 * - Comment blocks `{# ... #}`
 *
 * @module hubl/format
 */

import {
  tokenize,
  parseModuleArgs,
  extractStatementKeyword,
} from './tokenize.js';
import {
  type FormatOptions,
  DEFAULT_FORMAT_OPTIONS,
  normalizeWhitespace,
  formatModuleArgsSingleLine,
  formatModuleArgsMultiLine,
  shouldUseMultiLine,
} from './rules.js';
import type { HublBlock } from './scan.js';

/**
 * Formats a HubL expression block `{{ ... }}`.
 *
 * Normalizes whitespace while preserving string content.
 *
 * @param raw - The raw expression block including delimiters.
 * @param options - Formatting options.
 * @param baseIndent - Base indentation string.
 * @returns Formatted expression block.
 *
 * @example
 * ```typescript
 * formatExpression('{{   content.title   }}', options, '');
 * // Returns: '{{ content.title }}'
 * ```
 */
export const formatExpression = (
  raw: string,
  _options: FormatOptions = DEFAULT_FORMAT_OPTIONS,
  _baseIndent: string = ''
): string => {
  // Extract inner content (without {{ and }})
  const inner = raw.slice(2, -2);
  const normalized = normalizeWhitespace(inner);
  return `{{ ${normalized} }}`;
};

/**
 * Formats a HubL comment block `{# ... #}`.
 *
 * Normalizes whitespace while preserving content.
 *
 * @param raw - The raw comment block including delimiters.
 * @param options - Formatting options.
 * @param baseIndent - Base indentation string.
 * @returns Formatted comment block.
 *
 * @example
 * ```typescript
 * formatComment('{#   This is a comment   #}', options, '');
 * // Returns: '{# This is a comment #}'
 * ```
 */
export const formatComment = (
  raw: string,
  _options: FormatOptions = DEFAULT_FORMAT_OPTIONS,
  _baseIndent: string = ''
): string => {
  // Extract inner content (without {# and #})
  const inner = raw.slice(2, -2);
  const normalized = normalizeWhitespace(inner);
  return `{# ${normalized} #}`;
};

/**
 * Formats a module statement block `{% module ... %}`.
 *
 * Applies special formatting rules:
 * - Single line if fits within printWidth
 * - Multi-line with indented args if too long
 * - Preserves commas only if present in original
 *
 * @param raw - The raw module block including delimiters.
 * @param options - Formatting options.
 * @param baseIndent - Base indentation string.
 * @returns Formatted module block.
 */
const formatModuleStatement = (
  raw: string,
  options: FormatOptions,
  baseIndent: string
): string => {
  const inner = raw.slice(2, -2);
  const tokens = tokenize(inner);
  const args = parseModuleArgs(tokens);

  if (args.length === 0) {
    return `{% module %}`;
  }

  // Try single-line format first
  const argsStr = formatModuleArgsSingleLine(args);
  const singleLine = `{% module ${argsStr} %}`;

  if (!shouldUseMultiLine(singleLine, baseIndent, options)) {
    return singleLine;
  }

  // Use multi-line format
  const multiLineArgs = formatModuleArgsMultiLine(args, baseIndent, options);
  const lines = multiLineArgs.split('\n');

  if (lines.length === 1) {
    return `{% module ${lines[0]} %}`;
  }

  // First arg on same line as 'module', rest on new lines, closing %} on its own line
  const firstArg = lines[0];
  const restArgs = lines.slice(1);

  return `{% module ${firstArg}\n${restArgs.join('\n')}\n%}`;
};

/**
 * Formats a general statement block `{% ... %}`.
 *
 * For non-module statements, applies whitespace normalization.
 *
 * @param raw - The raw statement block including delimiters.
 * @param options - Formatting options.
 * @param baseIndent - Base indentation string.
 * @returns Formatted statement block.
 *
 * @example
 * ```typescript
 * formatStatement('{% if   condition %}', options, '');
 * // Returns: '{% if condition %}'
 * ```
 */
export const formatStatement = (
  raw: string,
  options: FormatOptions = DEFAULT_FORMAT_OPTIONS,
  baseIndent: string = ''
): string => {
  const inner = raw.slice(2, -2);
  const keyword = extractStatementKeyword(inner);

  // Special handling for module statements
  if (keyword === 'module') {
    return formatModuleStatement(raw, options, baseIndent);
  }

  // For other statements, normalize whitespace
  const normalized = normalizeWhitespace(inner);
  return `{% ${normalized} %}`;
};

/**
 * Formats a HubL block based on its type.
 *
 * @param block - The HubL block to format.
 * @param options - Formatting options.
 * @param baseIndent - Base indentation string.
 * @returns Formatted block string.
 */
export const formatBlock = (
  block: HublBlock,
  options: FormatOptions = DEFAULT_FORMAT_OPTIONS,
  baseIndent: string = ''
): string => {
  switch (block.type) {
    case 'statement':
      return formatStatement(block.raw, options, baseIndent);
    case 'expression':
      return formatExpression(block.raw, options, baseIndent);
    case 'comment':
      return formatComment(block.raw, options, baseIndent);
    default:
      return block.raw;
  }
};

/**
 * Options for formatting HubL source code.
 */
export interface FormatSourceOptions extends FormatOptions {
  /** Whether to skip formatting (return original). */
  readonly skip?: boolean;
}

/**
 * Formats HubL source code, ensuring one block per line.
 *
 * @param source - Source code containing HubL blocks.
 * @param blocks - Detected HubL blocks.
 * @param options - Formatting options.
 * @returns Formatted source code.
 */
export const formatHublSource = (
  source: string,
  blocks: HublBlock[],
  options: FormatOptions = DEFAULT_FORMAT_OPTIONS
): string => {
  if (blocks.length === 0) {
    return source;
  }

  const result: string[] = [];
  let lastEnd = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Add content before this block
    const before = source.slice(lastEnd, block.start);
    result.push(before);

    // Format and add the block
    // Determine base indent from the content before
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineContent = before.slice(lineStart);
    const indentMatch = lineContent.match(/^(\s*)/);
    const baseIndent = indentMatch ? indentMatch[1] : '';

    const formatted = formatBlock(block, options, baseIndent);
    result.push(formatted);

    lastEnd = block.end;
  }

  // Add remaining content after last block
  result.push(source.slice(lastEnd));

  return result.join('');
};
