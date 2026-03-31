import { describe, it, expect } from 'vitest';
import { htmlEscape } from '@shared/templates/htmlEscape';

describe('htmlEscape', () => {
  it('escapes ampersands', () => {
    expect(htmlEscape('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes angle brackets', () => {
    expect(htmlEscape('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes double quotes', () => {
    expect(htmlEscape('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('leaves safe strings unchanged', () => {
    expect(htmlEscape('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(htmlEscape('')).toBe('');
  });

  it('escapes multiple entities in one string', () => {
    expect(htmlEscape('a < b & c > d "e"')).toBe(
      'a &lt; b &amp; c &gt; d &quot;e&quot;'
    );
  });
});
