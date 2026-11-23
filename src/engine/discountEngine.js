/**
 * discountEngine.js
 *
 * Pure discount calculation logic. No UI, no I/O, no side effects.
 * All functions take plain objects and return plain objects.
 *
 * Data shapes (the canonical types — adapters must output these):
 *
 * DiscountRule {
 *   ruleId:    string       — e.g. "RULE-01"
 *   scope:     "brand" | "platform"
 *   appliesTo: string       — e.g. "Natura Casa", "Amazon India"
 *   type:      "percentage" | "flat"
 *   value:     number       — percentage as integer (15 = 15%), flat in rupees
 *   stackable: boolean
 * }
 *
 * CartItem {
 *   itemId:    string       — e.g. "ITEM-01"
 *   product:   string
 *   brand:     string
 *   platform:  string
 *   basePrice: number       — in rupees
 * }
 *
 * DiscountResult {
 *   itemId:        string
 *   product:       string
 *   brand:         string
 *   platform:      string
 *   basePrice:     number
 *   finalPrice:    number
 *   totalDiscount: number
 *   appliedRules:  string[]
 *   skippedRules:  string[]
 *   reasoning:     string   — customer-readable explanation
 * }
 */

// ── Helpers (internal to the engine) ─────────────────────────────

const normalise = (s) => s.trim().toLowerCase()

function ruleLabel(rule) {
  return rule.scope === 'brand' ? 'Brand offer' : 'Platform offer'
}

function discountDesc(rule) {
  if (rule.type === 'percentage') return `${rule.value}% off`
  if (rule.type === 'flat') return `Rs.${rule.value} off`
  return 'discount applied'
}

// ── Exported functions ───────────────────────────────────────────

/**
 * Returns true if the rule applies to this cart item.
 */
export function ruleMatchesItem(item, rule) {
  if (rule.scope === 'brand') {
    return normalise(item.brand) === normalise(rule.appliesTo)
  }
  if (rule.scope === 'platform') {
    return normalise(item.platform) === normalise(rule.appliesTo)
  }
  return false
}

/**
 * Calculates the rupee discount a rule gives on a given price.
 * Uses the provided price, not the original base price — important for stacking.
 * Clamps flat discounts so they never exceed the remaining price.
 */
export function calculateDiscountAmount(price, rule) {
  if (price <= 0) return 0
  if (rule.type === 'percentage') {
    return Math.round((price * rule.value) / 100)
  }
  if (rule.type === 'flat') {
    return Math.min(rule.value, price)
  }
  return 0
}

/**
 * Applies the active discount rules to a single cart item.
 * Returns a DiscountResult with a plain-language reasoning string.
 *
 * Logic:
 *   1. Find all rules that match this item.
 *   2. Among non-stackable rules, pick the one giving the largest discount.
 *   3. Apply any stackable rules on top of that reduced price.
 *   4. Build a customer-facing reasoning string explaining what was
 *      applied and — when rules competed — why.
 */
export function applyDiscounts(item, rules) {
  const matchingRules = rules.filter((r) => ruleMatchesItem(item, r))

  // No rules match — return base price with explanation
  if (matchingRules.length === 0) {
    return {
      itemId: item.itemId,
      product: item.product,
      brand: item.brand,
      platform: item.platform,
      basePrice: item.basePrice,
      finalPrice: item.basePrice,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    }
  }

  const nonStackable = matchingRules.filter((r) => !r.stackable)
  const stackable = matchingRules.filter((r) => r.stackable)

  // Pick the non-stackable rule that gives the largest saving
  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(item.basePrice, b) -
        calculateDiscountAmount(item.basePrice, a),
    )
    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  // Apply winner first, then stack on top
  let price = item.basePrice
  const appliedRules = []

  if (winner) {
    price = Math.max(0, price - calculateDiscountAmount(price, winner))
    appliedRules.push(winner.ruleId)
  }

  for (const rule of stackable) {
    price = Math.max(0, price - calculateDiscountAmount(price, rule))
    appliedRules.push(rule.ruleId)
  }

  const finalPrice = Math.max(0, Math.round(price))
  const totalDiscount = item.basePrice - finalPrice

  // ── Build customer-facing reasoning ──

  let reasoning = ''

  if (winner && skipped.length > 0) {
    // Multiple non-stackable rules competed — explain the choice
    const options = [...skipped, winner].map(
      (r) => `${ruleLabel(r)} ${discountDesc(r)}`,
    )
    reasoning = `${options.join(' vs ')}: you got ${discountDesc(winner)}`
  } else if (winner) {
    // Single non-stackable rule, no competition
    reasoning = `${ruleLabel(winner)}: ${discountDesc(winner)}`
  }

  if (stackable.length > 0) {
    const stackParts = stackable.map(
      (r) => `${ruleLabel(r)}: ${discountDesc(r)}`,
    )
    reasoning = reasoning
      ? `${reasoning} + ${stackParts.join(' + ')}`
      : stackParts.join(' + ')
  }

  if (totalDiscount > 0) {
    reasoning += ` (Rs.${totalDiscount} saved)`
  }

  return {
    itemId: item.itemId,
    product: item.product,
    brand: item.brand,
    platform: item.platform,
    basePrice: item.basePrice,
    finalPrice,
    totalDiscount,
    appliedRules,
    skippedRules: skipped.map((r) => r.ruleId),
    reasoning,
  }
}

/**
 * Runs applyDiscounts across every item in the cart.
 * Returns an array of DiscountResult objects (empty array for an empty cart).
 */
export function processCart(cartItems, rules) {
  if (!cartItems || cartItems.length === 0) return []
  return cartItems.map((item) => applyDiscounts(item, rules))
}

/**
 * Sums the final prices across all results.
 */
export function cartTotal(results) {
  if (!results || results.length === 0) return 0
  return results.reduce((sum, r) => sum + r.finalPrice, 0)
}
