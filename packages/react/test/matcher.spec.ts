import { describe, expect, it } from 'vitest';
import { permissionSatisfied } from '../src/matcher.js';

describe('permissionSatisfied (client)', () => {
  it('exact + wildcard', () => {
    expect(permissionSatisfied(['posts.edit'], 'posts.edit')).toBe(true);
    expect(permissionSatisfied(['posts.*'], 'posts.edit')).toBe(true);
    expect(permissionSatisfied(['*'], 'anything.here')).toBe(true);
    expect(permissionSatisfied(['posts.edit'], 'posts.delete')).toBe(false);
    expect(permissionSatisfied([], 'posts.edit')).toBe(false);
  });

  it('trailing wildcard requires at least one remaining segment', () => {
    expect(permissionSatisfied(['posts.*'], 'posts')).toBe(false);
    expect(permissionSatisfied(['posts.*'], 'posts.edit.draft')).toBe(true);
  });

  it('interior wildcard consumes exactly one segment', () => {
    expect(permissionSatisfied(['posts.*.edit'], 'posts.123.edit')).toBe(true);
    expect(permissionSatisfied(['posts.*.edit'], 'posts.edit')).toBe(false);
  });
});
