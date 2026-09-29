# Financial Planning

A lifetime financial planner. It projects income, spending, family costs, a
rental-property portfolio, savings and net worth **year by year from today
until the plan's end age**, then reports what the life you describe actually
costs: the salary it needs, when passive income covers spending, when the
savings goal lands, and what is left for each child.

Everything is an editable assumption. The plan lives in your browser
(localStorage) and can be exported/imported as JSON. Actual spending is pulled
from the budgeting app through a small JSON contract.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests
npm run typecheck
npm run build      # static site in dist/
```

Raw numbers in the terminal (also writes `out/projection.csv`):

```
npm run project                     # baseline
npm run project -- data/plan.json --all --real
```

Pull actuals from the budgeting app into a plan file:

```
npm run import-budget -- data/budget-export.sample.json --out data/plan.json
```

The `main` branch deploys to GitHub Pages through
`.github/workflows/pages.yml` (enable Pages with the "GitHub Actions" source
in the repository settings once).

## What the model does

Each year, in order:

1. **Family state.** Marriage at the chosen age; children arrive at the
   configured spacing; a child leaves the budget at the independence age.
2. **Earned income.** Salary grows at the raise rate until the retirement age,
   then retirement income takes over. Optional spouse income can stop at the
   first child. A single effective tax rate is applied.
3. **Home.** Rent until the purchase age, then a fixed-rate mortgage plus
   tax/insurance/upkeep as a share of value. The home appreciates.
4. **Rentals.** Each owned house collects rent (less vacancy), pays operating
   costs, mortgage and tax (with 27.5-year depreciation). A new house is bought
   when it is due *and* cash after the down payment still covers the reserve;
   otherwise the purchase is delayed and noted.
5. **Spending.** Base living costs (× a married multiplier), housing, children
   (first child cost + a marginal cost per additional child), launch funds at
   ages 18-21, giving as a share of income, and travel priced as flights per
   household member plus other travel. All inflate.
6. **Savings.** Investments earn the return rate, receive the year's cash flow
   and fund purchases. A negative balance is a **shortfall** and is flagged.
7. **Freedom tests.** Passive income = rental cash flow + safe-withdrawal rate ×
   investments. "Financially free" is the first year that covers spending.
8. **Estate.** Net worth in the final year, nominal and in today's dollars,
   divided equally among the children.

Solvers then binary-search the salary at which the plan has no shortfall, at
which passive income covers spending by retirement, and at which the savings
goal lands on time. These are the headline numbers.

Not modelled (on purpose, for now): progressive tax brackets, retirement
account rules, selling properties, spouse-specific retirement, and market
volatility. Returns and appreciation are smooth averages.

## Layout

```
src/engine/     pure projection engine, no browser dependencies
  types.ts      the Plan schema and per-year output row
  defaults.ts   the baseline plan
  project.ts    the year loop, summary and salary solvers
  finance.ts    mortgage and compounding math
  budget.ts     budgeting-app import contract and mapping
src/ui/         form, charts (Chart.js), results, budget panel
scripts/        terminal tools (project.ts, import-budget.ts)
tests/          vitest suites for the engine
data/           sample budget export
docs/           budgeting-integration.md (the data contract)
```

## Connecting the budgeting app

See [docs/budgeting-integration.md](docs/budgeting-integration.md). In short,
the budgeting app publishes a `budget-export.json` (monthly gross income and
category totals). The planner fetches it, averages the trailing months, shows
the mapping, and writes it into the plan on your say-so.
