import { describe, expect, it } from 'vitest';
import type { AuthzService } from '../src/authz_service.js';
import AuthzRoleMiddleware from '../src/middleware.js';

/** AuthzService mínimo: só `effectiveRoles`, devolvendo os papéis fixados (injetado no construtor). */
function fakeAuthz(roles: string[]): AuthzService {
  return { effectiveRoles: async () => roles } as unknown as AuthzService;
}

/** ctx mínimo que registra qual método de resposta foi chamado. */
function fakeCtx(user: unknown) {
  const calls: { redirect?: string; forbidden?: unknown; unauthorized?: unknown } = {};
  const ctx = {
    auth: { getUser: async () => user },
    response: {
      redirect: (url: string) => {
        calls.redirect = url;
      },
      forbidden: (body?: unknown) => {
        calls.forbidden = body ?? true;
      },
      unauthorized: (body?: unknown) => {
        calls.unauthorized = body ?? true;
      },
    },
  };
  return { ctx: ctx as never, calls };
}

const noopNext = (async () => {}) as never;

describe('AuthzRoleMiddleware', () => {
  it('chama next quando o usuário tem um dos papéis', async () => {
    const mw = new AuthzRoleMiddleware(fakeAuthz(['COORDINATOR']));
    const { ctx, calls } = fakeCtx({ id: '1' });
    let nexted = false;
    await mw.handle(
      ctx,
      (async () => {
        nexted = true;
      }) as never,
      { roles: ['COORDINATOR'] },
    );
    expect(nexted).toBe(true);
    expect(calls.forbidden).toBeUndefined();
    expect(calls.unauthorized).toBeUndefined();
  });

  it('responde 403 quando o usuário está autenticado mas sem o papel', async () => {
    const mw = new AuthzRoleMiddleware(fakeAuthz(['ADVISEE']));
    const { ctx, calls } = fakeCtx({ id: '1' });
    let nexted = false;
    await mw.handle(
      ctx,
      (async () => {
        nexted = true;
      }) as never,
      { roles: ['COORDINATOR'] },
    );
    expect(nexted).toBe(false);
    expect(calls.forbidden).toBeDefined();
    expect(calls.redirect).toBeUndefined();
  });

  it('redireciona no deniedRedirect quando falta o papel e há redirect', async () => {
    const mw = new AuthzRoleMiddleware(fakeAuthz([]));
    const { ctx, calls } = fakeCtx({ id: '1' });
    await mw.handle(ctx, noopNext, { roles: ['ADMIN'], deniedRedirect: '/unauthorized' });
    expect(calls.redirect).toBe('/unauthorized');
    expect(calls.forbidden).toBeUndefined();
  });

  it('responde 401 quando não autenticado (sem guestRedirect)', async () => {
    const mw = new AuthzRoleMiddleware(fakeAuthz([]));
    const { ctx, calls } = fakeCtx(null);
    let nexted = false;
    await mw.handle(
      ctx,
      (async () => {
        nexted = true;
      }) as never,
      { roles: ['COORDINATOR'] },
    );
    expect(nexted).toBe(false);
    expect(calls.unauthorized).toBeDefined();
    expect(calls.redirect).toBeUndefined();
  });

  it('redireciona no guestRedirect quando não autenticado e configurado', async () => {
    const mw = new AuthzRoleMiddleware(fakeAuthz([]));
    const { ctx, calls } = fakeCtx(null);
    await mw.handle(ctx, noopNext, { roles: ['COORDINATOR'], guestRedirect: '/auth/login' });
    expect(calls.redirect).toBe('/auth/login');
    expect(calls.unauthorized).toBeUndefined();
  });

  it('any-of: passa se tiver PELO MENOS UM dos papéis', async () => {
    const mw = new AuthzRoleMiddleware(fakeAuthz(['ADMIN']));
    const { ctx } = fakeCtx({ id: '1' });
    let nexted = false;
    await mw.handle(
      ctx,
      (async () => {
        nexted = true;
      }) as never,
      { roles: ['ADVISOR', 'ADMIN'] },
    );
    expect(nexted).toBe(true);
  });
});
