import type { Plan } from './types.ts';

/**
 * Example plan used until you enter your own numbers.
 * Rentals follow the recommended cash-flow approach (bought yearly from now,
 * rent near 10% of price, costs near 35% of rent) with a modest home.
 * Every value is a placeholder assumption to be edited in the app; your own
 * plan is stored encrypted on your device, never in this repository.
 */
export const defaultPlan: Plan = {
  meta: {
    name: 'Baseline',
    startYear: 2026,
    currentAge: 31,
    deathAge: 85,
    currency: 'USD',
  },
  legacy: {
    perChild: 500_000,
    stretchPerChild: 1_000_000,
    grandchildren: 20,
    perGrandchild: 0,
    giftHouseAtChildAge: null,
  },
  income: {
    salary: 0,
    salaryStartAge: 31,
    salaryGrowth: 0.035,
    effectiveTaxRate: 0.22,
    retireAge: 67,
    retirementIncome: 30_000,
    otherIncome: 0,
    support: {
      monthly: 0,
      startAge: 31,
      adminFeeRate: 0.1,
      avgGift: 100,
    },
    spouse: {
      annualIncome: 0,
      stopsAtFirstChild: true,
    },
  },
  spending: {
    monthlyBase: 4_500,
    monthlyRent: 1_000,
    inflation: 0.03,
    givingRate: 0.10,
    surplusGivingRate: 0.5,
    provisionSalary: null,
    marriedMultiplier: 1.5,
    retirementMultiplier: 0.85,
    travel: {
      flightsPerPersonPerYear: 2,
      avgTicketCost: 400,
      extraTravelPerYear: 2_000,
    },
  },
  family: {
    marriageAge: 36,
    childrenCount: 7,
    firstChildAfterMarriage: 1,
    yearsBetweenChildren: 1.75,
    firstChildCost: 12_000,
    additionalChildCost: 7_500,
    independenceAge: 19,
    launchFundPerChild: 20_000,
  },
  housing: {
    buyHomeAge: 37,
    homePrice: 340_000,
    downPaymentRate: 0.10,
    mortgageRate: 0.065,
    mortgageYears: 30,
    ownershipCostRate: 0.025,
    appreciation: 0.03,
    closingCostRate: 0.03,
  },
  rentals: {
    enabled: true,
    firstPurchaseAge: 31,
    yearsBetweenPurchases: 1,
    targetCount: 10,
    price: 275_000,
    downPaymentRate: 0.25,
    closingCostRate: 0.03,
    mortgageRate: 0.07,
    mortgageYears: 30,
    grossYield: 0.10,
    vacancyRate: 0.06,
    operatingExpenseRate: 0.35,
    appreciation: 0.03,
    rentGrowth: 0.03,
    reserveMonths: 6,
    sellWhenShort: true,
    sellingCostRate: 0.07,
    capitalGainsRate: 0.2,
  },
  savings: {
    current: 30_000,
    returnRate: 0.065,
    safeWithdrawalRate: 0.04,
    goal: {
      amount: 250_000,
      byAge: 40,
    },
  },
};

/** Deep clone so callers can mutate freely. */
export function freshPlan(): Plan {
  return structuredClone(defaultPlan);
}

/** Merge a partial/older plan onto the defaults so missing fields never crash the engine. */
export function withDefaults(partial: unknown): Plan {
  const base = freshPlan();
  if (!partial || typeof partial !== 'object') return base;
  return deepMerge(base, partial as Record<string, unknown>) as Plan;
}

function deepMerge(target: any, source: Record<string, unknown>): any {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object') {
      deepMerge(target[key], value as Record<string, unknown>);
    } else if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
}
