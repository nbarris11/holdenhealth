import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, FormData, Date, Set });
  return exports;
}
const { riskAgreement, validateRiskAgreement } = load('../src/lib/risk-agreement.ts');
const { personalTrainingIntakeSections, parsePersonalTrainingIntake } = load('../src/lib/personal-training-intake.ts');

test('class agreement uses class terms and every acknowledgment is mandatory', () => {
  const personal = riskAgreement('personal_training');
  const group = riskAgreement('group_class');
  assert.match(personal.documentText, /\$100 per one-hour session/);
  assert.match(personal.documentText, /24 hours' notice/);
  assert.doesNotMatch(group.documentText, /\$100|24 hours' notice/);
  assert.match(group.documentText, /class dates, price, payment, cancellation, and attendance policies/);
  const form = new FormData();
  for (const [key, value] of Object.entries({ clientName: 'Test Client', phone: '555-1234', email: 'test@example.com', emergencyContact: 'Test Contact', emergencyContactPhone: '555-6789', preferredCommunication: 'Email', printedName: 'Test Client', signature: 'Test Client', signedOn: '2026-09-28' })) form.set(key, value);
  for (const item of group.acknowledgments.slice(0, 5)) form.append('riskAcknowledgment', item);
  assert.equal(validateRiskAgreement(form, 'group_class').field, 'riskAcknowledgment');
  form.append('riskAcknowledgment', group.acknowledgments[5]);
  assert.equal(validateRiskAgreement(form, 'group_class').error, undefined);
});

test('personal intake covers all ten supplied sections and flags a health disclosure', () => {
  assert.equal(personalTrainingIntakeSections.length, 10);
  assert.equal(personalTrainingIntakeSections[0].title, '1. BASIC INFORMATION');
  assert.equal(personalTrainingIntakeSections[9].title, '10. FINAL QUESTIONS');
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Test Client', dateOfBirth: '1990-01-01', phone: '555-1234', email: 'test@example.com', emergencyContact: 'Test Contact', emergencyContactPhone: '555-6789', preferredCommunication: 'Text', medicalCondition: 'Yes', medicalConditionDetail: 'Needs follow-up', currentInjury: 'No', priorSurgery: 'No', medication: 'No', clientName: 'Test Client', signature: 'Test Client', signatureDate: '2026-09-28' })) form.set(key, value);
  const parsed = parsePersonalTrainingIntake(form);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.healthReviewRequired, true);
  assert.equal(Object.keys(parsed.responses).length, 11);
});
