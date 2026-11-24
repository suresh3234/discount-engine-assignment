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

## Architecture & Project Structure

The codebase is organized into pure domain logic, decoupled input adapters, and presentation:

```
src/
  engine/
    discountEngine.js         ← Pure calculation engine (calculateItem, applyCartRules, zero UI/IO)
    discountEngine.test.js    ← Engine unit tests (Vitest)
  inputs/
    index.js                  ← Unified InputAdapter contract & registry
    csv/
      csvAdapter.js           ← CSV rules and cart parser
    nlRule/
      nlRuleParser.js         ← Natural language plain English rule adapter
      schema.js               ← Zod output schema and validation
      nlRuleParser.test.js    ← Zod and mocked LLM unit tests
    pdfCart/
      parsePdfCart.js         ← Client-side PDF invoice cart extractor
      parsePdfCart.test.js    ← PDF fixture unit tests
  components/
    CsvUploader.jsx           ← Drag-and-drop CSV upload component
    PdfUploader.jsx           ← Client-side PDF upload component
    NlRuleInput.jsx           ← Plain English rule input with confirmation card
    DataTable.jsx             ← Reusable tabular presentation
    ErrorBanner.jsx           ← Formatted error alerts
  App.jsx                     ← UI orchestration and reactive state
  main.jsx                    ← Application entry point
api/
  parse-rule.js               ← Vercel serverless function (calls Anthropic API using ANTHROPIC_API_KEY)
sample-data/
  rules.csv                   ← Baseline discount rules fixture
  cart.csv                    ← Baseline cart items fixture
  cart.pdf                    ← Generated sample PDF order invoice
test/fixtures/
  sample-cart.pdf             ← Test fixture matching assignment brief
  malformed-cart.pdf          ← Test fixture containing malformed rows
  empty-cart.pdf              ← Test fixture containing zero items
```

---

## Adding a New Input Mode in 3 Lines

Every input mode is an adapter implementing the common contract:
`type InputAdapter<TInput, TOutput> = (source: TInput, options?: object) => Promise<Result<TOutput>>`
where `TOutput` is the engine's canonical `DiscountRule[]`, `CartRule[]`, or `CartItem[]`.

To add a 4th input mode (e.g., JSON API cart):

```javascript
// 1. Create src/inputs/jsonCart/jsonCartAdapter.js matching the InputAdapter signature:
export const jsonCartAdapter = async (json) => ({ success: true, data: JSON.parse(json).map(r => ({ itemId: r.id, product: r.title, brand: r.brand, platform: r.platform, basePrice: r.price })) });

// 2. Export it from src/inputs/index.js:
export { jsonCartAdapter } from './jsonCart/jsonCartAdapter.js';

// 3. In your UI component, call the adapter and pass its canonical data straight to the engine:
const { data } = await jsonCartAdapter(jsonString); setResults(processCart(data, rules));
```
The calculation engine (`src/engine/discountEngine.js`) remains completely untouched.

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

## Environment Variables

Copy `.env.example` to `.env` when deploying or configuring the Anthropic API key:
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```
- In production on Vercel, add `ANTHROPIC_API_KEY` under **Project Settings $\rightarrow$ Environment Variables**.
- If unconfigured, the serverless endpoint and client adapter gracefully fall back to local rule patterns.

---

## DECISIONS

### 1. Cart-Level Offer Resolution & Stacking Consistency
- **Decision:** If multiple cart-level rules qualify (i.e. `subtotal >= min_cart_value`), non-stackable cart rules compete, and the rule yielding the largest rupee discount on the subtotal is applied. Eligible rules marked `stackable: true` compound on top of the winning non-stackable rule (or apply sequentially if no non-stackable rule matches). Both percentage and flat discount types are supported and clamped at the remaining subtotal so totals never go negative.
- **Why:** Maintains strict consistency between item-level and cart-level promotion semantics. Customers always receive the optimal non-stackable promotion while merchants can run stackable cart incentives (e.g. flat coupon + cart threshold percentage).
- **Alternative:** Restricting cart offers to a single non-stackable rule or adding percentages additively. Additive percentages risk exceeding 100%, whereas sequential application safely reduces the subtotal.

### 2. Customer-Friendly Threshold Feedback (Near-Miss Tradeoff)
- **Decision:** When the cart subtotal is below all cart offer thresholds, no cart discount deduction row appears in the summary table. Instead, the engine identifies the closest threshold and provides a customer-friendly hint (e.g. `"Add Rs.1 more to unlock 10% off the cart"`).
- **Why:** Solves the boundary tradeoff for orders just under the threshold (e.g. Rs.3,999 vs Rs.4,000) by incentivizing upsell rather than failing silently or cluttering the summary with a Rs.0 discount line.

### 3. Serverless LLM Architecture for Natural Language Rules (`/api/parse-rule`)
- **Decision:** Natural language rule descriptions are sent to a serverless API function (`/api/parse-rule` on Vercel) that communicates with the Anthropic Messages API (`claude-3-5-haiku-20241022`) using a secure server-side environment variable (`ANTHROPIC_API_KEY`). The client adapter (`src/inputs/nlRule/`) validates the returned structure using a strict Zod schema before outputting canonical `DiscountRule` or `CartRule` objects, with an automatic retry on invalid JSON.
- **Why:** Prevents secret API keys from leaking into the browser bundle or client network tabs, protecting against quota depletion and key theft.
- **Alternative:** Pure client-side API calls (e.g. `dangerouslyAllowBrowser: true`). Exposing the Anthropic API key in client-side code is acceptable only for temporary local demos or throwaway testing keys, but unsafe for public deployments.

### 4. Client-Side PDF Cart Extraction & Partial Load Resilience (`src/inputs/pdfCart/`)
- **Decision:** PDF order invoices are parsed 100% client-side using `pdfjs-dist` (reconstructing lines by Y-coordinate clustering, right-anchoring on price regexes, and greedy platform/brand matching). If a PDF contains malformed rows (e.g. missing or non-numeric prices), the adapter skips the invalid entries without crashing, loads all valid items into the cart, and prominently surfaces a warning panel listing each skipped row with a one-click `"Revert Cart"` button. If zero valid rows are found, the existing cart remains untouched with a `"No cart items found"` notification.
- **Why:** In real-world invoices, miscellaneous text (terms, footer notes, page numbers) could trigger false-positive row errors. Aborting on single-line issues causes user frustration, while silent omission causes checkout discrepancies. Loading valid rows alongside transparent warnings balances resilience with correctness.
- **Alternative:** Strict all-or-nothing validation (rejecting the entire PDF if any row is unparseable). Rejected because incidental non-item text would prevent valid orders from loading.
