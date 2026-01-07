/**
 * Prettier Plugin for HubL
 *
 * Formats HubL (HubSpot templating language) blocks in HTML, CSS, JSX, and TSX files.
 *
 * @module prettier-plugin-hubl
 *
 * @example
 * ```json
 * // .prettierrc
 * {
 *   "plugins": ["prettier-plugin-hubl"],
 *   "printWidth": 80,
 *   "tabWidth": 2
 * }
 * ```
 */

import type { Plugin, Parser, Printer, Options, AstPath, Doc } from 'prettier';
import { languages } from './languages.js';
import type { MaskResult } from './embed/mask.js';
import type { FormatOptions } from './hubl/rules.js';
import { scanHublBlocks } from './hubl/scan.js';
import { formatBlock } from './hubl/format.js';
import { separateBlocksPerLine, normalizeBlankLines } from './embed/unmask.js';

/**
 * Extended AST node that includes masked block information.
 */
interface HublAst {
  type: 'hubl-root';
  body: string;
  maskResult: MaskResult | null;
  originalSource: string;
}

/**
 * Creates format options from Prettier options.
 *
 * @param options - Prettier options.
 * @returns HubL format options.
 */
const createFormatOptions = (options: Options): FormatOptions => ({
  printWidth: options.printWidth ?? 80,
  tabWidth: options.tabWidth ?? 2,
  useTabs: options.useTabs ?? false,
});

/**
 * Formats HubL blocks in source code directly (for JSX/TSX embedded content).
 *
 * @param source - Source code with HubL blocks.
 * @param options - Format options.
 * @returns Formatted source.
 */
const formatHublInSource = (source: string, options: FormatOptions): string => {
  const blocks = scanHublBlocks(source);

  if (blocks.length === 0) {
    return source;
  }

  // Sort blocks by position (reverse order for safe replacement)
  const sortedBlocks = [...blocks].sort((a, b) => b.start - a.start);

  let result = source;

  for (const block of sortedBlocks) {
    const formatted = formatBlock(block, options, '');
    result = result.slice(0, block.start) + formatted + result.slice(block.end);
  }

  // Post-process: separate blocks and normalize
  result = separateBlocksPerLine(result);
  result = normalizeBlankLines(result);

  return result;
};

/**
 * Parser for HubL HTML files.
 *
 * Uses mask/unmask strategy:
 * 1. Mask HubL blocks with HTML comments
 * 2. Let Prettier's HTML parser handle the structure
 * 3. Unmask and format HubL blocks
 */
const hublHtmlParser: Parser<HublAst> = {
  parse: (text: string, options: Options): HublAst => {
    // For simple MVP, we do direct transformation
    const formatOptions = createFormatOptions(options);
    const formatted = formatHublInSource(text, formatOptions);

    return {
      type: 'hubl-root',
      body: formatted,
      maskResult: null,
      originalSource: text,
    };
  },
  astFormat: 'hubl-ast',
  locStart: () => 0,
  locEnd: (node: HublAst) => node.body.length,
};

/**
 * Parser for HubL CSS files.
 */
const hublCssParser: Parser<HublAst> = {
  parse: (text: string, options: Options): HublAst => {
    const formatOptions = createFormatOptions(options);
    const formatted = formatHublInSource(text, formatOptions);

    return {
      type: 'hubl-root',
      body: formatted,
      maskResult: null,
      originalSource: text,
    };
  },
  astFormat: 'hubl-ast',
  locStart: () => 0,
  locEnd: (node: HublAst) => node.body.length,
};

/**
 * Printer for HubL AST.
 *
 * Simply returns the pre-formatted body.
 */
const hublPrinter: Printer<HublAst> = {
  print: (path: AstPath<HublAst>): Doc => {
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
    'hubl-ast': hublPrinter,
  },
};

// Named exports
export { languages };
export const parsers = plugin.parsers;
export const printers = plugin.printers;

// Default export for Prettier
export default plugin;
