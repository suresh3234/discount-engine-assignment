# Opptra Discount Engine

A discount evaluation engine that ingests discount rules and shopping cart items, resolves competing and stackable promotions, applies cart-level threshold discounts, and calculates customer savings with full transparent reasoning.

## Live Deployment

- **Live URL**: `https://<your-project-name>.vercel.app` *(Replace with your deployed Vercel URL)*

---

## Run Locally in 3 Steps

1. **Clone the repository and enter the directory**:
   ```bash
   git clone <your-fork-repo-url>
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

<!-- Document architectural decisions, trade-offs, and design rationales here -->
