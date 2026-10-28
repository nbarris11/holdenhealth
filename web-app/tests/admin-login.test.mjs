import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { adminReturnPath, adminLoginPath } from '../src/lib/admin-return.ts';
function load(file, imports) {
  const exports = {};
  const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: key => imports[key], process: { env: {} } });
  return exports;
}
function setup({ signedIn = true, admin = false, passwordError = false } = {}) {
  let signedOut = false;
  const db = {
    auth: {
      getClaims: async () => ({ data: { claims: signedIn ? { sub: 'user', email: 'test@example.invalid' } : {} } }),
      signInWithPassword: async () => ({ data: { user: passwordError ? null : { id: 'user' } }, error: passwordError }),
      signOut: async () => { signedOut = true; },
    },
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: admin ? { role: 'admin' } : null }) }),
  };
  const imports = {
    'server-only': {}, react: { cache: fn => fn },
    'next/headers': { headers: async () => new Headers({ 'x-holden-admin-return': '/admin/people' }) },
    'next/navigation': { redirect: url => { throw new Error(url); } },
    '@/lib/admin-return': { adminReturnPath, adminLoginPath },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/auth': {},
  };
  return { imports, signedOut: () => signedOut };
}
test('admin destinations reject external URLs, traversal, login loops and member pages', () => {
  for (const value of ['https://evil.invalid', '//evil.invalid', '/admin/../../portal', '/admin/%2e%2e/portal', '/admin\\evil', '/administrator', '/portal', '/admin/login', undefined]) assert.equal(adminReturnPath(value), '/admin');
  assert.equal(adminReturnPath('/admin/people?filter=pending#requests'), '/admin/people?filter=pending#requests');
});
test('member session opening admin review goes to staff sign-in, not member portal', async () => {
  const { imports } = setup();
  const { verifyAdmin } = load('lib/auth.ts', imports);
  await assert.rejects(verifyAdmin(), error => {
    const url = new URL(error.message, 'https://portal.holden.health');
    assert.equal(url.pathname, '/admin/login');
    assert.equal(url.searchParams.get('next'), '/admin/people');
    assert.match(url.searchParams.get('error'), /admin account/);
    return true;
  });
});
test('signed-out admin guard preserves return page and authorized admin passes', async () => {
  await assert.rejects(load('lib/auth.ts', setup({ signedIn: false }).imports).verifyAdmin(), /next=%2Fadmin%2Fpeople/);
  assert.equal((await load('lib/auth.ts', setup({ admin: true }).imports).verifyAdmin()).userId, 'user');
});
test('staff sign-in returns to request page; wrong password and non-admin stay at staff login', async () => {
  for (const config of [{ admin: true }, { passwordError: true }, {}]) {
    const h = setup(config);
    const form = new FormData();
    form.set('email', 'test@example.invalid'); form.set('password', 'example'); form.set('next', '/admin/people#requests');
    await assert.rejects(load('app/admin/login/actions.ts', h.imports).adminSignIn(form), error => {
      if (config.admin) assert.equal(error.message, '/admin/people#requests');
      else {
        const url = new URL(error.message, 'https://portal.holden.health');
        assert.equal(url.pathname, '/admin/login');
        assert.equal(url.searchParams.get('next'), '/admin/people#requests');
      }
      return true;
    });
    assert.equal(h.signedOut(), !config.admin && !config.passwordError);
  }
});
test('proxy preserves the requested admin URL and overwrites spoofed return headers', async () => {
  for (const signedIn of [false, true]) {
    const request = {
      nextUrl: Object.assign(new URL('https://portal.holden.health/admin/people?filter=pending'), { clone() { return new URL(this); } }),
      headers: new Headers({ 'x-holden-admin-return': '//evil.invalid' }),
      cookies: { getAll: () => [], set: () => {} },
    };
    const handler = load('lib/supabase/proxy.ts', {
      '@supabase/ssr': { createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: signedIn ? { sub: 'user' } : {} } }) } }) },
      'next/server': { NextResponse: { next: options => options, redirect: url => ({ url }) } },
    });
    // The mock module only needs env keys; no network or credentials are used.
    const result = await handler.updateSession(request);
    assert.equal(request.headers.get('x-holden-admin-return'), '/admin/people?filter=pending');
    if (!signedIn) {
      assert.equal(result.url.pathname, '/admin/login');
      assert.equal(result.url.searchParams.get('next'), '/admin/people?filter=pending');
    } else assert.equal(result.request.headers.get('x-holden-admin-return'), '/admin/people?filter=pending');
  }
});
