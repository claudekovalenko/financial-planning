/** Declarative description of every editable plan input, grouped by section. */
export type FieldKind = 'money' | 'nullableMoney' | 'percent' | 'int' | 'number' | 'age' | 'nullableAge' | 'bool' | 'text';

export interface Field {
  path: string;
  label: string;
  kind: FieldKind;
  help?: string;
  step?: number;
}

export interface Section {
  id: string;
  title: string;
  fields: Field[];
}

export const sections: Section[] = [
  {
    id: 'you',
    title: 'You',
    fields: [
      { path: 'meta.name', label: 'Plan name', kind: 'text' },
      { path: 'meta.startYear', label: 'Start year', kind: 'int' },
      { path: 'meta.currentAge', label: 'Current age', kind: 'age' },
      { path: 'meta.deathAge', label: 'Plan to age', kind: 'age', help: 'The estate is passed on at the end of this year.' },
    ],
  },
  {
    id: 'income',
    title: 'Income',
    fields: [
      { path: 'income.salary', label: 'Gross salary (per year)', kind: 'money', step: 1000 },
      { path: 'income.salaryGrowth', label: 'Annual raises', kind: 'percent', help: 'Nominal. 3.5% with 3% inflation is a 0.5% real raise.' },
      { path: 'income.effectiveTaxRate', label: 'Effective tax rate', kind: 'percent', help: 'Federal + state + FICA as a share of gross.' },
      { path: 'income.otherIncome', label: 'Other income (per year)', kind: 'money', step: 500 },
      { path: 'income.retireAge', label: 'Retire at age', kind: 'age' },
      { path: 'income.retirementIncome', label: 'Retirement income (per year, today $)', kind: 'money', step: 1000, help: 'Social security, pension.' },
      { path: 'income.spouse.annualIncome', label: 'Spouse income once married (per year)', kind: 'money', step: 1000 },
      { path: 'income.spouse.stopsAtFirstChild', label: 'Spouse income stops at first child', kind: 'bool' },
    ],
  },
  {
    id: 'spending',
    title: 'Spending today',
    fields: [
      { path: 'spending.monthlyBase', label: 'Monthly spending excl. rent', kind: 'money', step: 100, help: 'Groceries, car, insurance, phone, fun. Pull this from the budgeting app.' },
      { path: 'spending.monthlyRent', label: 'Monthly rent', kind: 'money', step: 50 },
      { path: 'spending.inflation', label: 'Inflation', kind: 'percent' },
      { path: 'spending.marriedMultiplier', label: 'Household spending multiplier when married', kind: 'number', step: 0.05, help: '1.5 = a couple spends 50% more than you do alone (excluding children).' },
      { path: 'spending.retirementMultiplier', label: 'Spending multiplier in retirement', kind: 'number', step: 0.05 },
      { path: 'spending.travel.flightsPerPersonPerYear', label: 'Round-trip flights per person per year', kind: 'number', step: 0.5 },
      { path: 'spending.travel.avgTicketCost', label: 'Average round-trip ticket', kind: 'money', step: 25 },
      { path: 'spending.travel.extraTravelPerYear', label: 'Other travel per year (lodging, ministry trips)', kind: 'money', step: 250 },
    ],
  },
  {
    id: 'giving',
    title: 'Giving',
    fields: [
      { path: 'spending.givingRate', label: 'Giving floor (share of gross income)', kind: 'percent', help: 'Always given, whatever the year looks like.' },
      { path: 'spending.surplusGivingRate', label: 'Of salary above provision, give', kind: 'percent', help: '100% gives away every dollar beyond what your family needs; 0% keeps it all.' },
      { path: 'spending.provisionSalary', label: 'Provision salary (today $)', kind: 'nullableMoney', step: 1000, help: 'What providing for the family takes. Blank = the salary the plan needs, computed for you.' },
    ],
  },
  {
    id: 'family',
    title: 'Family',
    fields: [
      { path: 'family.marriageAge', label: 'Marry at age', kind: 'nullableAge', help: 'Leave blank for never.' },
      { path: 'family.childrenCount', label: 'Number of children', kind: 'int' },
      { path: 'family.firstChildAfterMarriage', label: 'Years from marriage to first child', kind: 'number', step: 0.5 },
      { path: 'family.yearsBetweenChildren', label: 'Years between children', kind: 'number', step: 0.25 },
      { path: 'family.firstChildCost', label: 'First child cost (per year, today $)', kind: 'money', step: 500, help: 'Food, clothing, healthcare, activities, extra space.' },
      { path: 'family.additionalChildCost', label: 'Each additional child (per year, today $)', kind: 'money', step: 500, help: 'Hand-me-downs and shared rooms make later children cheaper.' },
      { path: 'family.independenceAge', label: 'Children leave the budget at age', kind: 'age' },
      { path: 'family.launchFundPerChild', label: 'College / launch fund per child (today $)', kind: 'money', step: 1000, help: 'Paid out over ages 18-21.' },
    ],
  },
  {
    id: 'housing',
    title: 'Home',
    fields: [
      { path: 'housing.buyHomeAge', label: 'Buy a home at age', kind: 'nullableAge', help: 'Blank = rent for life.' },
      { path: 'housing.homePrice', label: 'Home price (today $)', kind: 'money', step: 5000 },
      { path: 'housing.downPaymentRate', label: 'Down payment', kind: 'percent' },
      { path: 'housing.closingCostRate', label: 'Closing costs', kind: 'percent' },
      { path: 'housing.mortgageRate', label: 'Mortgage rate', kind: 'percent' },
      { path: 'housing.mortgageYears', label: 'Mortgage term (years)', kind: 'int' },
      { path: 'housing.ownershipCostRate', label: 'Tax + insurance + upkeep (% of value / yr)', kind: 'percent' },
      { path: 'housing.appreciation', label: 'Appreciation', kind: 'percent' },
    ],
  },
  {
    id: 'rentals',
    title: 'Rental portfolio',
    fields: [
      { path: 'rentals.enabled', label: 'Build a rental portfolio', kind: 'bool' },
      { path: 'rentals.firstPurchaseAge', label: 'First purchase at age', kind: 'age' },
      { path: 'rentals.yearsBetweenPurchases', label: 'Years between purchases', kind: 'number', step: 0.5 },
      { path: 'rentals.targetCount', label: 'Target number of houses', kind: 'int' },
      { path: 'rentals.price', label: 'Price per house (today $)', kind: 'money', step: 5000 },
      { path: 'rentals.downPaymentRate', label: 'Down payment', kind: 'percent' },
      { path: 'rentals.closingCostRate', label: 'Closing costs', kind: 'percent' },
      { path: 'rentals.mortgageRate', label: 'Mortgage rate', kind: 'percent' },
      { path: 'rentals.mortgageYears', label: 'Mortgage term (years)', kind: 'int' },
      { path: 'rentals.grossYield', label: 'Gross rent yield (annual rent / price)', kind: 'percent', help: '8.5% on $275k is about $1,950/mo.' },
      { path: 'rentals.vacancyRate', label: 'Vacancy', kind: 'percent' },
      { path: 'rentals.operatingExpenseRate', label: 'Operating costs (% of rent)', kind: 'percent', help: 'Taxes, insurance, repairs, management.' },
      { path: 'rentals.appreciation', label: 'Appreciation', kind: 'percent' },
      { path: 'rentals.rentGrowth', label: 'Rent growth', kind: 'percent' },
      { path: 'rentals.reserveMonths', label: 'Cash reserve before buying (months of expenses)', kind: 'number', step: 1 },
    ],
  },
  {
    id: 'savings',
    title: 'Savings',
    fields: [
      { path: 'savings.current', label: 'Savings and investments today', kind: 'money', step: 500 },
      { path: 'savings.returnRate', label: 'Investment return', kind: 'percent' },
      { path: 'savings.safeWithdrawalRate', label: 'Safe withdrawal rate', kind: 'percent', help: 'Used for the financial-freedom test.' },
      { path: 'savings.goal.amount', label: 'Savings goal', kind: 'money', step: 5000 },
      { path: 'savings.goal.byAge', label: 'Reach it by age', kind: 'age' },
    ],
  },
];

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  let o: any = obj;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]] = value;
}
