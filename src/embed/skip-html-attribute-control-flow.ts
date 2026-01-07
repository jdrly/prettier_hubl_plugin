/**
 * Skip HTML Attribute Control Flow - Detects HubL control flow inside HTML start tags.
 *
 * When HubL control flow (`{% if %}`, `{% else %}`, etc.) appears inside an HTML
 * start tag (for attribute-building patterns), we skip formatting to avoid
 * breaking the HTML structure.
 *
 * @module embed/skip-html-attribute-control-flow
 *
 * @example
 * ```html
 * <!-- This pattern should NOT be reformatted -->
 * <a
 *   href="{{ blog.absolute_url }}"
 *   {% if not tag %}class="..."
 *   {% else %}class="..."
 *   {% endif %}
 * >All</a>
 * ```
 */

import { type HublBlock, isControlFlowBlock } from '../hubl/scan.js';

/**
 * Represents a detected HTML start tag in the source.
 */
interface HtmlStartTag {
  /** Start position of '<'. */
  readonly start: number;
  /** End position after '>'. */
  readonly end: number;
  /** Whether the tag is self-closing. */
  readonly selfClosing: boolean;
}

/**
 * Finds all HTML start tags in the source code.
 *
 * @param source - The source code.
 * @returns Array of HTML start tag positions.
 */
const findHtmlStartTags = (source: string): HtmlStartTag[] => {
  const tags: HtmlStartTag[] = [];
  let i = 0;

  while (i < source.length) {
    // Look for '<' that starts a tag (not a closing tag or comment)
    if (source[i] === '<') {
      // Skip closing tags
      if (source[i + 1] === '/') {
        i++;
        continue;
      }

      // Skip comments
      if (source.slice(i, i + 4) === '<!--') {
        i++;
        continue;
      }

      // Skip doctype
      if (source.slice(i, i + 2).toLowerCase() === '<!') {
        i++;
        continue;
      }

      // Check if it looks like a tag name
      const tagNameMatch = source.slice(i + 1).match(/^[a-zA-Z][a-zA-Z0-9-]*/);
      if (!tagNameMatch) {
        i++;
        continue;
      }

      // Find the closing '>' for this tag
      const tagStart = i;
      let j = i + 1 + tagNameMatch[0].length;
      let inString = false;
      let quote = '';
      let escaped = false;

      while (j < source.length) {
        const char = source[j];

        if (escaped) {
          escaped = false;
          j++;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          j++;
          continue;
        }

        if (!inString) {
          if (char === '"' || char === "'") {
            inString = true;
            quote = char;
            j++;
            continue;
          }

          // Check for HubL block start - skip over it
          if (source.slice(j, j + 2) === '{%') {
            // Find matching %}
            let k = j + 2;
            let nestedString = false;
            let nestedQuote = '';
            while (k < source.length) {
              if (!nestedString) {
                if (source[k] === '"' || source[k] === "'") {
                  nestedString = true;
                  nestedQuote = source[k];
                } else if (source.slice(k, k + 2) === '%}') {
                  j = k + 2;
                  break;
                }
              } else if (source[k] === nestedQuote) {
                nestedString = false;
              }
              k++;
            }
            if (k >= source.length) {
              j++;
            }
            continue;
          }

          // Check for expression block start - skip over it
          if (source.slice(j, j + 2) === '{{') {
            let k = j + 2;
            let nestedString = false;
            let nestedQuote = '';
            while (k < source.length) {
              if (!nestedString) {
                if (source[k] === '"' || source[k] === "'") {
                  nestedString = true;
                  nestedQuote = source[k];
                } else if (source.slice(k, k + 2) === '}}') {
                  j = k + 2;
                  break;
                }
              } else if (source[k] === nestedQuote) {
                nestedString = false;
              }
              k++;
            }
            if (k >= source.length) {
              j++;
            }
            continue;
          }

          if (char === '>') {
            const selfClosing = source[j - 1] === '/';
            tags.push({
              start: tagStart,
              end: j + 1,
              selfClosing,
            });
            i = j + 1;
            break;
          }
        } else if (char === quote) {
          inString = false;
          quote = '';
        }

        j++;
      }

      if (j >= source.length) {
        // Unclosed tag, stop looking
        break;
      }

      continue;
    }

    i++;
  }

  return tags;
};

/**
 * Checks if a HubL block is inside an HTML start tag.
 *
 * @param block - The HubL block.
 * @param tags - Array of HTML start tags.
 * @returns True if the block is inside an HTML start tag.
 */
const isInsideHtmlStartTag = (
  block: HublBlock,
  tags: HtmlStartTag[]
): boolean => {
  for (const tag of tags) {
    if (block.start >= tag.start && block.end <= tag.end) {
      return true;
    }
  }
  return false;
};

/**
 * Result of skip detection for a HubL block.
 */
export interface SkipDetectionResult {
  /** The HubL block. */
  readonly block: HublBlock;
  /** Whether this block should skip formatting. */
  readonly skip: boolean;
  /** Reason for skipping (for debugging). */
  readonly reason?: string;
}

/**
 * Detects which HubL blocks should skip formatting.
 *
 * Control flow blocks inside HTML start tags are marked for skipping
 * to preserve the attribute-building pattern.
 *
 * @param source - The source code.
 * @param blocks - Detected HubL blocks.
 * @returns Array of blocks with skip detection results.
 */
export const detectSkipBlocks = (
  source: string,
  blocks: HublBlock[]
): SkipDetectionResult[] => {
  const htmlTags = findHtmlStartTags(source);

  return blocks.map((block) => {
    // Only control flow blocks inside HTML tags should skip
    if (isControlFlowBlock(block) && isInsideHtmlStartTag(block, htmlTags)) {
      return {
        block,
        skip: true,
        reason: 'Control flow inside HTML start tag',
      };
    }

    return {
      block,
      skip: false,
    };
  });
};

/**
 * Checks if any blocks in a range should skip formatting.
 *
 * When one control flow block in an HTML tag is skipped, we should skip
 * the entire control flow chain (if/elif/else/endif).
 *
 * @param source - The source code.
 * @param blocks - Detected HubL blocks.
 * @returns Map of block indices to skip status.
 */
export const detectSkipBlocksWithChain = (
  source: string,
  blocks: HublBlock[]
): Map<number, SkipDetectionResult> => {
  const results = detectSkipBlocks(source, blocks);
  const resultMap = new Map<number, SkipDetectionResult>();

  // First pass: detect individual skips
  results.forEach((result, index) => {
    resultMap.set(index, result);
  });

  // We could add chain detection here in the future
  // For now, individual detection is sufficient

  return resultMap;
};
