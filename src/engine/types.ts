/**
 * Plan schema: every assumption the projection consumes.
 * Money inputs are in TODAY'S dollars unless the field name says otherwise;
 * the engine inflates them as the years advance.
 */

export interface Meta {
  name: string;
  /** Calendar year the projection starts (the current year). */
  startYear: number;
  currentAge: number;
  /** Age at which the plan ends and the estate is passed on. */
  deathAge: number;
  currency: string;
}

export interface Income {
  /** Gross annual salary today. */
  salary: number;
  /** Annual nominal raise rate (0.03 = 3%). */
  salaryGrowth: number;
  /** Combined effective federal + state + FICA rate on earned income. */
  effectiveTaxRate: number;
  /** Age salary stops. */
  retireAge: number;
  /** Gross annual retirement income from that age (pension, social security), today's dollars. */
  retirementIncome: number;
  /** Other annual income today (side business, ministry stipend), today's dollars. */
  otherIncome: number;
  spouse: {
    /** Spouse gross annual income (today's dollars) once married. */
    annualIncome: number;
    /** If true, spouse income stops the year the first child arrives. */
    stopsAtFirstChild: boolean;
  };
}

export interface Spending {
  /** Personal spending per month today EXCLUDING rent/housing (groceries, car, phone, fun...). */
  monthlyBase: number;
  /** Current monthly rent. */
  monthlyRent: number;
  /** General inflation applied to expenses (0.03 = 3%). */
  inflation: number;
  /** Giving floor: share of gross income always given (the tithe). */
  givingRate: number;
  /**
   * Generosity above provision: share of salary earned ABOVE the provision
   * salary that is given away as well. 0 keeps every extra dollar; 1 gives it all.
   */
  surplusGivingRate: number;
  /**
   * The salary that provides for the family (today's dollars). null = use the
   * salary the plan needs to run with no shortfall, computed automatically.
   */
  provisionSalary: number | null;
  /** Multiplier on monthlyBase once married (two adults, one household). */
  marriedMultiplier: number;
  /** Multiplier on household base spending after retirement. */
  retirementMultiplier: number;
  travel: {
    /** Round-trip flights per household member per year. */
    flightsPerPersonPerYear: number;
    /** Average round-trip ticket cost, today's dollars. */
    avgTicketCost: number;
    /** Other annual travel (lodging, ministry trips), today's dollars. */
    extraTravelPerYear: number;
  };
}

export interface Family {
  /** Age you get married. Set null for never. */
  marriageAge: number | null;
  childrenCount: number;
  /** Years after marriage the first child arrives. */
  firstChildAfterMarriage: number;
  /** Average spacing between children in years. */
  yearsBetweenChildren: number;
  /** Annual cost of the first child, today's dollars (food, clothes, activities, healthcare, extra space). */
  firstChildCost: number;
  /** Annual marginal cost of each additional child, today's dollars (economies of scale). */
  additionalChildCost: number;
  /** Age a child leaves the household budget. */
  independenceAge: number;
  /** Total you intend to contribute to each child's college/launch, today's dollars, spread over ages 18-21. */
  launchFundPerChild: number;
}

export interface Housing {
  /** Age you buy a primary home. null = rent for life. */
  buyHomeAge: number | null;
  /** Purchase price, today's dollars. */
  homePrice: number;
  downPaymentRate: number;
  mortgageRate: number;
  mortgageYears: number;
  /** Property tax + insurance + maintenance per year as a share of home value. */
  ownershipCostRate: number;
  appreciation: number;
  /** Closing costs as a share of price. */
  closingCostRate: number;
}

export interface Rentals {
  enabled: boolean;
  /** Age of the first rental purchase (if cash allows). */
  firstPurchaseAge: number;
  yearsBetweenPurchases: number;
  targetCount: number;
  /** Price per rental, today's dollars. */
  price: number;
  downPaymentRate: number;
  closingCostRate: number;
  mortgageRate: number;
  mortgageYears: number;
  /** Annual gross rent / price (0.08 = $2,000/mo on $300k). */
  grossYield: number;
  vacancyRate: number;
  /** Taxes, insurance, maintenance, management as a share of collected rent. */
  operatingExpenseRate: number;
  appreciation: number;
  rentGrowth: number;
  /** Months of household expenses to keep in cash before a purchase is allowed. */
  reserveMonths: number;
}

export interface Savings {
  /** Cash + investments + retirement accounts you hold today. */
  current: number;
  /** Nominal annual return on invested savings. */
  returnRate: number;
  /** Safe withdrawal rate used for the financial-freedom test. */
  safeWithdrawalRate: number;
  goal: {
    /** Savings target, today's dollars. */
    amount: number;
    /** Age by which you want to reach it. */
    byAge: number;
  };
}

export interface Plan {
  meta: Meta;
  income: Income;
  spending: Spending;
  family: Family;
  housing: Housing;
  rentals: Rentals;
  savings: Savings;
}

/** One rental property tracked through the projection. */
export interface Property {
  purchasedYear: number;
  purchasePrice: number;
  value: number;
  loanBalance: number;
  monthlyPayment: number;
  annualRent: number;
}

export interface YearExpenses {
  living: number;
  housing: number;
  children: number;
  launchFund: number;
  /** Total giving: floor + surplus. */
  giving: number;
  /** The part of giving that came from income above provision. */
  givingSurplus: number;
  travel: number;
  total: number;
}

export interface YearRow {
  year: number;
  age: number;
  married: boolean;
  retired: boolean;
  /** Ages of all children born so far (including those who have left home). */
  childrenAges: number[];
  childrenAtHome: number;

  salary: number;
  spouseIncome: number;
  otherIncome: number;
  grossEarned: number;
  taxes: number;
  netEarned: number;

  rentalGrossRent: number;
  rentalOperating: number;
  rentalDebtService: number;
  rentalInterest: number;
  rentalTaxes: number;
  /** Rent collected minus operating costs, debt service and taxes. */
  rentalCashFlow: number;

  expenses: YearExpenses;

  /** Net earned + rental cash flow - expenses - purchases (down payments). */
  cashFlow: number;
  purchases: number;
  investmentReturn: number;

  investments: number;
  homeValue: number;
  homeDebt: number;
  homeEquity: number;
  rentalValue: number;
  rentalDebt: number;
  rentalEquity: number;
  netWorth: number;

  rentalsOwned: number;
  /** Rental cash flow + safe withdrawal on investments. */
  passiveIncome: number;
  financiallyFree: boolean;
  /** Factor to convert this year's nominal dollars into today's dollars. */
  deflator: number;
  events: string[];
}

export interface Summary {
  yearsProjected: number;
  deathYear: number;
  marriageYear: number | null;
  childrenBornYears: number[];
  financialFreedomAge: number | null;
  rentalFreedomAge: number | null;
  savingsGoalReachedAge: number | null;
  /** Monthly contribution required (today's dollars, level in real terms) to hit the goal purely from savings growth. */
  requiredMonthlyForGoal: number;
  /** Salary treated as "providing for the family"; income above it feeds surplus giving. null when unknown. */
  provisionSalary: number | null;
  /** Whether provisionSalary was computed (true) or entered by hand (false). */
  provisionAuto: boolean;
  peakExpenseYear: YearRow;
  rentalsAcquired: number;
  rentalsDelayedYears: number;
  shortfallYears: number[];
  estate: {
    nominal: number;
    todayDollars: number;
    perChildNominal: number;
    perChildToday: number;
    investments: number;
    homeEquity: number;
    rentalEquity: number;
  };
  lifetime: {
    grossEarned: number;
    taxes: number;
    giving: number;
    givingSurplus: number;
    childrenCost: number;
    rentalCashFlow: number;
    expenses: number;
  };
}

export interface Projection {
  plan: Plan;
  rows: YearRow[];
  summary: Summary;
}
