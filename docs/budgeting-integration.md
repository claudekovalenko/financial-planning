# Pulling actuals from the budgeting app

The planner does not read the budgeting app's database. Instead the budgeting
app **publishes one JSON file** in the shape below, and the planner fetches it
(by URL or file upload), averages the trailing months, and offers to write the
result into the plan's "Spending today" and "Income" inputs.

## Where the file lives

Any URL the browser can fetch works. The simplest option is to commit the file
in the budgeting repository and point the planner at the raw URL:

```
https://raw.githubusercontent.com/claudekovalenko/budgeting/main/export/budget-export.json
```

The planner remembers the last URL you used. A sample lives at
`data/budget-export.sample.json` in this repository (served with the app as
`budget-export.sample.json`).

## File format (`BudgetExport`, version 1)

```json
{
  "version": 1,
  "currency": "USD",
  "generatedAt": "2026-09-01T00:00:00Z",
  "categoryMap": {
    "housing": ["Rent"],
    "giving": ["Giving"],
    "travel": ["Travel"]
  },
  "months": [
    {
      "month": "2026-08",
      "income": { "gross": 8333, "net": 6500 },
      "expenses": { "Rent": 1000, "Groceries": 710, "Giving": 830, "Travel": 0, "Other": 950 },
      "savingsBalance": 30000
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `version` | yes | Always `1` for this format. |
| `currency` | yes | ISO code, informational. |
| `months[].month` | yes | `YYYY-MM`. Months are sorted, and the trailing N (default 6) are averaged. |
| `months[].income.gross` | yes | Gross income received that month. `net` is optional and unused for now. |
| `months[].expenses` | yes | Category name to amount spent. Any category names are fine. |
| `months[].savingsBalance` | no | Cash + investments at month end. The latest value becomes "Savings and investments today". |
| `categoryMap` | no | Which category names count as housing, giving or travel. Defaults: `rent, mortgage, housing` / `giving, tithe, tithes, offering, charity, generosity` / `travel, flights, flight, trips, vacation` (case-insensitive). |

## How actuals map onto the plan

| Actual (trailing average) | Plan input |
|---|---|
| gross income × 12 | `income.salary` |
| housing categories | `spending.monthlyRent` |
| giving ÷ gross income | `spending.givingRate` |
| travel × 12 | `spending.travel.extraTravelPerYear` |
| every other category | `spending.monthlyBase` |
| latest `savingsBalance` | `savings.current` |

Nothing is written until you click **Apply these actuals to the plan**. You can
also do the same from the terminal:

```
npm run import-budget -- path/or/url/to/budget-export.json [--months 6] [--out data/plan.json]
```

## What the budgeting app needs to do

1. Keep monthly totals per category and monthly gross income.
2. Export them into the shape above (a scheduled job, a "publish" button, or a
   commit to the repo all work).
3. Optionally include `savingsBalance` so the planner's starting savings stays
   current.

The types live in `src/engine/budget.ts` and are the source of truth if this
document and the code ever disagree.
