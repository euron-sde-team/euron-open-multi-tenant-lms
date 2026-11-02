import { describe, expect, it } from 'vitest';

import { cn, decodeHtmlEntities } from '../utils';

describe('decodeHtmlEntities', () => {
  it('decodes the entities the APIs encode on write', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry &lt;3 &quot;hi&quot; it&#39;s a&#x2F;b')).toBe(
      'Tom & Jerry <3 "hi" it\'s a/b',
    );
  });

  it('returns an empty string for missing values', () => {
    expect(decodeHtmlEntities(null)).toBe('');
    expect(decodeHtmlEntities(undefined)).toBe('');
  });
});

describe('cn', () => {
  it('lets the later Tailwind class win', () => {
    expect(cn('p-2 text-sm', false && 'hidden', 'p-4')).toBe('text-sm p-4');
  });
});
