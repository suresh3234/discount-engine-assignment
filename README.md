# Opptra Discount Engine

A production-ready discount evaluation engine that ingests promotion rules and shopping cart items from multiple formats (CSV, natural language text, PDF invoices), resolves competing and stackable promotions, applies cart-level threshold discounts, and calculates customer savings with transparent reasoning.

---

## 1. Live Demo URL

- **Vercel Live Deployment**: [https://discount-engine-assignment-ashen.vercel.app](https://discount-engine-assignment-ashen.vercel.app)

---

## 2. Run Locally in Under 3 Steps

1. **Clone the repository and enter the directory**:
   ```bash
   git clone https://github.com/suresh3234/discount-engine-assignment.git
   cd discount-engine-assignment
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

> [!NOTE]
> **Free Environment Variable for Natural Language Parser (`GEMINI_API_KEY`)**:
> - We recommend using the **Google Gemini API**, which is **100% free** with no credit card required at [Google AI Studio](https://aistudio.google.com/).
> - Copy `.env.example` to `.env` and provide your API key:
>   ```bash
>   GEMINI_API_KEY=AIzaSy...
>   ```
> - *Alternatives supported:* You can also use **Groq** (`GROQ_API_KEY`, free at [console.groq.com](https://console.groq.com/)) or **Anthropic** (`ANTHROPIC_API_KEY`).
> - **What happens without an API key?** The system includes a built-in deterministic heuristic fallback parser in `/api/parse-rule.js` and the client adapter. Standard evaluation prompts (e.g. *"20% off for Natura Casa brand, stackable"*, *"Rs.100 flat discount on Flipkart"*, *"10% off if cart value is more than Rs.5,000"*, and ambiguous queries) parse seamlessly offline for evaluation and local demos even if no API key is configured. Arbitrary un-templated text without an API key will safely trigger an unresolvable prompt requesting a free API key.

---

## 3. What I Built

### Foundation (Core Pure Engine & Baseline CSVs)
- **Pure Calculation Engine** (`calculateItem`, `applyCartRules`, `processCart`): Pure functional core with zero side-effects, DOM, or framework dependencies.
- **Rule Resolution**: When multiple non-stackable promotions match an item, the engine automatically selects the offer granting the largest rupee discount. Stackable promotions compound sequentially on top of the winning offer.
- **Whole-Rupee Rounding**: Enforces rounding to whole rupees at each evaluation step, guaranteeing that line items exactly sum to the subtotal and reproduce benchmark values ($5,932 \rightarrow 593 \rightarrow 5,339$).
- **CSV Ingestion**: Robust PapaParse adapters for `rules.csv` and `cart.csv` with schema validation and error reporting.

### Cart-Level Offer
- **Threshold Evaluation**: Checks whether cart subtotal after item-level discounts meets `min_cart_value` (e.g. 10% off for carts $\ge$ Rs.4,000).
- **Separate Summary Line**: Renders the cart offer on its own separate line in the Cart Summary table with distinct reasoning (e.g. `"Cart offer: 10% off: Rs.593 saved"`), followed by the `Final Cart Total`.
- **Near-Miss Encouragement Nudge**: If the subtotal is just below the threshold (e.g. Rs.3,999 vs Rs.4,000), no discount line appears; instead, a muted, friendly hint informs the user: *"Add Rs.1 more to unlock 10% off the cart"*.
- **Stacking & Flat Rule Support**: Competing non-stackable cart rules compete for the largest rupee saving; stackable cart rules compound on the reduced subtotal; flat cart rules clamp to prevent negative balances.

### Natural Language Rules ("Describe a Rule in Plain English")
- **Decoupled Adapter** (`src/inputs/nlRule/`): Transforms plain English text into canonical `DiscountRule` or `CartRule` types without touching the calculator.
- **Serverless API Proxy** (`/api/parse-rule`): Calls Google Gemini API (`GEMINI_API_KEY`, 100% free with no credit card at AI Studio), Groq (`GROQ_API_KEY`), or Anthropic using server-side environment variables, keeping secret keys safe from browser exposure.
- **Strict Zod Client Validation**: Validates output structure (enums, value $> 0$, percentage $\le 100$, applies_to requirements, min_cart_value thresholds).
- **Resilient Error Handling**: Strips markdown code fences, retries once on malformed JSON, and surfaces helpful error messages for ambiguous queries (e.g. *"Give a discount for big orders"*).
- **Confirmation Flow & Auto-IDs**: Renders a parsed preview card with `[Confirm & add]` and `[Discard]`. On confirm, assigns the next rule ID (`RULE-05`) and immediately re-runs calculations on the current cart.

### PDF Cart Upload
- **Client-Side Parsing** (`src/inputs/pdfCart/`): Uses `pdfjs-dist` to extract digital text directly in the browser—no backend or OCR service required.
- **Coordinate-Based Line Clustering**: Reconstructs table rows by clustering text items vertically by Y-coordinate and sorting horizontally by X-coordinate.
- **Robust Column Splitting**: Anchors on right-aligned rupee prices (`Rs.`, `₹`), matches platform names greedily against known platforms (`Amazon India`, `Flipkart`, `Noon`), matches brands, and falls back to coordinate column gaps.
- **Resilient Partial Loading**: Valid rows load immediately into the cart; malformed rows are skipped without crashing and surfaced in a prominent warning panel with a `[Revert Cart]` action.
- **Empty PDF Guard**: If zero items are found (e.g. a scanned image PDF), displays *"No cart items found"* and leaves the current cart intact.

---

## 4. Architecture & Project Structure

The project strictly adheres to clean architectural separation between domain calculations, input adapters, and user interface:

```text
src/
  engine/
    discountEngine.js         ← Pure calculation engine (calculateItem, applyCartRules, zero UI/IO)
    discountEngine.test.js    ← Pure engine unit tests (Vitest)
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
  parse-rule.js               ← Vercel serverless function (GEMINI_API_KEY / GROQ_API_KEY)
sample-data/
  rules.csv                   ← Baseline discount rules fixture
  cart.csv                    ← Baseline cart items fixture
  cart.pdf                    ← Generated sample PDF order invoice
test/fixtures/
  sample-cart.pdf             ← Test fixture matching assignment brief
  malformed-cart.pdf          ← Test fixture containing malformed rows
  empty-cart.pdf              ← Test fixture containing zero items
```

### Adding a New Input Mode in 3 Lines

Every input mode implements the common contract:
`type InputAdapter<TInput, TOutput> = (source: TInput, options?: object) => Promise<Result<TOutput>>`
where `TOutput` is the engine's canonical `DiscountRule[]`, `CartRule[]`, or `CartItem[]`.

To add a 4th input mode (e.g., JSON API Cart):

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

## 5. DECISIONS and Tradeoffs

### 1. Rounding Rule
- **Decision:** Each item discount is rounded to the nearest integer rupee (`Math.round`) at its point of application. Stackable percentages evaluate against the already-rounded intermediate price. The cart subtotal is the exact sum of the individual rounded line items, and the cart-level discount is calculated and rounded on that subtotal.
- **Why:** Produces exact benchmark figures ($1,104 + 629 + 509 + 2,499 + 382 + 809 = \mathbf{5,932} \rightarrow -593 \rightarrow \mathbf{5,339}$) and eliminates visual discrepancies where visible line items do not sum to the displayed subtotal.
- **Alternative:** Floating-point precision throughout with single end-of-cart rounding. Rejected because displayed line-item totals would show fractional paise or fail to sum up to the displayed subtotal (e.g. Rs.1,104.15 + ...).

### 2. Server-Side LLM Proxy vs. Client-Side Key
- **Decision:** Natural language parsing is routed through a Vercel serverless function (`/api/parse-rule`) that accesses `GEMINI_API_KEY` (or `GROQ_API_KEY` / `ANTHROPIC_API_KEY`) exclusively on the server.
- **Why:** Shipping API credentials to client-side bundles exposes the key in network tabs and invites API theft and quota exhaustion. Free providers like Google Gemini offer a generous free tier (15 requests/min, 1,500/day) with zero credit card required, making it easy to run without expense.
- **Alternative:** Pure client-side calls (`dangerouslyAllowBrowser: true`). Acceptable only for quick throwaway prototypes, but unsafe for public deployments.

### 3. Confirmation Step Design (Agree / Disagree)
- **Decision:** When the LLM parses a rule, the UI displays an intermediate confirmation preview card showing the structured fields (**Scope · Applies to · Type · Value · Stackable · Min cart value**) with explicit `[Confirm & add]` and `[Discard]` actions.
- **Why:** LLMs are probabilistic. Directly injecting parsed rules into financial calculations without human approval risks applying unintended promotional terms.
- **Alternative:** Immediate auto-addition on parse. Rejected because unintended rule additions could silently alter cart calculations.

### 4. PDF Format Assumption and Malformed-Row Policy (Partial Load + Warnings)
- **Decision:** Invoices are parsed client-side by clustering text by Y-coordinates and price regex anchoring. If malformed rows are encountered (e.g. missing price, non-numeric price), the adapter skips the invalid lines, loads all valid items into the cart, and displays a prominent warning panel detailing every skipped line alongside a one-click `[Revert Cart]` button. If zero valid items exist (e.g. scanned image PDF), the current cart is preserved untouched.
- **Why:** Real-world invoices contain disclaimers, terms, and footer notes that could trigger false-positive row errors. Aborting the entire invoice over one footer line causes extreme friction, whereas silently dropping rows causes billing discrepancies. Loading valid rows with transparent warnings and revert capability achieves the optimal balance.
- **Alternative:** Strict all-or-nothing rejection. Rejected because incidental non-item text would prevent valid orders from loading.

### 5. Invalid or Ambiguous LLM Output Handling
- **Decision:** Responses are validated through a strict Zod schema on the client. If the model returns markdown code fences, they are automatically stripped. If JSON parsing fails, the client retries the API request once. If the prompt is ambiguous (e.g. *"Give a discount for big orders"*), the model returns an explicit `unresolvable` state with a reason and list of missing fields, rendering a friendly *"I couldn't turn that into a rule"* alert.
- **Why:** Guarantees that neither network glitches, markdown wrapping, nor vague user inputs ever crash the engine.
- **Alternative:** Guessing default parameters for ambiguous inputs (e.g. assuming 10% on Rs.5,000). Rejected because guessing financial promotion parameters creates liability.

### 6. Cart Total Just Below Threshold
- **Decision:** When a cart is below the promotion threshold (e.g. Rs.3,999 vs Rs.4,000), no cart offer deduction row appears in the breakdown table. Instead, an encouraging customer hint renders underneath: *"Add Rs.1 more to unlock 10% off the cart"*.
- **Why:** Rendering a line item with −Rs.0 causes confusion. A gentle nudge incentivizes upsell without cluttering the summary.
- **Alternative:** Displaying a disabled or Rs.0 cart offer line. Rejected as visually noisy and confusing.

### 7. Multiple Cart Rules and Stacking Behavior
- **Decision:** If multiple non-stackable cart rules qualify, the rule yielding the largest rupee saving on the subtotal is applied. Stackable cart rules compound sequentially on the reduced subtotal. Flat cart rules clamp to the remaining total so balances never go negative.
- **Why:** Ensures parity with item-level logic: merchants can offer competing cart milestones while allowing stackable bonuses (e.g. flat coupon + cart threshold percentage).
- **Alternative:** Permitting only a single cart rule or summing percentages additively. Additive percentages risk exceeding 100%, whereas sequential compounding is safe and predictable.

### 8. Note on Inconsistent Task Numbering in the Brief
- **Note:** The assignment brief numbered tasks inconsistently across sections: the task cards listed **Task 1 = Cart offer**, **Task 2 = Natural-language input**, and **Task 3 = PDF upload**, whereas the evaluation section referred to Task 1 as rule parsing and Task 2 as cart replacement. I followed the task cards' structure and implemented all four capabilities comprehensively.

---

## 6. Testing

### How to Run Tests
```bash
npm test
```
To run tests with code coverage or watch mode:
```bash
npx vitest run
```

### What the Test Suites Cover (66 Tests Total)

1. **Pure Engine Test Suite** (`src/engine/discountEngine.test.js` — 37 tests):
   - Exact benchmark verification on sample data ($1,104 + 629 + 509 + 2,499 + 382 + 809 = \mathbf{5,932} \rightarrow -593 \rightarrow \mathbf{5,339}$).
   - Competing non-stackable rule tie-breaking and reasoning explanation.
   - Stackable-only rules applying without a non-stackable winner.
   - Multiple stackable rules compounding sequentially.
   - Negative price clamping: flat discounts larger than base price clamp at Rs.0.
   - Exact threshold matching (`subtotal == 4000`) and sub-threshold gaps (`subtotal == 3999`).
   - Multiple cart-level rules competing and stacking with flat and percentage discounts.
   - Verification of `calculateItem` and `applyCartRules` aliases.

2. **Natural Language Parser & Zod Suite** (`src/inputs/nlRule/nlRuleParser.test.js` — 25 tests):
   - Zod schema validations: enum checks (`brand`, `platform`, `cart`), positive value constraints, percentage $\le 100$, required `applies_to` on brand/platform, required `min_cart_value` on cart rules.
   - Markdown JSON fence extraction (` ```json ... ``` `).
   - Mocked LLM responses with automatic retry on malformed JSON.
   - Graceful network error handling.
   - Complete verification of the 4 benchmark prompt examples.

3. **PDF Cart Parser Suite** (`src/inputs/pdfCart/parsePdfCart.test.js` — 4 tests):
   - `sample-cart.pdf`: Extracted all 6 items and fed directly to `processCart`, verifying exact Rs.5,932 / −Rs.593 / Rs.5,339 results.
   - `malformed-cart.pdf`: Verified extraction of 3 valid items, skipping 2 malformed rows without crashing, and populating warning diagnostics.
   - `empty-cart.pdf`: Verified zero-item detection and *"No cart items found"* warning.
   - Corrupt/null input safety test.

---

## 7. Known Limitations

- **Scanned Image PDFs**: `pdfjs-dist` extracts digital vector text streams. Scanned raster images or photocopied receipts without embedded text layers require an optical character recognition (OCR) engine (e.g. Tesseract or AWS Textract).
- **In-Memory State by Design**: Rules and cart items are stored in client memory for reactive evaluation and reset on page refresh. Persistent multi-tenant storage would require an external database (e.g. PostgreSQL / Supabase).
- **Single Currency Focus**: Formatted specifically for Indian Rupees (`INR` / `Rs.` / `₹`). Multi-currency support would require exchange rate conversion and localized rounding rules.
