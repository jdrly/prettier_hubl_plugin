/**
 * HubL Unmasking - Replaces placeholders with formatted HubL blocks.
 *
 * After Prettier formats the host language (HTML/CSS/JS), we replace the
 * placeholders back with formatted HubL blocks.
 *
 * @module embed/unmask
 */

import { formatBlock } from '../hubl/format.js';
import { type FormatOptions, DEFAULT_FORMAT_OPTIONS } from '../hubl/rules.js';
import { type MaskedBlock } from './mask.js';
import { applyIndent, getIndentAtPosition } from './indent.js';

/**
 * Options for unmasking operation.
 */
export interface UnmaskOptions extends FormatOptions {
  /** Whether to format HubL blocks (false = reinsert raw). */
  readonly format?: boolean;
}

/**
 * Unmaskes a source string by replacing placeholders with formatted HubL.
 *
 * @param maskedSource - Source with placeholders.
 * @param blockMap - Map of placeholder IDs to block info.
 * @param options - Unmask and format options.
 * @returns Source with HubL blocks restored.
 *
 * @example
 * ```typescript
 * const result = unmaskHublBlocks(
 *   '<div><!--__HUBL_0000__--></div>',
 *   blockMap,
 *   { printWidth: 80, tabWidth: 2 }
 * );
 * // Returns: '<div>{% if true %}</div>'
 * ```
 */
export const unmaskHublBlocks = (
  maskedSource: string,
  blockMap: Map<string, MaskedBlock>,
  options: UnmaskOptions = DEFAULT_FORMAT_OPTIONS
): string => {
  if (blockMap.size === 0) {
    return maskedSource;
  }

  let result = maskedSource;

  // Process each placeholder
  for (const [_id, maskedBlock] of blockMap) {
    const { placeholder, block, skip } = maskedBlock;

    // Find the placeholder in the result
    const placeholderIndex = result.indexOf(placeholder);
    if (placeholderIndex === -1) {
      // Placeholder not found - might have been removed by formatter
      // This shouldn't happen normally, but we handle it gracefully
      continue;
    }

    // Get the current indentation at the placeholder position
    const currentIndent = getIndentAtPosition(result, placeholderIndex);

    // Determine what to insert
    let replacement: string;

    if (skip || options.format === false) {
      // Reinsert original raw block
      replacement = block.raw;
    } else {
      // Format the block
      const formatted = formatBlock(block, options, currentIndent);
      // Apply indentation to multi-line formatted content
      replacement = applyIndent(formatted, currentIndent);
    }

    // Replace placeholder with replacement
    result =
      result.slice(0, placeholderIndex) +
      replacement +
      result.slice(placeholderIndex + placeholder.length);
  }

  return result;
};

/**
 * Separates multiple HubL blocks that are on the same line.
 *
 * This is a post-processing step to ensure "one block per line" rule.
 *
 * @param source - Source with HubL blocks.
 * @returns Source with blocks separated onto individual lines.
 */
export const separateBlocksPerLine = (source: string): string => {
  // Pattern to find multiple HubL blocks on the same line
  // Match: %} followed by whitespace (not newline) then {% or {{
  const multiBlockPattern = /(%}|}}|#})([ \t]+)(\{[%{#])/g;

  return source.replace(multiBlockPattern, (_match, closer, _space, opener) => {
    return `${closer}\n${opener}`;
  });
};

/**
 * Cleans up extra blank lines between HubL blocks.
 *
 * @param source - Source code.
 * @returns Source with normalized blank lines.
 */
export const normalizeBlankLines = (source: string): string => {
  // Collapse multiple blank lines to single blank line
  return source.replace(/\n{3,}/g, '\n\n');
};

/**
 * Complete unmask and post-process pipeline.
 *
 * @param maskedSource - Source with placeholders.
 * @param blockMap - Map of placeholder IDs to block info.
 * @param options - Unmask and format options.
 * @returns Fully processed source.
 */
export const unmaskAndPostProcess = (
  maskedSource: string,
  blockMap: Map<string, MaskedBlock>,
  options: UnmaskOptions = DEFAULT_FORMAT_OPTIONS
): string => {
  // Step 1: Unmask placeholders with formatted blocks
  let result = unmaskHublBlocks(maskedSource, blockMap, options);

  // Step 2: Separate multiple blocks per line
  result = separateBlocksPerLine(result);

  // Step 3: Normalize blank lines
  result = normalizeBlankLines(result);

  return result;
};
