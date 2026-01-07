/**
 * HubL Masking - Replaces HubL blocks with placeholders for host language formatting.
 *
 * Before running Prettier's HTML/CSS/JS formatters, we replace HubL blocks with
 * valid placeholder syntax that won't confuse the host parser:
 * - HTML: HTML comments like __HUBL_0001__
 * - CSS: CSS comments like __HUBL_0001__
 * - JS/TS: Plain text __HUBL_0001__ inside template literals
 *
 * @module embed/mask
 */

import { type HublBlock, scanHublBlocks } from '../hubl/scan.js';
import { detectSkipBlocks } from './skip-html-attribute-control-flow.js';
import { getIndentAtPosition } from './indent.js';

/** Supported host language types. */
export type HostLanguage = 'html' | 'css' | 'js' | 'ts' | 'jsx' | 'tsx';

/**
 * Information stored for each masked HubL block.
 */
export interface MaskedBlock {
  /** The placeholder ID (e.g., '__HUBL_0001__'). */
  readonly id: string;
  /** The full placeholder as inserted (e.g., '<!--__HUBL_0001__-->'). */
  readonly placeholder: string;
  /** The original HubL block. */
  readonly block: HublBlock;
  /** Whether to skip formatting (reinsert verbatim). */
  readonly skip: boolean;
  /** Reason for skipping. */
  readonly skipReason?: string;
  /** Base indentation at the block's position. */
  readonly baseIndent: string;
}

/**
 * Result of masking operation.
 */
export interface MaskResult {
  /** The masked source code. */
  readonly maskedSource: string;
  /** Map of placeholder IDs to masked block info. */
  readonly blockMap: Map<string, MaskedBlock>;
}

/**
 * Creates a placeholder ID.
 *
 * @param index - Block index.
 * @returns Placeholder ID string.
 */
const createPlaceholderId = (index: number): string => {
  return `__HUBL_${String(index).padStart(4, '0')}__`;
};

/**
 * Creates a full placeholder string for the host language.
 *
 * @param id - Placeholder ID.
 * @param language - Host language.
 * @returns Full placeholder string.
 */
const createPlaceholder = (id: string, language: HostLanguage): string => {
  switch (language) {
    case 'html':
      return `<!--${id}-->`;
    case 'css':
      return `/*${id}*/`;
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return id;
    default:
      return `<!--${id}-->`;
  }
};

/**
 * Masks HubL blocks in source code with placeholders.
 *
 * @param source - Original source code.
 * @param language - Host language type.
 * @returns Mask result with masked source and block map.
 */
export const maskHublBlocks = (
  source: string,
  language: HostLanguage
): MaskResult => {
  const blocks = scanHublBlocks(source);

  if (blocks.length === 0) {
    return {
      maskedSource: source,
      blockMap: new Map(),
    };
  }

  // Detect which blocks should skip formatting
  const skipResults = detectSkipBlocks(source, blocks);

  const blockMap = new Map<string, MaskedBlock>();
  let result = '';
  let lastEnd = 0;

  skipResults.forEach((skipResult, index) => {
    const { block, skip, reason } = skipResult;
    const id = createPlaceholderId(index);
    const placeholder = createPlaceholder(id, language);

    // Add content before this block
    result += source.slice(lastEnd, block.start);

    // Get base indentation at this position
    const baseIndent = getIndentAtPosition(source, block.start);

    // Store block info
    blockMap.set(id, {
      id,
      placeholder,
      block,
      skip,
      skipReason: reason,
      baseIndent,
    });

    // Add placeholder
    result += placeholder;

    lastEnd = block.end;
  });

  // Add remaining content
  result += source.slice(lastEnd);

  return {
    maskedSource: result,
    blockMap,
  };
};

/**
 * Extracts the language from a file extension.
 *
 * @param filepath - File path or extension.
 * @returns Host language type.
 */
export const getLanguageFromPath = (filepath: string): HostLanguage => {
  const lower = filepath.toLowerCase();

  if (lower.endsWith('.hubl.html') || lower.endsWith('.html')) {
    return 'html';
  }

  if (lower.endsWith('.hubl.css') || lower.endsWith('.css')) {
    return 'css';
  }

  if (lower.endsWith('.tsx')) {
    return 'tsx';
  }

  if (lower.endsWith('.jsx')) {
    return 'jsx';
  }

  if (lower.endsWith('.ts')) {
    return 'ts';
  }

  if (lower.endsWith('.js')) {
    return 'js';
  }

  // Default to HTML
  return 'html';
};
