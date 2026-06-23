import { describe, expect, it } from 'vitest';
import { type ScopeableQuery, applyScopeConstraint } from '../src/lucid_scope.js';
import { and, eq, or, scopeAll, scopeNone, where, whereIn } from '../src/scope.js';

/**
 * A fake {@link ScopeableQuery} that records every clause applied to it as a flat list
 * of operation strings. Nested groups recurse into a child recorder and are captured
 * as `where(group:[...])` so the AST → query mapping is fully assertable without a DB.
 */
class FakeQuery implements ScopeableQuery {
  readonly ops: string[] = [];

  where(arg: unknown, operator?: string, value?: unknown): this {
    if (typeof arg === 'function') {
      const child = new FakeQuery();
      (arg as (q: ScopeableQuery) => void)(child);
      this.ops.push(`where(group:[${child.ops.join(',')}])`);
    } else {
      this.ops.push(`where(${String(arg)} ${operator} ${JSON.stringify(value)})`);
    }
    return this;
  }
  orWhere(callback: (q: ScopeableQuery) => void): this {
    const child = new FakeQuery();
    callback(child);
    this.ops.push(`orWhere(group:[${child.ops.join(',')}])`);
    return this;
  }
  whereIn(column: string, values: readonly unknown[]): this {
    this.ops.push(`whereIn(${column}, ${JSON.stringify(values)})`);
    return this;
  }
  whereNotIn(column: string, values: readonly unknown[]): this {
    this.ops.push(`whereNotIn(${column}, ${JSON.stringify(values)})`);
    return this;
  }
  whereNull(column: string): this {
    this.ops.push(`whereNull(${column})`);
    return this;
  }
  whereNotNull(column: string): this {
    this.ops.push(`whereNotNull(${column})`);
    return this;
  }
  whereRaw(sql: string): this {
    this.ops.push(`whereRaw(${sql})`);
    return this;
  }
}

describe('applyScopeConstraint — constraint AST → Lucid where clauses', () => {
  it('allow-all → no clause (every row visible)', () => {
    const q = new FakeQuery();
    applyScopeConstraint(q, scopeAll);
    expect(q.ops).toEqual([]);
  });

  it('deny-all → whereRaw(1 = 0) (no rows)', () => {
    const q = new FakeQuery();
    applyScopeConstraint(q, scopeNone);
    expect(q.ops).toEqual(['whereRaw(1 = 0)']);
  });

  it('a single equality → a wrapped where(field = value)', () => {
    const q = new FakeQuery();
    applyScopeConstraint(q, eq('author_id', 7));
    expect(q.ops).toEqual(['where(group:[where(author_id = 7)])']);
  });

  it('maps every binary comparison operator', () => {
    for (const [op, token] of [
      ['ne', '!='],
      ['gt', '>'],
      ['gte', '>='],
      ['lt', '<'],
      ['lte', '<='],
    ] as const) {
      const q = new FakeQuery();
      applyScopeConstraint(q, where('a', op, 1));
      expect(q.ops).toEqual([`where(group:[where(a ${token} 1)])`]);
    }
  });

  it('IN / NIN map to whereIn / whereNotIn', () => {
    const inQ = new FakeQuery();
    applyScopeConstraint(inQ, whereIn('id', [1, 2, 3]));
    expect(inQ.ops).toEqual(['where(group:[whereIn(id, [1,2,3])])']);

    const ninQ = new FakeQuery();
    applyScopeConstraint(ninQ, where('id', 'nin', [1, 2]));
    expect(ninQ.ops).toEqual(['where(group:[whereNotIn(id, [1,2])])']);
  });

  it('an empty IN is always-false; an empty NIN is always-true (no clause)', () => {
    const inQ = new FakeQuery();
    applyScopeConstraint(inQ, where('id', 'in', []));
    expect(inQ.ops).toEqual(['where(group:[whereRaw(1 = 0)])']);

    const ninQ = new FakeQuery();
    applyScopeConstraint(ninQ, where('id', 'nin', []));
    expect(ninQ.ops).toEqual(['where(group:[])']);
  });

  it('isNull / isNotNull map to whereNull / whereNotNull', () => {
    const nullQ = new FakeQuery();
    applyScopeConstraint(nullQ, where('deleted_at', 'isNull'));
    expect(nullQ.ops).toEqual(['where(group:[whereNull(deleted_at)])']);

    const notNullQ = new FakeQuery();
    applyScopeConstraint(notNullQ, where('deleted_at', 'isNotNull'));
    expect(notNullQ.ops).toEqual(['where(group:[whereNotNull(deleted_at)])']);
  });

  it('AND group → a nested where with chained conditions', () => {
    const q = new FakeQuery();
    applyScopeConstraint(q, and(eq('a', 1), eq('b', 2)));
    expect(q.ops).toEqual(['where(group:[where(group:[where(a = 1),where(b = 2)])])']);
  });

  it('OR group → first where + orWhere alternatives', () => {
    const q = new FakeQuery();
    applyScopeConstraint(q, or(eq('a', 1), eq('b', 2)));
    expect(q.ops).toEqual([
      'where(group:[where(group:[where(group:[where(a = 1)]),orWhere(group:[where(b = 2)])])])',
    ]);
  });

  it('rejects a hostile field name (injection via identifier)', () => {
    const q = new FakeQuery();
    expect(() => applyScopeConstraint(q, eq('id"; DROP TABLE posts; --', 1))).toThrow(/unsafe/i);
  });
});
