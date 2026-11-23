# Opptra Discount Engine — Base Implementation

This is the base implementation for the Opptra FDE Intern assignment.
Fork this repo, complete the tasks in the assignment brief, and submit your GitHub link + Loom.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploying

```bash
npm run build
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host.
The live deployment URL must be in your README before submission.

## How to use

1. Upload `sample-data/rules.csv` as the discount rules input
2. Upload `sample-data/cart.csv` as the cart input
3. Click **Calculate Discounts**

## Project structure

```
src/
  engine/
    discountEngine.js   ← pure discount logic (no UI)
    csvParser.js        ← CSV → typed objects
  components/
    CsvUploader.jsx     ← file upload area
    DataTable.jsx       ← reusable table
    ErrorBanner.jsx     ← parse error display
  App.jsx               ← main UI + state
  main.jsx              ← entry point

sample-data/
  rules.csv             ← sample discount rules
  cart.csv              ← sample cart items
```

## CSV formats

**rules.csv**

| Column     | Type              | Example          |
|------------|-------------------|------------------|
| rule_id    | string            | RULE-01          |
| scope      | brand \| platform | platform         |
| applies_to | string            | Amazon India     |
| type       | percentage \| flat| percentage       |
| value      | number            | 15               |
| stackable  | true \| false     | false            |

**cart.csv**

| Column     | Type   | Example      |
|------------|--------|--------------|
| item_id    | string | ITEM-01      |
| product    | string | Cushion Cover|
| brand      | string | Natura Casa  |
| platform   | string | Amazon India |
| base_price | number | 1299         |

## Discount logic

- When multiple non-stackable rules match an item, the one giving the **largest saving in rupees** is applied.
- Rules marked `stackable: true` apply **on top of** the winning non-stackable rule.
- If no rules match, the base price is returned with a "No offers available" note.

## Expected results for the sample data

| Item    | Base Price | Final Price | Reasoning                              |
|---------|-----------|-------------|----------------------------------------|
| ITEM-01 | Rs.1,299  | Rs.1,104    | Platform offer: 15% off (beats Rs.150) |
| ITEM-02 | Rs.849    | Rs.629      | Brand offer: Rs.150 off + Platform 10% |
| ITEM-03 | Rs.599    | Rs.509      | Platform offer: 15% off                |
| ITEM-04 | Rs.2,499  | Rs.2,499    | No offers available                    |
| ITEM-05 | Rs.449    | Rs.382      | Platform offer: 15% off                |
| ITEM-06 | Rs.899    | Rs.809      | Platform offer: 10% off                |

**Cart Total Summary (with RULE-04 10% off on orders above Rs.4,000):**
- Item Subtotal: **Rs.5,932**
- Cart Discount (10% on Rs.5,932): **−Rs.593**
- Final Cart Total: **Rs.5,339**

## Rounding Rule

Discounts are calculated and rounded in whole rupees at each evaluation step:
1. **Item-Level Rules:** Percentage discounts are rounded to the nearest integer rupee using `Math.round((price * value) / 100)`. Flat discounts are applied directly, clamped to not exceed the current item price (`Math.min(value, price)`).
2. **Item Final Price:** The final item price is `Math.max(0, Math.round(price))`, ensuring item totals never go negative.
3. **Cart Subtotal:** Computed as the exact sum of the rounded item final prices:
   $$\text{Subtotal} = 1104 + 629 + 509 + 2499 + 382 + 809 = 5,932$$
4. **Cart-Level Discount:** Calculated directly against the subtotal and rounded:
   $$\text{Discount} = \text{round}(5932 \times 0.10) = 593$$
   $$\text{Final Total} = 5932 - 593 = 5,339$$

## DECISIONS

### 1. Adapter Architecture Pattern
- **Decision:** Separated input parsing into thin adapters (`src/adapters/csvAdapter.js`) that transform raw input formats into the canonical engine data contracts (`DiscountRule`, `CartItem`, `CartRule`). The discount engine (`src/engine/discountEngine.js`) remains 100% pure functions with zero I/O and zero UI awareness.
- **Why:** Ground Rule 1 dictates that adding new input sources (PDF, natural language rules) must never alter calculation logic.
- **Alternative:** Embedding format parsers directly in the engine or branching calculation functions based on input origins.

### 2. Rounding at Item Level vs. End of Cart
- **Decision:** Round each item discount to whole rupees at point of application, then compute cart discount on the sum of rounded item prices.
- **Why:** Produces exact expected rupee values (Rs.5,932 subtotal, Rs.593 cart discount, Rs.5,339 final total) and avoids discrepancies between the displayed line items and the subtotal sum.
- **Alternative:** Maintain floating-point fractions throughout and round only at the cart total. Rejected because displayed line-item totals would not sum up to the displayed subtotal (e.g. Rs.1,104.15 + ...).

### 3. Price Floor Clamping
- **Decision:** Clamp prices at zero (`Math.max(0, ...)` and `Math.min(rule.value, price)`).
- **Why:** Prevents flat discounts or compounded stackable offers from producing negative prices or negative cart totals.
- **Alternative:** Allowing negative prices or throwing runtime errors on oversized discounts.

### 4. Cart-Level Rule Triggering & Near-Threshold Feedback
- **Decision:** Cart-level rules only apply when `subtotal >= minCartTotal`. If the cart is below threshold (e.g. 1 rupee below), no discount is subtracted, and the engine generates a customer-facing nudge showing the remaining amount required to qualify.
- **Why:** Deliberately handles edge cases (e.g. Rs.3,999 vs Rs.4,000 threshold) without crashes or silent drops.
- **Alternative:** Omitting feedback entirely or applying partial discounts.

