import type { Plan, Projection, Property, Summary, YearExpenses, YearRow } from './types.ts';
import { amortizeYear, monthlyPayment, requiredAnnualContribution } from './finance.ts';

/** Residential rental depreciation: 27.5 years straight-line on the building share of price. */
const DEPRECIATION_YEARS = 27.5;
const BUILDING_SHARE = 0.8;

/** Ages (of the owner) at which each child is born, in birth order. Empty when never married. */
export function childBirthAges(plan: Plan): number[] {
  const { marriageAge, childrenCount, firstChildAfterMarriage, yearsBetweenChildren } = plan.family;
  if (marriageAge === null || childrenCount <= 0) return [];
  const ages: number[] = [];
  for (let k = 0; k < childrenCount; k++) {
    ages.push(marriageAge + firstChildAfterMarriage + Math.round(k * yearsBetweenChildren));
  }
  return ages;
}

interface HomeState {
  value: number;
  loan: number;
  payment: number;
}

/** Run the full year-by-year projection from the current age to the death age. */
export function project(plan: Plan): Projection {
  const { meta, income, spending, family, housing, rentals, savings } = plan;
  const years = Math.max(0, meta.deathAge - meta.currentAge);
  const birthAges = childBirthAges(plan);

  const rows: YearRow[] = [];
  let investments = savings.current;
  let home: HomeState | null = null;
  const properties: Property[] = [];
  let lastRentalPurchaseAge: number | null = null;
  let rentalsDelayedYears = 0;
  let delayedLastYear = false;
  let shortfallLastYear = false;
  let freedomAnnounced = false;
  let goalAnnounced = false;
  let childrenLeft = 0;

  for (let t = 0; t <= years; t++) {
    const age = meta.currentAge + t;
    const year = meta.startYear + t;
    const infl = Math.pow(1 + spending.inflation, t);
    const deflator = 1 / infl;
    const events: string[] = [];

    // ---- family state -------------------------------------------------
    const married = family.marriageAge !== null && age >= family.marriageAge;
    if (family.marriageAge !== null && age === family.marriageAge) events.push('Married');
    const childrenAges = birthAges.filter((b) => age >= b).map((b) => age - b);
    birthAges.forEach((b, i) => {
      if (b === age) events.push(`Child ${i + 1} born`);
    });
    const childrenAtHome = childrenAges.filter((a) => a < family.independenceAge).length;
    const nowLeft = childrenAges.filter((a) => a >= family.independenceAge).length;
    if (nowLeft > childrenLeft) {
      events.push(nowLeft - childrenLeft === 1 ? 'A child leaves home' : `${nowLeft - childrenLeft} children leave home`);
      childrenLeft = nowLeft;
    }
    const firstChildBorn = childrenAges.length > 0;

    // ---- earned income ------------------------------------------------
    const retired = age >= income.retireAge;
    if (age === income.retireAge) events.push('Retired');
    const salary = retired ? 0 : income.salary * Math.pow(1 + income.salaryGrowth, t);
    const retirementIncome = retired ? income.retirementIncome * infl : 0;
    const spouseWorks = married && !retired && !(income.spouse.stopsAtFirstChild && firstChildBorn);
    const spouseIncome = spouseWorks ? income.spouse.annualIncome * infl : 0;
    const otherIncome = income.otherIncome * infl;
    const grossEarned = salary + retirementIncome + spouseIncome + otherIncome;
    const taxes = grossEarned * income.effectiveTaxRate;
    const netEarned = grossEarned - taxes;

    // ---- primary home -------------------------------------------------
    let purchases = 0;
    let housingCost: number;
    if (housing.buyHomeAge !== null && age === housing.buyHomeAge && home === null) {
      const price = housing.homePrice * infl;
      const down = price * housing.downPaymentRate;
      const closing = price * housing.closingCostRate;
      const loan = price - down;
      home = { value: price, loan, payment: monthlyPayment(loan, housing.mortgageRate, housing.mortgageYears) };
      purchases += down + closing;
      events.push(`Bought home for ${fmt(price)} (${fmt(down + closing)} cash)`);
    }
    if (home) {
      const amort = amortizeYear(home.loan, housing.mortgageRate, home.payment);
      home.loan = amort.balance;
      housingCost = amort.paid + home.value * housing.ownershipCostRate;
      if (amort.balance === 0 && amort.paid > 0 && amort.principal > 0 && amort.paid < home.payment * 12) {
        events.push('Home mortgage paid off');
      }
    } else {
      housingCost = spending.monthlyRent * 12 * infl;
    }

    // ---- rental portfolio: this year's operations ---------------------
    let rentalGrossRent = 0;
    let rentalOperating = 0;
    let rentalDebtService = 0;
    let rentalInterest = 0;
    let rentalDepreciation = 0;
    for (const p of properties) {
      const collected = p.annualRent * (1 - rentals.vacancyRate);
      const operating = collected * rentals.operatingExpenseRate;
      const amort = amortizeYear(p.loanBalance, rentals.mortgageRate, p.monthlyPayment);
      p.loanBalance = amort.balance;
      rentalGrossRent += collected;
      rentalOperating += operating;
      rentalDebtService += amort.paid;
      rentalInterest += amort.interest;
      if (year - p.purchasedYear < DEPRECIATION_YEARS) {
        rentalDepreciation += (p.purchasePrice * BUILDING_SHARE) / DEPRECIATION_YEARS;
      }
    }
    const rentalTaxable = rentalGrossRent - rentalOperating - rentalInterest - rentalDepreciation;
    const rentalTaxes = Math.max(0, rentalTaxable) * income.effectiveTaxRate;
    const rentalCashFlow = rentalGrossRent - rentalOperating - rentalDebtService - rentalTaxes;

    // ---- household expenses ------------------------------------------
    let mult = married ? spending.marriedMultiplier : 1;
    if (retired) mult *= spending.retirementMultiplier;
    const living = spending.monthlyBase * 12 * mult * infl;
    const children =
      childrenAtHome > 0 ? (family.firstChildCost + (childrenAtHome - 1) * family.additionalChildCost) * infl : 0;
    const launching = childrenAges.filter((a) => a >= 18 && a <= 21).length;
    const launchFund = (launching * family.launchFundPerChild * infl) / 4;
    const giving = spending.givingRate * (grossEarned + Math.max(0, rentalCashFlow));
    const adults = married ? 2 : 1;
    const travel =
      ((adults + childrenAtHome) * spending.travel.flightsPerPersonPerYear * spending.travel.avgTicketCost +
        spending.travel.extraTravelPerYear) *
      infl;
    const expenses: YearExpenses = {
      living,
      housing: housingCost,
      children,
      launchFund,
      giving,
      travel,
      total: living + housingCost + children + launchFund + giving + travel,
    };

    // ---- cash flow and investments -----------------------------------
    const investmentReturn = Math.max(0, investments) * savings.returnRate;
    let cashFlow = netEarned + rentalCashFlow - expenses.total;
    investments += investmentReturn + cashFlow - purchases;

    // ---- rental purchase decision (after this year's saving) ---------
    let boughtRental = false;
    if (
      rentals.enabled &&
      age >= rentals.firstPurchaseAge &&
      properties.length < rentals.targetCount &&
      (lastRentalPurchaseAge === null || age - lastRentalPurchaseAge >= rentals.yearsBetweenPurchases)
    ) {
      const price = rentals.price * infl;
      const cashNeeded = price * (rentals.downPaymentRate + rentals.closingCostRate);
      const reserve = (rentals.reserveMonths / 12) * expenses.total;
      if (investments - cashNeeded >= reserve) {
        delayedLastYear = false;
        const loan = price * (1 - rentals.downPaymentRate);
        properties.push({
          purchasedYear: year,
          purchasePrice: price,
          value: price,
          loanBalance: loan,
          monthlyPayment: monthlyPayment(loan, rentals.mortgageRate, rentals.mortgageYears),
          annualRent: price * rentals.grossYield,
        });
        investments -= cashNeeded;
        purchases += cashNeeded;
        lastRentalPurchaseAge = age;
        boughtRental = true;
        events.push(`Rental #${properties.length} bought for ${fmt(price)} (${fmt(cashNeeded)} cash)`);
      } else {
        rentalsDelayedYears++;
        if (!delayedLastYear) {
          events.push(`Rental purchase delayed: need ${fmt(cashNeeded + reserve)} incl. reserve, have ${fmt(investments)}`);
        }
        delayedLastYear = true;
      }
    }
    cashFlow -= purchases;

    // ---- balance sheet at year end -----------------------------------
    const homeValue = home ? home.value : 0;
    const homeDebt = home ? home.loan : 0;
    const rentalValue = properties.reduce((s, p) => s + p.value, 0);
    const rentalDebt = properties.reduce((s, p) => s + p.loanBalance, 0);
    const netWorth = investments + (homeValue - homeDebt) + (rentalValue - rentalDebt);
    const passiveIncome = rentalCashFlow + Math.max(0, investments) * savings.safeWithdrawalRate;
    const financiallyFree = investments >= 0 && passiveIncome >= expenses.total;
    if (financiallyFree && !freedomAnnounced) {
      events.push('Financially free: passive income covers expenses');
      freedomAnnounced = true;
    }
    if (!goalAnnounced && investments >= savings.goal.amount) {
      events.push(`Savings goal of ${fmt(savings.goal.amount)} reached`);
      goalAnnounced = true;
    }
    if (investments < 0 && !shortfallLastYear) events.push(`Shortfall: savings exhausted, ${fmt(-investments)} short`);
    if (investments >= 0 && shortfallLastYear) events.push('Back above zero savings');
    shortfallLastYear = investments < 0;
    if (t === years) events.push(`Estate of ${fmt(netWorth)} passed on`);

    rows.push({
      year,
      age,
      married,
      retired,
      childrenAges,
      childrenAtHome,
      salary,
      spouseIncome,
      otherIncome: otherIncome + retirementIncome,
      grossEarned,
      taxes,
      netEarned,
      rentalGrossRent,
      rentalOperating,
      rentalDebtService,
      rentalInterest,
      rentalTaxes,
      rentalCashFlow,
      expenses,
      cashFlow,
      purchases,
      investmentReturn,
      investments,
      homeValue,
      homeDebt,
      homeEquity: homeValue - homeDebt,
      rentalValue,
      rentalDebt,
      rentalEquity: rentalValue - rentalDebt,
      netWorth,
      rentalsOwned: properties.length,
      passiveIncome,
      financiallyFree,
      deflator,
      events,
    });

    // ---- roll asset values forward to next year ----------------------
    if (home) home.value *= 1 + housing.appreciation;
    for (const p of properties) {
      p.value *= 1 + rentals.appreciation;
      // A property bought this year starts earning next year; existing rents grow.
      if (!(boughtRental && p.purchasedYear === year)) p.annualRent *= 1 + rentals.rentGrowth;
    }
  }

  return { plan, rows, summary: summarize(plan, rows, birthAges, rentalsDelayedYears) };
}

function summarize(plan: Plan, rows: YearRow[], birthAges: number[], rentalsDelayedYears: number): Summary {
  const last = rows[rows.length - 1];
  const { meta, savings, family } = plan;
  const yearOf = (age: number) => meta.startYear + (age - meta.currentAge);

  const freeRow = rows.find((r) => r.financiallyFree);
  const rentalFreeRow = rows.find((r) => r.rentalCashFlow >= r.expenses.total);
  const goalRow = rows.find((r) => r.investments >= savings.goal.amount);
  const peak = rows.reduce((best, r) => (r.expenses.total * r.deflator > best.expenses.total * best.deflator ? r : best), rows[0]);

  const sum = (f: (r: YearRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const childrenCount = Math.max(1, family.marriageAge === null ? 0 : family.childrenCount);

  return {
    yearsProjected: rows.length,
    deathYear: last.year,
    marriageYear: family.marriageAge === null ? null : yearOf(family.marriageAge),
    childrenBornYears: birthAges.map(yearOf),
    financialFreedomAge: freeRow ? freeRow.age : null,
    rentalFreedomAge: rentalFreeRow ? rentalFreeRow.age : null,
    savingsGoalReachedAge: goalRow ? goalRow.age : null,
    requiredMonthlyForGoal:
      requiredAnnualContribution(savings.current, savings.goal.amount, savings.returnRate, savings.goal.byAge - meta.currentAge) / 12,
    peakExpenseYear: peak,
    rentalsAcquired: last.rentalsOwned,
    rentalsDelayedYears,
    shortfallYears: rows.filter((r) => r.investments < 0).map((r) => r.year),
    estate: {
      nominal: last.netWorth,
      todayDollars: last.netWorth * last.deflator,
      perChildNominal: last.netWorth / childrenCount,
      perChildToday: (last.netWorth * last.deflator) / childrenCount,
      investments: last.investments,
      homeEquity: last.homeEquity,
      rentalEquity: last.rentalEquity,
    },
    lifetime: {
      grossEarned: sum((r) => r.grossEarned),
      taxes: sum((r) => r.taxes + r.rentalTaxes),
      giving: sum((r) => r.expenses.giving),
      childrenCost: sum((r) => r.expenses.children + r.expenses.launchFund),
      rentalCashFlow: sum((r) => r.rentalCashFlow),
      expenses: sum((r) => r.expenses.total),
    },
  };
}

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Deep-copy a plan with a different salary. */
function withSalary(plan: Plan, salary: number): Plan {
  const p = structuredClone(plan);
  p.income.salary = salary;
  return p;
}

/**
 * Smallest gross salary (today's dollars, growing at salaryGrowth) that satisfies `ok`.
 * Binary search; returns null if even `max` fails.
 */
export function solveSalary(plan: Plan, ok: (p: Projection) => boolean, max = 5_000_000): number | null {
  if (!ok(project(withSalary(plan, max)))) return null;
  let lo = 0;
  let hi = max;
  if (ok(project(withSalary(plan, lo)))) return 0;
  while (hi - lo > 250) {
    const mid = (lo + hi) / 2;
    if (ok(project(withSalary(plan, mid)))) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 500) * 500;
}

export interface RequiredIncome {
  /** Salary at which savings never drop below zero. */
  noShortfall: number | null;
  /** Salary at which passive income covers expenses by the retirement age. */
  freeByRetirement: number | null;
  /** Salary at which the savings goal is reached by its target age. */
  savingsGoalOnTime: number | null;
}

/** The headline "how much do I need to earn" numbers. */
export function requiredIncome(plan: Plan): RequiredIncome {
  return {
    noShortfall: solveSalary(plan, (p) => p.summary.shortfallYears.length === 0),
    freeByRetirement: solveSalary(
      plan,
      (p) => p.summary.shortfallYears.length === 0 && p.summary.financialFreedomAge !== null && p.summary.financialFreedomAge <= plan.income.retireAge,
    ),
    savingsGoalOnTime: solveSalary(
      plan,
      (p) => p.summary.savingsGoalReachedAge !== null && p.summary.savingsGoalReachedAge <= plan.savings.goal.byAge,
    ),
  };
}
