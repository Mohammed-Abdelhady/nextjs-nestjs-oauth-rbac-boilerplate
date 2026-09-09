import { describe, expect, it } from 'vitest';
import {
  areAllPasswordRulesPassed,
  evaluatePasswordRules,
  MIN_PASSWORD_LENGTH,
} from '../passwordRules';

describe('evaluatePasswordRules', () => {
  it('marks all rules failed for empty password', () => {
    const results = evaluatePasswordRules('');
    expect(results).toEqual([
      { id: 'minLength', passed: false },
      { id: 'uppercase', passed: false },
      { id: 'lowercase', passed: false },
      { id: 'number', passed: false },
    ]);
  });

  it('evaluates minLength correctly with default and custom thresholds', () => {
    const defaultFail = evaluatePasswordRules('Abc1');
    expect(defaultFail.find((r) => r.id === 'minLength')?.passed).toBe(false);

    const defaultPass = evaluatePasswordRules('Abcdefg1');
    expect(defaultPass.find((r) => r.id === 'minLength')?.passed).toBe(true);

    const customPass = evaluatePasswordRules('Abc1', 4);
    expect(customPass.find((r) => r.id === 'minLength')?.passed).toBe(true);
  });

  it('evaluates uppercase rule correctly', () => {
    const withoutUpper = evaluatePasswordRules('abcdefg1');
    expect(withoutUpper.find((r) => r.id === 'uppercase')?.passed).toBe(false);

    const withUpper = evaluatePasswordRules('Abcdefg1');
    expect(withUpper.find((r) => r.id === 'uppercase')?.passed).toBe(true);
  });

  it('evaluates lowercase rule correctly', () => {
    const withoutLower = evaluatePasswordRules('ABCDEFG1');
    expect(withoutLower.find((r) => r.id === 'lowercase')?.passed).toBe(false);

    const withLower = evaluatePasswordRules('Abcdefg1');
    expect(withLower.find((r) => r.id === 'lowercase')?.passed).toBe(true);
  });

  it('evaluates number rule correctly', () => {
    const withoutNumber = evaluatePasswordRules('Abcdefgh');
    expect(withoutNumber.find((r) => r.id === 'number')?.passed).toBe(false);

    const withNumber = evaluatePasswordRules('Abcdefg1');
    expect(withNumber.find((r) => r.id === 'number')?.passed).toBe(true);
  });

  it('marks all rules passed when all criteria are met', () => {
    const results = evaluatePasswordRules('ValidP4ssword');
    expect(results.every((r) => r.passed)).toBe(true);
  });
});

describe('areAllPasswordRulesPassed', () => {
  it('returns false for incomplete password', () => {
    expect(areAllPasswordRulesPassed('weak')).toBe(false);
  });

  it('returns true when all rules pass', () => {
    expect(areAllPasswordRulesPassed('StrongP4ssword', MIN_PASSWORD_LENGTH)).toBe(true);
  });
});
