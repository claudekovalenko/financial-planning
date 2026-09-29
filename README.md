# Financial Planning

A lifetime financial planner. It projects income, spending, family costs, a
rental-property portfolio, savings and net worth **year by year from today
until the plan's end age**, then reports what the life you describe actually
costs: the salary it needs, when passive income covers spending, when the
savings goal lands, and what is left for each child.

Everything is an editable assumption. The app opens behind a password that
also encrypts your plan on the device (AES-GCM, key derived with PBKDF2), so
nothing readable is stored and nothing is sent anywhere. There is no password
recovery: "Forgot password" erases the saved plan and starts over.

**Moving a plan between devices.** "Save encrypted copy" saves the scrambled
plan as a file (on iPhone, choose "Save to Files" and iCloud Drive). On the
other device, "Load copy" opens that file with the password it was saved
under. The copy is useless without the password, and no readable export
exists. Actual spending is pulled
from the budgeting app through a small JSON contract.

## The main screen

The app opens on one question: how much can you spend each month and still
leave each child a chosen amount, in today's dollars, when the plan ends?

- **The answer** shows the monthly spending that leaves each child between a
  goal and a stretch amount (for example $500,000 to $1,000,000), after an
  optional amount set aside for each grandchild, and what happens at the
  spending you have entered.
- **Homes** shows how many houses pass to the family. You can choose to give
  each child one rental house at an age of your choosing, such as when they
  start their own family; the child takes it with its remaining loan, the
  equity counts toward their share, and the portfolio keeps buying to
  replace it.
- **One chart** compares what you own over your life on both paths. The end
  of each line is what passes to your children.
- **Two short input groups**: your legacy (goal and stretch per child,
  grandchildren, house gifts) and your life today (savings, spending, rent,
  age, marriage age, children, plan-to age). Everything else is under
  "Show all details".
- **Versions**: save the current numbers, change them, save again, and
  compare. "Open" returns to a saved version. Versions are stored with the
  plan, encrypted on the device, and travel with encrypted copies.

The example plan follows the recommended approach: rentals bought one a
year from now with rent near 10% of the price and running costs near 35% of
rent, and a modest home.

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
`.github/workflows/pages.yml` once the repository is public and Pages is
enabled (Settings, Pages, Source: "GitHub Actions"). The site then lives at
https://claudekovalenko.github.io/financial-planning/.

## Hosting as an installable app

A PWA needs an HTTPS host. The repo is private, so GitHub Pages needs a paid
plan; Netlify and Vercel host private repos for free. Settings for both are
committed (`netlify.toml`, `vercel.json`), so there is nothing to configure:

- **Netlify:** app.netlify.com, "Add new site", "Import an existing project",
  GitHub, pick `financial-planning`, Deploy.
- **Vercel:** vercel.com/new, sign in with GitHub, import `financial-planning`,
  Deploy.

Every push to `main` redeploys automatically.

## Install it on your phone

The site is a progressive web app: it installs to the home screen, opens
full-screen, and keeps working offline from the cached build. Your plan is
stored on the device.

- **Android (Chrome):** open the site, tap **Install** in the banner (or the
  browser menu, "Add to Home screen").
- **iPhone (Safari):** open the site, tap the Share button, then
  **Add to Home Screen**. Other iOS browsers cannot install web apps.
- **Desktop (Chrome/Edge):** the install icon appears in the address bar.

When a new version is deployed the app shows a "Reload" banner.

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
   otherwise the purchase is delayed and noted. If savings would run out,
   rentals are sold (largest net proceeds first, after selling costs, the
   loan and tax on the gain) until the reserve is refilled, and no more are
   bought after that. The salary and investment targets exclude forced sales:
   they describe a plan that works without liquidating the portfolio.
5. **Spending.** Base living costs (× a married multiplier), housing, children
   (first child cost + a marginal cost per additional child), launch funds at
   ages 18-21, giving, and travel priced as flights per household member plus
   other travel. All inflate.
6. **Giving.** Two layers. The *floor* is a share of all income (earned, rental cash flow and
   investment returns; 10% by default) given every year no matter what. *Generosity above provision*
   gives a chosen share of any salary earned above the **provision salary**,
   the amount that provides for the family. Leave the provision salary blank
   and the planner uses the salary at which the plan has no shortfall, so
   giving the surplus away never puts the family short. Set it by hand to
   draw the line yourself.
7. **Savings.** Investments earn the return rate, receive the year's cash flow
   and fund purchases. A negative balance is a **shortfall** and is flagged.
8. **Freedom tests.** Passive income = rental cash flow + safe-withdrawal rate ×
   investments. "Financially free" is the first year that covers spending.
9. **Estate.** Net worth in the final year, nominal and in today's dollars,
   divided equally among the children.

Solvers then binary-search the salary at which the plan has no shortfall, at
which passive income covers spending by retirement, and at which the savings
goal lands on time. These are the headline numbers. Two more solvers answer
"what do my investments need to do": the lowest yearly return on savings
that keeps the plan from ever running short, and the savings needed today
at the assumed return. A third finds how much of the planned lifestyle
spending (living, children, travel) the plan can carry with no shortfall and
reports the resulting peak monthly spending. The "Portfolio strategies"
section runs six variations of your plan (as entered, index funds only,
rentals yearly from now, cash-flow rentals self-managed, all-cash rentals,
and cash-flow rentals with a smaller home) and shows for each when savings
run out, the peak spending it carries, and the estate per child at that
budget. "Use this" switches the plan to that strategy. The five-year table shows, per stretch of life, the
spending that investments must cover next to what they actually earn.

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
