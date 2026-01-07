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
 * Also handles inline control flow with content between blocks.
 *
 * @param source - Source with HubL blocks.
 * @returns Source with blocks separated onto individual lines.
 */
export const separateBlocksPerLine = (source: string): string => {
  let result = source;

  // Pattern 1: Multiple blocks with only whitespace between them
  // Match: %} followed by whitespace (not newline) then {% or {{
  const multiBlockPattern = /(%}|}}|#})([ \t]+)(\{[%{#])/g;
  result = result.replace(multiBlockPattern, (_match, closer, _space, opener) => {
    return `${closer}\n${opener}`;
  });

  // Pattern 2: Control flow with content - {% if %}content{% else %}content{% endif %}
  // Split content between control flow blocks onto separate lines
  result = splitControlFlowContent(result);

  // Pattern 3: Indent content between control flow blocks
  result = indentControlFlowContent(result);

  return result;
};

/**
 * Indents content lines that are between control flow blocks.
 * This handles the case where content is already on its own line
 * but needs to be indented relative to the surrounding blocks.
 *
 * @param source - Source code.
 * @returns Source with properly indented content.
 */
const indentControlFlowContent = (source: string): string => {
  const lines = source.split('\n');
  const resultLines: string[] = [];

  // Track nesting level for control flow
  let inControlFlow = false;
  let controlFlowIndent = '';
  let indentUnit = '    ';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect control flow openers: {% if %}, {% for %}, etc.
    if (/^\{%\s*(?:if|for|unless|while)\b/.test(trimmed)) {
      const leadingIndent = line.match(/^(\s*)/)?.[1] || '';
      controlFlowIndent = leadingIndent;
      indentUnit = detectIndentUnit(leadingIndent);
      inControlFlow = true;
      resultLines.push(line);
      continue;
    }

    // Detect control flow closers: {% endif %}, {% endfor %}, etc.
    if (/^\{%\s*end(?:if|for|unless|while)\s*%}/.test(trimmed)) {
      inControlFlow = false;
      resultLines.push(line);
      continue;
    }

    // Detect middle blocks: {% else %}, {% elif %}
    if (/^\{%\s*(?:else|elif)\b/.test(trimmed)) {
      resultLines.push(line);
      continue;
    }

    // If we're inside control flow and this is a content line
    if (inControlFlow && trimmed.length > 0) {
      const leadingIndent = line.match(/^(\s*)/)?.[1] || '';

      // Check if this is content that should be indented:
      // - Plain text
      // - HubL expressions {{ }}
      // - HubL comments {# #}
      // NOT: HubL statements {% %} (control flow) or HTML tags
      const isIndentableContent =
        !trimmed.startsWith('{%') &&
        !trimmed.startsWith('<') &&
        !trimmed.startsWith('</');

      // Check if content is at same indent level as control flow
      if (isIndentableContent && leadingIndent === controlFlowIndent) {
        // Indent it one level deeper
        resultLines.push(`${controlFlowIndent}${indentUnit}${trimmed}`);
        continue;
      }
    }

    resultLines.push(line);
  }

  return resultLines.join('\n');
};

/**
 * Detects the indentation unit (spaces or tab) from existing indentation.
 *
 * @param indent - Existing indentation string.
 * @returns One level of indentation.
 */
const detectIndentUnit = (indent: string): string => {
  if (indent.includes('\t')) {
    return '\t';
  }
  // Try to detect indent size from the string (common: 2 or 4 spaces)
  if (indent.length >= 4 && indent.length % 4 === 0) {
    return '    ';
  }
  if (indent.length >= 2) {
    return '  ';
  }
  return '    '; // Default to 4 spaces
};

/**
 * Splits inline control flow with content onto separate lines.
 * Content inside control flow is indented one level deeper.
 *
 * @param source - Source code.
 * @returns Source with control flow content on separate lines.
 */
const splitControlFlowContent = (source: string): string => {
  const lines = source.split('\n');
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: Full inline pattern on one line
    // {% if x %}content{% else %}content{% endif %}
    const inlinePattern =
      /^(\s*)(\{%\s*(?:if|for|unless|while)\b[^%]*%})([^{<][^{]*?)(\{%\s*(?:else|elif)\s*[^%]*%})([^{<][^{]*?)(\{%\s*end(?:if|for|unless|while)\s*%})(.*)$/;

    const match = line.match(inlinePattern);
    if (match) {
      const [, lineIndent, opener, content1, middle, content2, closer, trailing] = match;
      const c1 = content1.trim();
      const c2 = content2.trim();
      const indentUnit = detectIndentUnit(lineIndent);

      if (c1.length > 0 || c2.length > 0) {
        resultLines.push(`${lineIndent}${opener}`);
        if (c1.length > 0) resultLines.push(`${lineIndent}${indentUnit}${c1}`);
        resultLines.push(`${lineIndent}${middle}`);
        if (c2.length > 0) resultLines.push(`${lineIndent}${indentUnit}${c2}`);
        resultLines.push(`${lineIndent}${closer}${trailing}`);
        continue;
      }
    }

    // Pattern 2: Content attached after a control block at end of line
    // {% if x %}content (where content is text, not another tag/block)
    const contentAfterPattern = /^(\s*)(\{%\s*(?:if|for|unless|while|else|elif)\s*[^%]*%})([a-zA-Z][^\n{<]*)$/;
    const contentAfterMatch = line.match(contentAfterPattern);
    if (contentAfterMatch) {
      const [, lineIndent, block, content] = contentAfterMatch;
      const c = content.trim();
      const indentUnit = detectIndentUnit(lineIndent);
      if (c.length > 0) {
        resultLines.push(`${lineIndent}${block}`);
        resultLines.push(`${lineIndent}${indentUnit}${c}`);
        continue;
      }
    }

    // Pattern 3: Content attached before a control block (end/else)
    // content{% endif %} or content{% else %}
    const contentBeforePattern = /^(\s*)([a-zA-Z][^\n{<]*)(\{%\s*(?:end(?:if|for|unless|while)|else|elif)\s*[^%]*%})(.*)$/;
    const contentBeforeMatch = line.match(contentBeforePattern);
    if (contentBeforeMatch) {
      const [, lineIndent, content, block, trailing] = contentBeforeMatch;
      const c = content.trim();
      const indentUnit = detectIndentUnit(lineIndent);
      if (c.length > 0) {
        // Content was inside the block, so it needs extra indent
        // But the closing block stays at lineIndent level
        resultLines.push(`${lineIndent}${indentUnit}${c}`);
        resultLines.push(`${lineIndent}${block}${trailing}`);
        continue;
      }
    }

    // Pattern 4: Simple inline control flow (no else)
    const simplePattern =
      /^(\s*)(\{%\s*(?:if|for|unless|while)\b[^%]*%})([^{<][^{]*?)(\{%\s*end(?:if|for|unless|while)\s*%})(.*)$/;

    const simpleMatch = line.match(simplePattern);
    if (simpleMatch) {
      const [, lineIndent, opener, content, closer, trailing] = simpleMatch;
      const c = content.trim();
      const indentUnit = detectIndentUnit(lineIndent);

      if (c.length > 0) {
        resultLines.push(`${lineIndent}${opener}`);
        resultLines.push(`${lineIndent}${indentUnit}${c}`);
        resultLines.push(`${lineIndent}${closer}${trailing}`);
        continue;
      }
    }

    // No match, keep line as-is
    resultLines.push(line);
  }

  return resultLines.join('\n');
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
