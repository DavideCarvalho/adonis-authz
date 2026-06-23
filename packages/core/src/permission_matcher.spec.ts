import { describe, expect, it } from 'vitest';
import { permissionMatches, permissionSatisfied } from './permission_matcher.js';

describe('permissionMatches', () => {
  it('matches exact strings', () => {
    expect(permissionMatches('posts.edit', 'posts.edit')).toBe(true);
    expect(permissionMatches('posts.edit', 'posts.delete')).toBe(false);
  });

  it('global wildcard matches anything', () => {
    expect(permissionMatches('*', 'posts.edit')).toBe(true);
    expect(permissionMatches('*', 'anything')).toBe(true);
    expect(permissionMatches('*', '*')).toBe(true);
  });

  it('trailing wildcard matches one-or-more remaining segments', () => {
    expect(permissionMatches('posts.*', 'posts.edit')).toBe(true);
    expect(permissionMatches('posts.*', 'posts.edit.draft')).toBe(true);
  });

  it('trailing wildcard does NOT match the bare prefix (zero remaining)', () => {
    expect(permissionMatches('posts.*', 'posts')).toBe(false);
  });

  it('wildcard only matches within the same namespace', () => {
    expect(permissionMatches('posts.*', 'comments.edit')).toBe(false);
  });

  it('interior wildcard consumes exactly one segment', () => {
    expect(permissionMatches('posts.*.draft', 'posts.edit.draft')).toBe(true);
    expect(permissionMatches('posts.*.draft', 'posts.draft')).toBe(false);
    expect(permissionMatches('posts.*.draft', 'posts.edit.published')).toBe(false);
  });

  it('a longer required ability does not match a shorter literal granted', () => {
    expect(permissionMatches('posts', 'posts.edit')).toBe(false);
    expect(permissionMatches('posts.edit', 'posts')).toBe(false);
  });

  it('treats the required side literally (a required * is not a pattern)', () => {
    expect(permissionMatches('posts.edit', 'posts.*')).toBe(false);
    expect(permissionMatches('posts.*', 'posts.*')).toBe(true); // identical strings
  });
});

describe('permissionSatisfied', () => {
  it('is true when any granted pattern matches', () => {
    expect(permissionSatisfied(['comments.view', 'posts.*'], 'posts.edit')).toBe(true);
  });

  it('is false when none match', () => {
    expect(permissionSatisfied(['comments.view', 'posts.view'], 'posts.edit')).toBe(false);
  });

  it('is false for an empty grant set', () => {
    expect(permissionSatisfied([], 'posts.edit')).toBe(false);
  });
});
