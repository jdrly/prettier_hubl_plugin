/**
 * Indentation Utilities - Handles indentation for formatted HubL blocks.
 *
 * @module embed/indent
 */

/**
 * Extracts the indentation from a line.
 *
 * @param line - The line to extract indentation from.
 * @returns The indentation string (spaces/tabs at the start).
 */
export const extractIndent = (line: string): string => {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
};

/**
 * Gets the indentation at a specific position in the source.
 *
 * Looks backward from the position to find the start of the line,
 * then extracts the indentation.
 *
 * @param source - The source string.
 * @param position - Position in the source.
 * @returns The indentation at that line.
 */
export const getIndentAtPosition = (
  source: string,
  position: number
): string => {
  // Find the start of the line containing this position
  let lineStart = position;
  while (lineStart > 0 && source[lineStart - 1] !== '\n') {
    lineStart--;
  }

  // Extract the line content up to position
  const lineContent = source.slice(lineStart, position);

  // Return the leading whitespace
  return extractIndent(lineContent);
};

/**
 * Applies base indentation to multi-line content.
 *
 * The first line is not indented (assumed to be inline).
 * Subsequent lines get the base indentation prepended.
 *
 * @param content - Multi-line content to indent.
 * @param baseIndent - Base indentation to apply.
 * @returns Indented content.
 *
 * @example
 * ```typescript
 * const result = applyIndent('{% module "Name"\n  path="./path" %}', '    ');
 * // Returns: '{% module "Name"\n      path="./path" %}'
 * ```
 */
export const applyIndent = (content: string, baseIndent: string): string => {
  const lines = content.split('\n');

  if (lines.length === 1) {
    return content;
  }

  return lines
    .map((line, index) => {
      if (index === 0) {
        return line;
      }
      // Only add indent to non-empty lines
      if (line.trim() === '') {
        return line;
      }
      return baseIndent + line;
    })
    .join('\n');
};

/**
 * Normalizes line endings to Unix-style (LF).
 *
 * @param content - Content with potentially mixed line endings.
 * @returns Content with Unix line endings.
 */
export const normalizeLineEndings = (content: string): string => {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

/**
 * Counts the indentation level (number of leading spaces/tabs).
 *
 * @param indent - The indentation string.
 * @param tabWidth - Width of a tab character.
 * @returns Effective indentation width.
 */
export const countIndentWidth = (indent: string, tabWidth: number): number => {
  let width = 0;
  for (const char of indent) {
    if (char === '\t') {
      width += tabWidth;
    } else if (char === ' ') {
      width += 1;
    }
  }
  return width;
};
