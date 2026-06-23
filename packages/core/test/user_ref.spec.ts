import { describe, expect, it } from 'vitest';
import { identityUserRef } from '../src/user_ref.js';

describe('identityUserRef', () => {
  it('maps an identity with userId to a user ref', () => {
    expect(identityUserRef({ userId: 'u1' })).toEqual({ type: 'user', id: 'u1' });
  });

  it('coerces a numeric id to a string', () => {
    expect(identityUserRef({ userId: 42 })).toEqual({ type: 'user', id: '42' });
  });

  it('is tolerant of a bare id field', () => {
    expect(identityUserRef({ id: 7 })).toEqual({ type: 'user', id: '7' });
  });

  it('falls back when neither userId nor id is present', () => {
    expect(identityUserRef({})).toBeUndefined();
  });
});
