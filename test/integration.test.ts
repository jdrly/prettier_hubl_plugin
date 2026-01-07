/**
 * Integration tests for the full Prettier plugin.
 */

import { describe, it, expect } from 'vitest';
import * as prettier from 'prettier';
import * as plugin from '../src/index.js';

describe('Prettier Plugin Integration', () => {
  const format = async (code: string, parser: string = 'hubl-html') => {
    return prettier.format(code, {
      parser,
      plugins: [plugin],
      printWidth: 80,
      tabWidth: 2,
    });
  };

  describe('HTML formatting', () => {
    it('should separate multiple blocks per line', async () => {
      const input = '{% set x = 1 %} {% set y = 2 %}';
      const result = await format(input);

      expect(result).toContain('{% set x = 1 %}');
      expect(result).toContain('{% set y = 2 %}');
      // Should have newline between (not just spaces/tabs)
      expect(result).not.toMatch(/%}[ \t]+{%/);
    });

    it('should format module statements', async () => {
      const input =
        '{% module "Name" path="../components/modules/Name" no_wrapper=True %}';
      const result = await format(input);

      expect(result).toContain('{% module');
      expect(result).toContain('path=');
    });

    it('should preserve expressions in attributes', async () => {
      const input = '<a href="{{ content.url }}">Link</a>';
      const result = await format(input);

      expect(result).toContain('{{ content.url }}');
    });

    it('should handle control flow', async () => {
      const input = '{% if true %}<p>Hello</p>{% endif %}';
      const result = await format(input);

      expect(result).toContain('{% if true %}');
      expect(result).toContain('{% endif %}');
    });

    it('should format comments', async () => {
      const input = '{#   This is a comment   #}';
      const result = await format(input);

      expect(result).toContain('{# This is a comment #}');
    });
  });

  describe('Module multiline formatting', () => {
    it('should break long module onto multiple lines', async () => {
      const input =
        '{% module "QuoteHeading" path="../components/modules/QuoteHeading" showBadges=false showHeading=false showTagline=true no_wrapper=True %}';
      const result = await format(input);

      // Should be multi-line since it exceeds printWidth
      const lines = result.trim().split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('should preserve commas in multi-line format', async () => {
      const input =
        '{% module "Name" path="../path", showBadges=false, no_wrapper=True %}';
      const result = await format(input);

      expect(result).toContain(',');
    });
  });

  describe('CSS formatting', () => {
    it('should format HubL in CSS', async () => {
      const input =
        '.container { max-width: {{ theme.max_width }}px; }';
      const result = await format(input, 'hubl-css');

      expect(result).toContain('{{ theme.max_width }}');
    });

    it('should separate CSS HubL blocks', async () => {
      const input =
        '{% if dark %}.dark { color: #fff; }{% endif %}';
      const result = await format(input, 'hubl-css');

      expect(result).toContain('{% if dark %}');
      expect(result).toContain('{% endif %}');
    });
  });
});
