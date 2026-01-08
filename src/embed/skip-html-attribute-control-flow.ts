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
 * Represents a string/attribute value span in the source.
 */
interface AttributeValueSpan {
  /** Start position of opening quote. */
  readonly start: number;
  /** End position after closing quote. */
  readonly end: number;
}

/**
 * Finds all attribute value spans (strings) inside HTML tags.
 * These are the positions of content between quotes in attributes.
 *
 * @param source - The source code.
 * @returns Array of attribute value spans.
 */
const findAttributeValueSpans = (source: string): AttributeValueSpan[] => {
  const spans: AttributeValueSpan[] = [];
  let i = 0;

  while (i < source.length) {
    // Look for '<' that starts a tag
    if (source[i] === '<') {
      // Skip closing tags, comments, doctype
      if (source[i + 1] === '/' || source.slice(i, i + 4) === '<!--' || source.slice(i, i + 2).toLowerCase() === '<!') {
        i++;
        continue;
      }

      // Check if it looks like a tag name
      const tagNameMatch = source.slice(i + 1).match(/^[a-zA-Z][a-zA-Z0-9-]*/);
      if (!tagNameMatch) {
        i++;
        continue;
      }

      // Scan through the tag looking for attribute values
      let j = i + 1 + tagNameMatch[0].length;

      while (j < source.length) {
        const char = source[j];

        // Skip HubL blocks
        if (source.slice(j, j + 2) === '{%' || source.slice(j, j + 2) === '{{' || source.slice(j, j + 2) === '{#') {
          const closeMap: Record<string, string> = { '%': '%}', '{': '}}', '#': '#}' };
          const next = source[j + 1];
          const closeTag = closeMap[next] || '%}';
          let k = j + 2;
          let nestedString = false;
          let nestedQuote = '';
          while (k < source.length) {
            if (!nestedString) {
              if (source[k] === '"' || source[k] === "'") {
                nestedString = true;
                nestedQuote = source[k];
              } else if (source.slice(k, k + 2) === closeTag) {
                j = k + 2;
                break;
              }
            } else if (source[k] === nestedQuote) {
              nestedString = false;
            }
            k++;
          }
          if (k >= source.length) j++;
          continue;
        }

        // Found a quote - this is an attribute value
        if (char === '"' || char === "'") {
          const quote = char;
          const valueStart = j; // Include the opening quote position
          j++;

          // Find the closing quote, accounting for HubL blocks inside
          while (j < source.length) {
            // Skip HubL blocks inside the attribute value
            if (source.slice(j, j + 2) === '{%' || source.slice(j, j + 2) === '{{' || source.slice(j, j + 2) === '{#') {
              const closeMap: Record<string, string> = { '%': '%}', '{': '}}', '#': '#}' };
              const next = source[j + 1];
              const closeTag = closeMap[next] || '%}';
              let k = j + 2;
              let nestedStr = false;
              let nestedQ = '';
              while (k < source.length) {
                if (!nestedStr) {
                  if (source[k] === '"' || source[k] === "'") {
                    nestedStr = true;
                    nestedQ = source[k];
                  } else if (source.slice(k, k + 2) === closeTag) {
                    j = k + 2;
                    break;
                  }
                } else if (source[k] === nestedQ) {
                  nestedStr = false;
                }
                k++;
              }
              if (k >= source.length) j++;
              continue;
            }

            if (source[j] === quote) {
              // Found closing quote
              spans.push({ start: valueStart, end: j + 1 });
              j++;
              break;
            }
            j++;
          }
          continue;
        }

        // Found end of tag
        if (char === '>') {
          i = j + 1;
          break;
        }

        j++;
      }

      if (j >= source.length) break;
      continue;
    }

    i++;
  }

  return spans;
};

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
 * Checks if a HubL block is inside an HTML attribute value.
 *
 * @param block - The HubL block.
 * @param spans - Array of attribute value spans.
 * @returns True if the block is inside an attribute value.
 */
const isInsideAttributeValue = (
  block: HublBlock,
  spans: AttributeValueSpan[]
): boolean => {
  for (const span of spans) {
    // Block is inside if its start is after the opening quote
    // and its end is before the closing quote
    if (block.start > span.start && block.end < span.end) {
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
 * Blocks are marked for skipping when:
 * 1. They are inside HTML attribute values (all block types)
 * 2. Control flow blocks inside HTML start tags (for attribute-building patterns)
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
  const attributeSpans = findAttributeValueSpans(source);

  return blocks.map((block) => {
    // ALL blocks inside attribute values should skip (not just control flow)
    // because HTML comments can't exist inside attribute values
    if (isInsideAttributeValue(block, attributeSpans)) {
      return {
        block,
        skip: true,
        reason: 'Inside HTML attribute value',
      };
    }

    // Control flow blocks inside HTML tags (but outside attribute values)
    // should also skip to preserve attribute-building patterns
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
