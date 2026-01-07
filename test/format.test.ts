/**
 * Tests for HubL Formatter.
 */

import { describe, it, expect } from 'vitest';
import {
  formatStatement,
  formatExpression,
  formatComment,
  formatBlock,
} from '../src/hubl/format.js';
import { DEFAULT_FORMAT_OPTIONS, type FormatOptions } from '../src/hubl/rules.js';

const options: FormatOptions = {
  ...DEFAULT_FORMAT_OPTIONS,
  printWidth: 80,
};

describe('formatExpression', () => {
  it('should normalize whitespace', () => {
    const result = formatExpression('{{   content.title   }}', options, '');
    expect(result).toBe('{{ content.title }}');
  });

  it('should preserve string content', () => {
    const result = formatExpression('{{ "Hello   World" }}', options, '');
    expect(result).toBe('{{ "Hello   World" }}');
  });

  it('should handle filters', () => {
    const result = formatExpression('{{  name|upper  }}', options, '');
    expect(result).toBe('{{ name|upper }}');
  });

  it('should handle format filter', () => {
    const result = formatExpression('{{ "%02d"|format(loop.index) }}', options, '');
    expect(result).toBe('{{ "%02d"|format(loop.index) }}');
  });
});

describe('formatComment', () => {
  it('should normalize whitespace', () => {
    const result = formatComment('{#   This is a comment   #}', options, '');
    expect(result).toBe('{# This is a comment #}');
  });

  it('should handle multiline comments', () => {
    const result = formatComment('{#\n  Multi\n  line\n#}', options, '');
    expect(result).toBe('{# Multi line #}');
  });
});

describe('formatStatement', () => {
  it('should normalize if statements', () => {
    const result = formatStatement('{%   if   condition   %}', options, '');
    expect(result).toBe('{% if condition %}');
  });

  it('should normalize for statements', () => {
    const result = formatStatement('{%  for  x  in  list  %}', options, '');
    expect(result).toBe('{% for x in list %}');
  });

  it('should format simple module on one line', () => {
    const result = formatStatement(
      '{% module "Name" path="../path" %}',
      options,
      ''
    );
    expect(result).toBe('{% module "Name" path="../path" %}');
  });

  it('should format long module on multiple lines', () => {
    const result = formatStatement(
      '{% module "QuoteHeading" path="../components/modules/QuoteHeading" showBadges=false showHeading=false showTagline=true no_wrapper=True %}',
      { ...options, printWidth: 80 },
      ''
    );

    expect(result).toContain('\n');
    expect(result).toContain('path=');
    expect(result).toContain('showBadges=');
  });

  it('should preserve commas when present', () => {
    const result = formatStatement(
      '{% module "Name" path="../path", no_wrapper=True %}',
      options,
      ''
    );
    expect(result).toContain(',');
  });

  it('should not add commas when not present', () => {
    const result = formatStatement(
      '{% module "Name" path="../path" no_wrapper=True %}',
      options,
      ''
    );
    // Split and check individual args don't have trailing commas
    const lines = result.split('\n');
    // In single-line mode, there should be no commas between args
    if (lines.length === 1) {
      const parts = result.split(' ');
      // path should not have comma
      const pathPart = parts.find((p) => p.startsWith('path='));
      if (pathPart && !pathPart.endsWith('path="../path"')) {
        expect(pathPart).not.toContain(',');
      }
    }
  });

  it('should handle bare flags', () => {
    const result = formatStatement(
      '{% module "Name" enable no_wrapper=True %}',
      options,
      ''
    );
    expect(result).toContain('enable');
    expect(result).not.toContain('enable=');
  });
});

describe('formatBlock', () => {
  it('should format statement blocks', () => {
    const block = {
      type: 'statement' as const,
      start: 0,
      end: 20,
      raw: '{%  if  condition  %}',
    };
    const result = formatBlock(block, options, '');
    expect(result).toBe('{% if condition %}');
  });

  it('should format expression blocks', () => {
    const block = {
      type: 'expression' as const,
      start: 0,
      end: 15,
      raw: '{{   name   }}',
    };
    const result = formatBlock(block, options, '');
    expect(result).toBe('{{ name }}');
  });

  it('should format comment blocks', () => {
    const block = {
      type: 'comment' as const,
      start: 0,
      end: 20,
      raw: '{#   comment   #}',
    };
    const result = formatBlock(block, options, '');
    expect(result).toBe('{# comment #}');
  });
});
