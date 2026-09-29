import { describe, expect, it } from 'vitest';
import { amortizeYear, monthlyPayment, requiredAnnualContribution, grow } from '../src/engine/finance.ts';

describe('monthlyPayment', () => {
  it('matches a standard 30-year mortgage table', () => {
    // $300,000 at 6.5% for 30 years is $1,896.20/mo
    expect(monthlyPayment(300_000, 0.065, 30)).toBeCloseTo(1896.2, 0);
  });
  it('handles zero interest', () => {
    expect(monthlyPayment(12_000, 0, 10)).toBe(100);
  });
});

describe('amortizeYear', () => {
  it('pays the loan down and splits interest/principal', () => {
    const pmt = monthlyPayment(100_000, 0.06, 30);
    const y = amortizeYear(100_000, 0.06, pmt);
    expect(y.paid).toBeCloseTo(pmt * 12, 6);
    expect(y.interest + y.principal).toBeCloseTo(y.paid, 6);
    expect(y.balance).toBeCloseTo(100_000 - y.principal, 6);
    expect(y.interest).toBeGreaterThan(y.principal); // early in a 30-year loan
  });
  it('fully pays off a loan without overpaying', () => {
    const pmt = monthlyPayment(10_000, 0.05, 1);
    const y = amortizeYear(10_000, 0.05, pmt);
    expect(y.balance).toBe(0);
    expect(y.paid).toBeCloseTo(pmt * 12, 2);
    const again = amortizeYear(0, 0.05, pmt);
    expect(again.paid).toBe(0);
  });
});

describe('requiredAnnualContribution', () => {
  it('returns 0 when the start already grows past the target', () => {
    expect(requiredAnnualContribution(100_000, 150_000, 0.07, 10)).toBe(0);
  });
  it('reaches the target exactly when contributed each year', () => {
    const c = requiredAnnualContribution(10_000, 100_000, 0.05, 10);
    let bal = 10_000;
    for (let i = 0; i < 10; i++) bal = bal * 1.05 + c;
    expect(bal).toBeCloseTo(100_000, 4);
  });
  it('grow compounds', () => {
    expect(grow(1000, 0.1, 2)).toBeCloseTo(1210, 6);
  });
});
