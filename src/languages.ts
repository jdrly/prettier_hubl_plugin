/**
 * Language Definitions - Prettier language configurations for HubL files.
 *
 * @module languages
 */

import type { SupportLanguage } from 'prettier';

/**
 * Language definition for HubL HTML files (.hubl.html).
 */
export const hublHtmlLanguage: SupportLanguage = {
  name: 'HubL HTML',
  parsers: ['hubl-html'],
  extensions: ['.hubl.html'],
  vscodeLanguageIds: ['hubl-html', 'html'],
};

/**
 * Language definition for HubL CSS files (.hubl.css).
 */
export const hublCssLanguage: SupportLanguage = {
  name: 'HubL CSS',
  parsers: ['hubl-css'],
  extensions: ['.hubl.css'],
  vscodeLanguageIds: ['hubl-css', 'css'],
};

/**
 * All supported HubL language definitions.
 */
export const languages: SupportLanguage[] = [hublHtmlLanguage, hublCssLanguage];
