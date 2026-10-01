/**
 * Real estate approaches: long-term rental houses, small multiplexes (2-4
 * units) and short-term rentals (Airbnb), each in three kinds of market.
 *
 * Figures are illustrative starting points drawn from 2025-2026 market data
 * (ATTOM single-family rental yields, Arbor small multifamily cap rates,
 * AirDNA short-term rental outlook). Every market differs; check local rents,
 * prices, taxes, insurance and short-term rental rules before buying.
 */
import type { Plan, Rentals } from './types.ts';
import { project } from './project.ts';
import { monthlyPayment } from './finance.ts';
import { solveSupport, type SupportNeed } from './gap.ts';

export type PresetFields = Pick<
  Rentals,
  'price' | 'grossYield' | 'vacancyRate' | 'operatingExpenseRate' | 'closingCostRate' | 'mortgageRate' | 'appreciation' | 'rentGrowth'
>;

export interface PropertyType {
  id: 'house' | 'multiplex' | 'airbnb';
  name: string;
  detail: string;
}
export interface Market {
  id: 'affordable' | 'average' | 'pricey';
  name: string;
  detail: string;
}

export const propertyTypes: PropertyType[] = [
  { id: 'house', name: 'Rental house', detail: 'One family on a 12-month lease.' },
  { id: 'multiplex', name: 'Small multiplex', detail: 'Two to four units under one roof and one loan.' },
  { id: 'airbnb', name: 'Airbnb', detail: 'Furnished, rented by the night. More income, more work and more swings.' },
];

export const markets: Market[] = [
  { id: 'affordable', name: 'Affordable market', detail: 'Lower prices, higher rent for the price (much of the Midwest and South).' },
  { id: 'average', name: 'Typical market', detail: 'Near national averages.' },
  { id: 'pricey', name: 'Pricey or resort market', detail: 'High prices, lower rent for the price, stronger appreciation.' },
];

/**
 * grossYield is a year of rent at full occupancy divided by price; for an
 * Airbnb it is a year of booking revenue at typical occupancy, so its
 * vacancy only covers slow years. Airbnb closing costs include furnishing.
 */
export const presets: Record<PropertyType['id'], Record<Market['id'], PresetFields>> = {
  house: {
    affordable: { price: 200_000, grossYield: 0.11, vacancyRate: 0.06, operatingExpenseRate: 0.4, closingCostRate: 0.03, mortgageRate: 0.07, appreciation: 0.025, rentGrowth: 0.025 },
    average: { price: 320_000, grossYield: 0.075, vacancyRate: 0.06, operatingExpenseRate: 0.38, closingCostRate: 0.03, mortgageRate: 0.07, appreciation: 0.035, rentGrowth: 0.03 },
    pricey: { price: 650_000, grossYield: 0.05, vacancyRate: 0.05, operatingExpenseRate: 0.35, closingCostRate: 0.03, mortgageRate: 0.07, appreciation: 0.04, rentGrowth: 0.035 },
  },
  multiplex: {
    affordable: { price: 360_000, grossYield: 0.135, vacancyRate: 0.07, operatingExpenseRate: 0.42, closingCostRate: 0.03, mortgageRate: 0.07, appreciation: 0.025, rentGrowth: 0.025 },
    average: { price: 650_000, grossYield: 0.11, vacancyRate: 0.06, operatingExpenseRate: 0.42, closingCostRate: 0.03, mortgageRate: 0.07, appreciation: 0.03, rentGrowth: 0.03 },
    pricey: { price: 1_300_000, grossYield: 0.08, vacancyRate: 0.05, operatingExpenseRate: 0.4, closingCostRate: 0.03, mortgageRate: 0.07, appreciation: 0.04, rentGrowth: 0.035 },
  },
  airbnb: {
    affordable: { price: 350_000, grossYield: 0.17, vacancyRate: 0.08, operatingExpenseRate: 0.55, closingCostRate: 0.09, mortgageRate: 0.0775, appreciation: 0.025, rentGrowth: 0.025 },
    average: { price: 500_000, grossYield: 0.155, vacancyRate: 0.08, operatingExpenseRate: 0.55, closingCostRate: 0.08, mortgageRate: 0.0775, appreciation: 0.03, rentGrowth: 0.03 },
    pricey: { price: 950_000, grossYield: 0.12, vacancyRate: 0.1, operatingExpenseRate: 0.55, closingCostRate: 0.07, mortgageRate: 0.0775, appreciation: 0.04, rentGrowth: 0.03 },
  },
};

export function applyRealEstate(plan: Plan, type: PropertyType['id'], market: Market['id']): Plan {
  const p = structuredClone(plan);
  Object.assign(p.rentals, presets[type][market], { enabled: true, propertyType: type, market });
  return p;
}

export interface RealEstateResult {
  type: PropertyType;
  market: Market;
  price: number;
  /** Cash for down payment, closing (and furnishing for an Airbnb). */
  cashPerProperty: number;
  /** Rent or bookings collected per month, first year. */
  incomePerMonth: number;
  /** After operating costs and the mortgage, before income tax, first year. */
  cashFlowPerMonth: number;
  /** Yearly cash flow divided by cash put in. */
  cashOnCash: number;
  /** Age cash runs out with this approach (before selling any rental), or null. */
  runsOutAge: number | null;
  /** Support needed to never run short and reach the legacy goal. */
  supportForGoal: SupportNeed;
  current: boolean;
}

const reachesGoal = (p: Plan) => {
  const s = project(p).summary;
  return s.shortfallYears.length === 0 && s.legacy.perChildTotalToday >= p.legacy.perChild;
};

export function firstYear(f: PresetFields, downPaymentRate: number, mortgageYears: number) {
  const cash = f.price * (downPaymentRate + f.closingCostRate);
  const income = (f.price * f.grossYield * (1 - f.vacancyRate)) / 12;
  const pmt = monthlyPayment(f.price * (1 - downPaymentRate), f.mortgageRate, mortgageYears);
  const cashFlow = income * (1 - f.operatingExpenseRate) - pmt;
  return { cash, income, cashFlow, cashOnCash: (cashFlow * 12) / cash };
}

export function compareRealEstate(plan: Plan, market: Market['id']): RealEstateResult[] {
  const m = markets.find((x) => x.id === market)!;
  return propertyTypes.map((t) => {
    const p = applyRealEstate(plan, t.id, market);
    const fy = firstYear(presets[t.id][market], p.rentals.downPaymentRate, p.rentals.mortgageYears);
    const noSell = structuredClone(p);
    noSell.rentals.sellWhenShort = false;
    noSell.spending.surplusGivingRate = 0;
    const short = project(noSell).summary.shortfallYears[0];
    return {
      type: t,
      market: m,
      price: presets[t.id][market].price,
      cashPerProperty: fy.cash,
      incomePerMonth: fy.income,
      cashFlowPerMonth: fy.cashFlow,
      cashOnCash: fy.cashOnCash,
      runsOutAge: short === undefined ? null : short - p.meta.startYear + p.meta.currentAge,
      supportForGoal: solveSupport(p, reachesGoal),
      current: plan.rentals.enabled && plan.rentals.propertyType === t.id && plan.rentals.market === market,
    };
  });
}
