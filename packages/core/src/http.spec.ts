import { describe, expect, it } from 'vitest';
import { AuthzService } from './authz_service.js';
import { type CanResponse, registerCanEndpoint } from './http.js';
import { MemoryPermissionStore } from './stores/memory.js';

interface FakeCtx {
  request: { body: () => Record<string, unknown> };
  auth?: { user?: unknown };
}

/** A fake router that captures the registered POST handler. */
function fakeRouter() {
  let handler: ((ctx: FakeCtx) => Promise<CanResponse>) | undefined;
  let registeredPath: string | undefined;
  return {
    router: {
      post(path: string, h: (ctx: FakeCtx) => Promise<CanResponse>) {
        registeredPath = path;
        handler = h;
      },
    },
    call: (ctx: FakeCtx) => handler?.(ctx) as Promise<CanResponse>,
    get path() {
      return registeredPath;
    },
  };
}

async function makeService() {
  const store = new MemoryPermissionStore();
  await store.givePermissionToRole('editor', 'posts.*');
  await store.assignRole({ type: 'user', id: '1' }, 'editor');
  return new AuthzService({ store });
}

describe('feature D — POST /authz/can endpoint', () => {
  it('registers the default /authz/can path', async () => {
    const service = await makeService();
    const r = fakeRouter();
    registerCanEndpoint(r.router, { service });
    expect(r.path).toBe('/authz/can');
  });

  it('allows when the active user holds the permission (contract: { allowed })', async () => {
    const service = await makeService();
    const r = fakeRouter();
    registerCanEndpoint(r.router, { service });

    const res = await r.call({
      request: { body: () => ({ permission: 'posts.edit' }) },
      auth: { user: { id: '1' } },
    });
    expect(res).toEqual({ allowed: true });
  });

  it('denies when the user lacks the permission', async () => {
    const service = await makeService();
    const r = fakeRouter();
    registerCanEndpoint(r.router, { service });

    const res = await r.call({
      request: { body: () => ({ permission: 'comments.edit' }) },
      auth: { user: { id: '1' } },
    });
    expect(res).toEqual({ allowed: false });
  });

  it('denies an anonymous user', async () => {
    const service = await makeService();
    const r = fakeRouter();
    registerCanEndpoint(r.router, { service });

    const res = await r.call({
      request: { body: () => ({ permission: 'posts.edit' }) },
    });
    expect(res).toEqual({ allowed: false });
  });

  it('denies when permission is missing from the body', async () => {
    const service = await makeService();
    const r = fakeRouter();
    registerCanEndpoint(r.router, { service });

    const res = await r.call({
      request: { body: () => ({ resource: 'x' }) },
      auth: { user: { id: '1' } },
    });
    expect(res).toEqual({ allowed: false });
  });

  it('honors a custom path and resolveUser', async () => {
    const service = await makeService();
    const r = fakeRouter();
    registerCanEndpoint(r.router, {
      service,
      path: '/api/authz/can',
      resolveUser: () => ({ id: '1' }),
    });
    expect(r.path).toBe('/api/authz/can');
    const res = await r.call({
      request: { body: () => ({ permission: 'posts.delete' }) },
    });
    expect(res).toEqual({ allowed: true });
  });
});
