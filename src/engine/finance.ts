/** Small, dependency-free money math. */

/** Fixed monthly payment for a fully amortizing loan. */
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const n = years * 12;
  if (annualRate === 0) return principal / n;
  const r = annualRate / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export interface AmortizedYear {
  interest: number;
  principal: number;
  paid: number;
  balance: number;
}

/** Run 12 months of payments against a balance. Final payment is capped at what is owed. */
export function amortizeYear(balance: number, annualRate: number, payment: number): AmortizedYear {
  let interest = 0;
  let principal = 0;
  let paid = 0;
  const r = annualRate / 12;
  for (let m = 0; m < 12 && balance > 0.005; m++) {
    const i = balance * r;
    const due = Math.min(payment, balance + i);
    const p = due - i;
    interest += i;
    principal += p;
    paid += due;
    balance -= p;
  }
  return { interest, principal, paid, balance: Math.max(0, balance) };
}

/** Value after n years of compounding. */
export function grow(amount: number, rate: number, years: number): number {
  return amount * Math.pow(1 + rate, years);
}

/**
 * Level annual contribution needed to reach `target` in `years` from `start`
 * at `rate`. Returns 0 when the start already grows past the target.
 */
export function requiredAnnualContribution(start: number, target: number, rate: number, years: number): number {
  if (years <= 0) return Math.max(0, target - start);
  const fv = grow(start, rate, years);
  const gap = target - fv;
  if (gap <= 0) return 0;
  if (rate === 0) return gap / years;
  const annuityFactor = (Math.pow(1 + rate, years) - 1) / rate;
  return gap / annuityFactor;
}

export function round(n: number, places = 0): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
