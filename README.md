# Opptra Discount Engine

A discount evaluation engine that ingests discount rules and shopping cart items, resolves competing and stackable promotions, applies cart-level threshold discounts, and calculates customer savings with full transparent reasoning.

## Live Deployment

- **Live URL**: `https://<your-project-name>.vercel.app` *(Replace with your deployed Vercel URL)*

---

## Run Locally in 3 Steps

1. **Clone the repository and enter the directory**:
   ```bash
   git clone https://github.com/suresh3234/discount-engine-assignment.git
   cd discount-engine-assignment
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Features

- **Pure Discount Engine**: Decoupled calculation engine (`src/engine/discountEngine.js`) built with pure functions, zero side effects, and no framework dependencies.
- **Competing Rule Resolution**: When multiple non-stackable offers match an item (brand vs platform), the engine automatically selects the offer granting the largest rupee discount.
- **Stackable Discounts**: Rules marked as `stackable: true` compound sequentially on top of the winning non-stackable offer (or apply standalone if no non-stackable offer matches).
- **Cart-Level Threshold Offers**: Evaluates minimum cart spend thresholds (e.g. 10% off for carts $\ge$ Rs.4,000) against the post-item-discount subtotal, providing friendly near-threshold nudges when just below the requirement.
- **Whole-Rupee Rounding**: Rounding at each discount step ensures displayed line items match the calculated subtotal and final payable amount without fractional discrepancies.
- **CSV Ingestion & Validation**: Robust input adapters (`src/adapters/csvAdapter.js`) powered by PapaParse with schema validation and descriptive error reporting for malformed CSVs.
- **Interactive UI**: Clean, responsive dashboard allowing users to upload `rules.csv` and `cart.csv`, review parsed records, and inspect line-item breakdowns with savings explanations.
- **Test Suite**: Automated unit tests using Vitest covering sample benchmark data and critical boundary edge cases.

---

## Running Tests & Production Build

- **Run unit tests**:
  ```bash
  npm test
  ```
- **Build for production**:
  ```bash
  npm run build
  ```
- **Preview production build locally**:
  ```bash
  npm run preview
  ```

---

## DECISIONS

### 1. Cart-Level Offer Resolution & Stacking Consistency
- **Decision:** If multiple cart-level rules qualify (i.e. `subtotal >= min_cart_value`), non-stackable cart rules compete, and the rule yielding the largest rupee discount on the subtotal is applied. Eligible rules marked `stackable: true` compound on top of the winning non-stackable rule (or apply sequentially if no non-stackable rule matches). Both percentage and flat discount types are supported and clamped at the remaining subtotal so totals never go negative.
- **Why:** Maintains strict consistency between item-level and cart-level promotion semantics. Customers always receive the optimal non-stackable promotion while merchants can run stackable cart incentives (e.g. flat coupon + cart threshold percentage).
- **Alternative:** Restricting cart offers to a single non-stackable rule or adding percentages additively. Additive percentages risk exceeding 100%, whereas sequential application safely reduces the subtotal.

### 2. Customer-Friendly Threshold Feedback (Near-Miss Tradeoff)
- **Decision:** When the cart subtotal is below all cart offer thresholds, no cart discount deduction row appears in the summary table. Instead, the engine identifies the closest threshold and provides a customer-friendly hint (e.g. `"Add Rs.1 more to unlock 10% off the cart"`).
- **Why:** Solves the boundary tradeoff for orders just under the threshold (e.g. Rs.3,999 vs Rs.4,000) by incentivizing upsell rather than failing silently or cluttering the summary with a Rs.0 discount line.
