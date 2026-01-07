/**
 * Tests for HubL Tokenizer.
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  filterWhitespace,
  hasCommas,
  parseModuleArgs,
  extractStatementKeyword,
} from '../src/hubl/tokenize.js';

describe('tokenize', () => {
  it('should tokenize identifiers', () => {
    const tokens = tokenize('module name path');
    const filtered = filterWhitespace(tokens);

    expect(filtered).toHaveLength(3);
    expect(filtered[0]).toMatchObject({ type: 'identifier', value: 'module' });
    expect(filtered[1]).toMatchObject({ type: 'identifier', value: 'name' });
    expect(filtered[2]).toMatchObject({ type: 'identifier', value: 'path' });
  });

  it('should tokenize strings', () => {
    const tokens = tokenize('"Hello" \'World\'');
    const filtered = filterWhitespace(tokens);

    expect(filtered).toHaveLength(2);
    expect(filtered[0]).toMatchObject({ type: 'string', value: '"Hello"' });
    expect(filtered[1]).toMatchObject({ type: 'string', value: "'World'" });
  });

  it('should tokenize booleans', () => {
    const tokens = tokenize('true false True False');
    const filtered = filterWhitespace(tokens);

    expect(filtered).toHaveLength(4);
    filtered.forEach((t) => expect(t.type).toBe('boolean'));
  });

  it('should tokenize numbers', () => {
    const tokens = tokenize('42 3.14 -10');
    const filtered = filterWhitespace(tokens);

    expect(filtered).toHaveLength(3);
    expect(filtered[0]).toMatchObject({ type: 'number', value: '42' });
    expect(filtered[1]).toMatchObject({ type: 'number', value: '3.14' });
    expect(filtered[2]).toMatchObject({ type: 'number', value: '-10' });
  });

  it('should tokenize operators', () => {
    const tokens = tokenize('= == != <= >=');
    const filtered = filterWhitespace(tokens);

    expect(filtered).toHaveLength(5);
    filtered.forEach((t) => expect(t.type).toBe('operator'));
  });

  it('should tokenize punctuation', () => {
    const tokens = tokenize('( ) [ ] { } , . :');
    const filtered = filterWhitespace(tokens);

    expect(filtered).toHaveLength(9);
    filtered.forEach((t) => expect(t.type).toBe('punctuation'));
  });

  it('should handle complex module content', () => {
    const tokens = tokenize(
      'module "Name" path="../path" no_wrapper=True'
    );
    const filtered = filterWhitespace(tokens);

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0]).toMatchObject({ type: 'identifier', value: 'module' });
    expect(filtered[1]).toMatchObject({ type: 'string', value: '"Name"' });
  });
});

describe('hasCommas', () => {
  it('should detect commas', () => {
    const tokens = tokenize('a, b, c');
    expect(hasCommas(tokens)).toBe(true);
  });

  it('should return false without commas', () => {
    const tokens = tokenize('a b c');
    expect(hasCommas(tokens)).toBe(false);
  });
});

describe('parseModuleArgs', () => {
  it('should parse module name', () => {
    const tokens = tokenize('module "HeroSection"');
    const args = parseModuleArgs(tokens);

    expect(args).toHaveLength(1);
    expect(args[0].name).toBe('"HeroSection"');
    expect(args[0].isBareFlag).toBe(true);
  });

  it('should parse named arguments', () => {
    const tokens = tokenize('module "Name" path="../path"');
    const args = parseModuleArgs(tokens);

    expect(args).toHaveLength(2);
    expect(args[1].name).toBe('path');
    expect(args[1].value).toBe('"../path"');
    expect(args[1].isBareFlag).toBe(false);
  });

  it('should parse bare flags', () => {
    const tokens = tokenize('module "Name" enable no_wrapper=True');
    const args = parseModuleArgs(tokens);

    expect(args).toHaveLength(3);
    expect(args[1].name).toBe('enable');
    expect(args[1].isBareFlag).toBe(true);
    expect(args[2].name).toBe('no_wrapper');
    expect(args[2].isBareFlag).toBe(false);
  });

  it('should preserve trailing commas', () => {
    const tokens = tokenize('module "Name" path="../path", no_wrapper=True');
    const args = parseModuleArgs(tokens);

    expect(args[1].hasTrailingComma).toBe(true);
    expect(args[2].hasTrailingComma).toBe(false);
  });
});

describe('extractStatementKeyword', () => {
  it('should extract if keyword', () => {
    expect(extractStatementKeyword(' if condition ')).toBe('if');
  });

  it('should extract for keyword', () => {
    expect(extractStatementKeyword(' for x in list ')).toBe('for');
  });

  it('should extract module keyword', () => {
    expect(extractStatementKeyword(' module "Name" path="x" ')).toBe('module');
  });

  it('should handle empty content', () => {
    expect(extractStatementKeyword('   ')).toBe('');
  });
});
