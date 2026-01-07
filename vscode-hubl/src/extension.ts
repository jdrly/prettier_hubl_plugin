/**
 * HubL Language Support Extension
 *
 * Provides syntax highlighting for HubL (HubSpot templating language)
 * in HTML, CSS, JSX, and TSX files.
 *
 * @module vscode-hubl
 */

import * as vscode from 'vscode';

/**
 * Activates the extension.
 *
 * @param context - The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('HubL Language Support is now active');

  // Register file associations for HubL files
  const disposable = vscode.workspace.onDidOpenTextDocument((document) => {
    // Auto-detect HubL in regular HTML files based on content
    if (
      document.languageId === 'html' &&
      (document.fileName.endsWith('.hubl.html') ||
        containsHublBlocks(document.getText()))
    ) {
      // File already has .hubl.html extension or contains HubL blocks
      // The grammar injection will handle highlighting
    }
  });

  context.subscriptions.push(disposable);
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
  // Cleanup if needed
}

/**
 * Checks if text contains HubL blocks.
 *
 * @param text - Text content to check.
 * @returns True if HubL blocks are detected.
 */
function containsHublBlocks(text: string): boolean {
  // Simple check for HubL delimiters
  return (
    text.includes('{%') ||
    text.includes('{{') ||
    text.includes('{#')
  );
}
