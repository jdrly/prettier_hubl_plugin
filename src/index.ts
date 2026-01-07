/**
 * Prettier Plugin for HubL
 *
 * Formats HubL (HubSpot templating language) blocks in HTML, CSS, JSX, and TSX files.
 * Uses a mask/unmask strategy to leverage Prettier's built-in HTML formatter.
 *
 * @module prettier-plugin-hubl
 */

import type { Plugin, Parser, Options, Doc } from 'prettier';
import { format as prettierFormat } from 'prettier';
import { languages } from './languages.js';
import { scanHublBlocks, type HublBlock } from './hubl/scan.js';
import { formatBlock } from './hubl/format.js';
import type { FormatOptions } from './hubl/rules.js';
import { separateBlocksPerLine, normalizeBlankLines } from './embed/unmask.js';
import { getIndentAtPosition } from './embed/indent.js';

/**
 * Stored block information for unmasking.
 */
interface StoredBlock {
  /** Placeholder ID. */
  id: string;
  /** Original HubL block. */
  block: HublBlock;
  /** Whether to skip formatting. */
  skip: boolean;
}

/**
 * Creates a unique placeholder ID.
 */
const createPlaceholderId = (counter: number): string => {
  return `HUBL${String(counter).padStart(6, '0')}`;
};

/**
 * Creates an HTML comment placeholder that Prettier will preserve inline.
 * Uses a format that won't be split across lines.
 */
const createHtmlPlaceholder = (id: string): string => {
  return `<!--${id}-->`;
};

/**
 * Checks if a HubL block is inside an HTML tag attribute.
 */
const isInsideHtmlTag = (source: string, blockStart: number): boolean => {
  let i = blockStart - 1;
  let foundLt = false;

  while (i >= 0) {
    const char = source[i];
    if (char === '>') {
      return false;
    }
    if (char === '<') {
      foundLt = true;
      break;
    }
    i--;
  }

  if (!foundLt) return false;

  const between = source.slice(i, blockStart);
  if (/^<[a-zA-Z][^>]*$/.test(between)) {
    return true;
  }

  return false;
};

/**
 * Creates format options from Prettier options.
 */
const createFormatOptions = (options: Options): FormatOptions => ({
  printWidth: options.printWidth ?? 80,
  tabWidth: options.tabWidth ?? 2,
  useTabs: options.useTabs ?? false,
});

/**
 * Result of masking operation.
 */
interface MaskResult {
  masked: string;
  blocks: Map<string, StoredBlock>;
}

/**
 * Masks HubL blocks with HTML comment placeholders.
 */
const maskHublBlocks = (source: string): MaskResult => {
  const blocks = scanHublBlocks(source);
  const storedBlocks = new Map<string, StoredBlock>();

  if (blocks.length === 0) {
    return { masked: source, blocks: storedBlocks };
  }

  // Sort by position (reverse for safe replacement)
  const sortedBlocks = [...blocks].sort((a, b) => b.start - a.start);

  let result = source;
  let counter = 0;

  for (const block of sortedBlocks) {
    const id = createPlaceholderId(counter++);
    const placeholder = createHtmlPlaceholder(id);
    const skip = isInsideHtmlTag(source, block.start);

    storedBlocks.set(id, { id, block, skip });

    result = result.slice(0, block.start) + placeholder + result.slice(block.end);
  }

  return { masked: result, blocks: storedBlocks };
};

/**
 * Placeholder regex pattern for HTML comments.
 */
const PLACEHOLDER_PATTERN = /<!--(HUBL\d{6})-->/g;

/**
 * Unmasks placeholders and replaces with formatted HubL blocks.
 */
const unmaskHublBlocks = (
  source: string,
  storedBlocks: Map<string, StoredBlock>,
  options: FormatOptions
): string => {
  // We need to process placeholders in order, tracking position changes
  let result = source;
  let offset = 0;

  // Find all placeholders with their positions
  const matches: Array<{ match: string; id: string; index: number }> = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(PLACEHOLDER_PATTERN.source, 'g');

  while ((match = regex.exec(source)) !== null) {
    matches.push({
      match: match[0],
      id: match[1],
      index: match.index,
    });
  }

  for (const { match: placeholder, id, index } of matches) {
    const stored = storedBlocks.get(id);

    if (!stored) {
      continue;
    }

    const currentIndex = index + offset;

    // Get indentation at placeholder position
    const indent = getIndentAtPosition(result, currentIndex);

    let replacement: string;

    if (stored.skip) {
      replacement = stored.block.raw;
    } else {
      // Format the block
      replacement = formatBlock(stored.block, options, indent);

      // Apply indentation to multi-line blocks (but not the first line)
      if (replacement.includes('\n')) {
        const lines = replacement.split('\n');
        replacement = lines.map((line, i) => (i === 0 ? line : indent + line)).join('\n');
      }
    }

    result =
      result.slice(0, currentIndex) +
      replacement +
      result.slice(currentIndex + placeholder.length);

    // Update offset for next replacement
    offset += replacement.length - placeholder.length;
  }

  return result;
};

/**
 * AST node for HubL content.
 */
interface HublAst {
  type: string;
  body: string;
}

/**
 * Formats HubL HTML using mask/unmask with Prettier's HTML parser.
 */
const formatHublHtml = async (text: string, options: Options): Promise<string> => {
  const formatOptions = createFormatOptions(options);

  // Step 1: Mask HubL blocks
  const { masked, blocks } = maskHublBlocks(text);

  // Step 2: Format with Prettier's HTML parser
  let formatted: string;
  try {
    formatted = await prettierFormat(masked, {
      parser: 'html',
      printWidth: options.printWidth,
      tabWidth: options.tabWidth,
      useTabs: options.useTabs,
      singleAttributePerLine: options.singleAttributePerLine,
      bracketSameLine: options.bracketSameLine,
      htmlWhitespaceSensitivity: options.htmlWhitespaceSensitivity,
    });
  } catch {
    // If HTML parsing fails, just format HubL blocks directly
    formatted = masked;
  }

  // Step 3: Unmask HubL blocks
  let result = unmaskHublBlocks(formatted, blocks, formatOptions);

  // Step 4: Post-process
  result = separateBlocksPerLine(result);
  result = normalizeBlankLines(result);

  return result;
};

/**
 * Formats HubL CSS using mask/unmask with Prettier's CSS parser.
 */
const formatHublCss = async (text: string, options: Options): Promise<string> => {
  const formatOptions = createFormatOptions(options);

  // Step 1: Mask HubL blocks with CSS comment placeholders
  const blocks = scanHublBlocks(text);
  const storedBlocks = new Map<string, StoredBlock>();
  let masked = text;
  let counter = 0;

  if (blocks.length > 0) {
    const sortedBlocks = [...blocks].sort((a, b) => b.start - a.start);

    for (const block of sortedBlocks) {
      const id = createPlaceholderId(counter++);
      const placeholder = `/*${id}*/`;
      const skip = false; // CSS doesn't have attribute context like HTML

      storedBlocks.set(id, { id, block, skip });

      masked = masked.slice(0, block.start) + placeholder + masked.slice(block.end);
    }
  }

  // Step 2: Format with Prettier's CSS parser
  let formatted: string;
  try {
    formatted = await prettierFormat(masked, {
      parser: 'css',
      printWidth: options.printWidth,
      tabWidth: options.tabWidth,
      useTabs: options.useTabs,
    });
  } catch {
    formatted = masked;
  }

  // Step 3: Unmask CSS comment placeholders
  const CSS_PLACEHOLDER_PATTERN = /\/\*(HUBL\d{6})\*\//g;

  let result = formatted;
  let offset = 0;

  const matches: Array<{ match: string; id: string; index: number }> = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(CSS_PLACEHOLDER_PATTERN.source, 'g');

  while ((match = regex.exec(formatted)) !== null) {
    matches.push({
      match: match[0],
      id: match[1],
      index: match.index,
    });
  }

  for (const { match: placeholder, id, index } of matches) {
    const stored = storedBlocks.get(id);

    if (!stored) {
      continue;
    }

    const currentIndex = index + offset;
    const indent = getIndentAtPosition(result, currentIndex);
    let replacement = formatBlock(stored.block, formatOptions, indent);

    if (replacement.includes('\n')) {
      const lines = replacement.split('\n');
      replacement = lines.map((line, i) => (i === 0 ? line : indent + line)).join('\n');
    }

    result =
      result.slice(0, currentIndex) +
      replacement +
      result.slice(currentIndex + placeholder.length);

    offset += replacement.length - placeholder.length;
  }

  // Step 4: Post-process
  result = separateBlocksPerLine(result);
  result = normalizeBlankLines(result);

  return result;
};

/**
 * Parser for HubL HTML files.
 */
const hublHtmlParser: Parser<HublAst> = {
  parse: (text: string, _options: Options): HublAst => {
    return {
      type: 'hubl-html-root',
      body: text,
    };
  },
  astFormat: 'hubl-html-ast',
  locStart: () => 0,
  locEnd: (node: HublAst) => node.body.length,
  preprocess: async (text: string, options: Options): Promise<string> => {
    return formatHublHtml(text, options);
  },
};

/**
 * Parser for HubL CSS files.
 */
const hublCssParser: Parser<HublAst> = {
  parse: (text: string, _options: Options): HublAst => {
    return {
      type: 'hubl-css-root',
      body: text,
    };
  },
  astFormat: 'hubl-css-ast',
  locStart: () => 0,
  locEnd: (node: HublAst) => node.body.length,
  preprocess: async (text: string, options: Options): Promise<string> => {
    return formatHublCss(text, options);
  },
};

/**
 * Printer for HubL HTML AST.
 */
const hublHtmlPrinter = {
  print: (path: { getValue: () => HublAst }): Doc => {
    const node = path.getValue();
    return node.body;
  },
};

/**
 * Printer for HubL CSS AST.
 */
const hublCssPrinter = {
  print: (path: { getValue: () => HublAst }): Doc => {
    const node = path.getValue();
    return node.body;
  },
};

/**
 * Prettier plugin for HubL.
 */
const plugin: Plugin<HublAst> = {
  languages,
  parsers: {
    'hubl-html': hublHtmlParser,
    'hubl-css': hublCssParser,
  },
  printers: {
    'hubl-html-ast': hublHtmlPrinter,
    'hubl-css-ast': hublCssPrinter,
  },
};

// Named exports
export { languages };
export const parsers = plugin.parsers;
export const printers = plugin.printers;

// Default export for Prettier
export default plugin;
