/**
 * Tests for HubL Scanner.
 */

import { describe, it, expect } from 'vitest';
import {
  scanHublBlocks,
  getBlockInnerContent,
  isControlFlowBlock,
  isModuleBlock,
} from '../src/hubl/scan.js';

describe('scanHublBlocks', () => {
  it('should detect statement blocks', () => {
    const blocks = scanHublBlocks('{% if true %}Hello{% endif %}');

    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('statement');
    expect(blocks[0].raw).toBe('{% if true %}');
    expect(blocks[1].type).toBe('statement');
    expect(blocks[1].raw).toBe('{% endif %}');
  });

  it('should detect expression blocks', () => {
    const blocks = scanHublBlocks('Hello {{ name }}!');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('expression');
    expect(blocks[0].raw).toBe('{{ name }}');
  });

  it('should detect comment blocks', () => {
    const blocks = scanHublBlocks('{# This is a comment #}');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('comment');
    expect(blocks[0].raw).toBe('{# This is a comment #}');
  });

  it('should handle mixed block types', () => {
    const source =
      '{% if show %}<p>{{ content }}</p>{# comment #}{% endif %}';
    const blocks = scanHublBlocks(source);

    expect(blocks).toHaveLength(4);
    expect(blocks[0].type).toBe('statement');
    expect(blocks[1].type).toBe('expression');
    expect(blocks[2].type).toBe('comment');
    expect(blocks[3].type).toBe('statement');
  });

  it('should handle strings inside blocks', () => {
    const blocks = scanHublBlocks('{% module "Name" path="./path" %}');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].raw).toBe('{% module "Name" path="./path" %}');
  });

  it('should handle escaped quotes in strings', () => {
    const blocks = scanHublBlocks('{% set x = "He said \\"hello\\"" %}');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].raw).toBe('{% set x = "He said \\"hello\\"" %}');
  });

  it('should return empty array for no blocks', () => {
    const blocks = scanHublBlocks('<div>Hello World</div>');

    expect(blocks).toHaveLength(0);
  });

  it('should capture correct positions', () => {
    const source = 'Hello {% name %} World';
    const blocks = scanHublBlocks(source);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].start).toBe(6);
    expect(blocks[0].end).toBe(16);
    expect(source.slice(blocks[0].start, blocks[0].end)).toBe('{% name %}');
  });
});

describe('getBlockInnerContent', () => {
  it('should extract statement content', () => {
    const block = {
      type: 'statement' as const,
      start: 0,
      end: 13,
      raw: '{% if true %}',
    };

    expect(getBlockInnerContent(block)).toBe(' if true ');
  });

  it('should extract expression content', () => {
    const block = {
      type: 'expression' as const,
      start: 0,
      end: 10,
      raw: '{{ name }}',
    };

    expect(getBlockInnerContent(block)).toBe(' name ');
  });

  it('should extract comment content', () => {
    const block = {
      type: 'comment' as const,
      start: 0,
      end: 15,
      raw: '{# comment #}',
    };

    expect(getBlockInnerContent(block)).toBe(' comment ');
  });
});

describe('isControlFlowBlock', () => {
  it('should identify if blocks', () => {
    const block = { type: 'statement' as const, start: 0, end: 13, raw: '{% if true %}' };
    expect(isControlFlowBlock(block)).toBe(true);
  });

  it('should identify for blocks', () => {
    const block = { type: 'statement' as const, start: 0, end: 20, raw: '{% for x in list %}' };
    expect(isControlFlowBlock(block)).toBe(true);
  });

  it('should identify else blocks', () => {
    const block = { type: 'statement' as const, start: 0, end: 10, raw: '{% else %}' };
    expect(isControlFlowBlock(block)).toBe(true);
  });

  it('should not identify module blocks as control flow', () => {
    const block = { type: 'statement' as const, start: 0, end: 30, raw: '{% module "Name" path="x" %}' };
    expect(isControlFlowBlock(block)).toBe(false);
  });

  it('should not identify expressions as control flow', () => {
    const block = { type: 'expression' as const, start: 0, end: 10, raw: '{{ name }}' };
    expect(isControlFlowBlock(block)).toBe(false);
  });
});

describe('isModuleBlock', () => {
  it('should identify module blocks', () => {
    const block = { type: 'statement' as const, start: 0, end: 30, raw: '{% module "Name" path="x" %}' };
    expect(isModuleBlock(block)).toBe(true);
  });

  it('should not identify other blocks as module', () => {
    const block = { type: 'statement' as const, start: 0, end: 13, raw: '{% if true %}' };
    expect(isModuleBlock(block)).toBe(false);
  });
});
