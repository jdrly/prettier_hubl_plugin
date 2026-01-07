/**
 * HubL Scanner - Detects and extracts HubL blocks from source code.
 *
 * Scans for:
 * - Statement blocks: `{% ... %}`
 * - Expression blocks: `{{ ... }}`
 * - Comment blocks: `{# ... #}`
 *
 * @module hubl/scan
 */

/** The type of HubL block detected. */
export type HublBlockType = 'statement' | 'expression' | 'comment';

/**
 * Represents a single HubL block found in source code.
 */
export interface HublBlock {
  /** The type of HubL block. */
  readonly type: HublBlockType;
  /** Start offset in the source string. */
  readonly start: number;
  /** End offset in the source string (exclusive). */
  readonly end: number;
  /** Raw text of the block including delimiters. */
  readonly raw: string;
}

/**
 * Configuration for the opening and closing delimiters of HubL blocks.
 */
interface DelimiterConfig {
  readonly open: string;
  readonly close: string;
  readonly type: HublBlockType;
}

/** All supported HubL delimiter configurations. */
const DELIMITERS: readonly DelimiterConfig[] = [
  { open: '{%', close: '%}', type: 'statement' },
  { open: '{{', close: '}}', type: 'expression' },
  { open: '{#', close: '#}', type: 'comment' },
];


/**
 * Finds the closing delimiter for a HubL block, handling nested strings.
 *
 * @param source - The source string.
 * @param startPos - Position after the opening delimiter.
 * @param closeDelim - The closing delimiter to find.
 * @returns Position of the closing delimiter, or -1 if not found.
 */
const findClosingDelimiter = (
  source: string,
  startPos: number,
  closeDelim: string
): number => {
  let pos = startPos;
  let inString = false;
  let quote = '';
  let escaped = false;

  while (pos < source.length) {
    const char = source[pos];

    if (escaped) {
      escaped = false;
      pos++;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      pos++;
      continue;
    }

    if (!inString) {
      // Check for closing delimiter
      if (source.slice(pos, pos + closeDelim.length) === closeDelim) {
        return pos;
      }

      // Check for string start
      if (char === '"' || char === "'") {
        inString = true;
        quote = char;
      }
    } else if (char === quote) {
      inString = false;
      quote = '';
    }

    pos++;
  }

  return -1;
};

/**
 * Scans source code for HubL blocks.
 *
 * @param source - The source string to scan.
 * @returns Array of HubL blocks found in the source.
 *
 * @example
 * ```typescript
 * const blocks = scanHublBlocks('Hello {% if true %}World{% endif %}!');
 * // Returns: [
 * //   { type: 'statement', start: 6, end: 19, raw: '{% if true %}' },
 * //   { type: 'statement', start: 24, end: 36, raw: '{% endif %}' }
 * // ]
 * ```
 */
export const scanHublBlocks = (source: string): HublBlock[] => {
  const blocks: HublBlock[] = [];
  let pos = 0;

  while (pos < source.length) {
    let found = false;

    for (const delim of DELIMITERS) {
      if (source.slice(pos, pos + delim.open.length) === delim.open) {
        const closePos = findClosingDelimiter(
          source,
          pos + delim.open.length,
          delim.close
        );

        if (closePos !== -1) {
          const end = closePos + delim.close.length;
          blocks.push({
            type: delim.type,
            start: pos,
            end,
            raw: source.slice(pos, end),
          });
          pos = end;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      pos++;
    }
  }

  return blocks;
};

/**
 * Extracts the inner content of a HubL block (without delimiters).
 *
 * @param block - The HubL block.
 * @returns The inner content without opening/closing delimiters.
 *
 * @example
 * ```typescript
 * const inner = getBlockInnerContent({ raw: '{% if true %}', ... });
 * // Returns: ' if true '
 * ```
 */
export const getBlockInnerContent = (block: HublBlock): string => {
  const { raw, type } = block;

  switch (type) {
    case 'statement':
      return raw.slice(2, -2); // Remove {% and %}
    case 'expression':
      return raw.slice(2, -2); // Remove {{ and }}
    case 'comment':
      return raw.slice(2, -2); // Remove {# and #}
    default:
      return raw;
  }
};

/**
 * Checks if a block is a control flow statement (if, for, else, etc.).
 *
 * @param block - The HubL block to check.
 * @returns True if the block is a control flow statement.
 */
export const isControlFlowBlock = (block: HublBlock): boolean => {
  if (block.type !== 'statement') {
    return false;
  }

  const inner = getBlockInnerContent(block).trim();
  const controlFlowKeywords = [
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
  ];

  for (const keyword of controlFlowKeywords) {
    if (
      inner === keyword ||
      inner.startsWith(keyword + ' ') ||
      inner.startsWith(keyword + '\t') ||
      inner.startsWith(keyword + '\n')
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if a block is a module statement.
 *
 * @param block - The HubL block to check.
 * @returns True if the block is a module statement.
 */
export const isModuleBlock = (block: HublBlock): boolean => {
  if (block.type !== 'statement') {
    return false;
  }

  const inner = getBlockInnerContent(block).trim();
  return (
    inner.startsWith('module ') ||
    inner.startsWith('module\t') ||
    inner.startsWith('module\n')
  );
};
