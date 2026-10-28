import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('payment choice routes to exactly one existing handler and rejects missing or unknown methods', async () => {
  const calls = [];
  const exports = {};
  const source = fs.readFileSync(new URL('../src/app/register/enrollment-action.ts', import.meta.url), 'utf8');
  const imports = {
    'next/navigation': { redirect: url => { throw new Error(url); } },
    '@/app/actions': { submitRegistrationRequest: async data => calls.push(['offline', data]) },
    './checkout-action': { startStripeCheckout: async data => calls.push(['online', data]) },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: key => imports[key] });
  for (const method of ['ach', 'card', 'venmo', 'cash', 'check']) {
    calls.length = 0;
    const form = new FormData(); form.set('paymentMethod', method); form.append('attendance', 'Tuesday 6:00 AM');
    await exports.submitEnrollment(form);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], ['ach', 'card'].includes(method) ? 'online' : 'offline');
    assert.equal(calls[0][1], form);
  }
  for (const method of ['', 'crypto', 'ACH']) {
    calls.length = 0;
    const form = new FormData(); form.set('paymentMethod', method);
    await assert.rejects(exports.submitEnrollment(form), /checkoutError=payment/);
    assert.equal(calls.length, 0);
  }
});
