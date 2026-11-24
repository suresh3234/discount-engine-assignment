/**
 * csvAdapter.js
 *
 * Input adapter: converts raw CSV text into the typed objects the
 * discount engine expects (DiscountRule, CartItem, CartRule).
 *
 * This is a thin adapter — it handles CSV-specific parsing and
 * validation, then outputs the engine's canonical types. Adding a new
 * input format (PDF, natural language, etc.) means writing a new
 * adapter in this directory, not changing the engine.
 *
 * Uses PapaParse for reliable CSV parsing.
 *
 * Expected rules.csv columns:
 *   rule_id, scope, applies_to, type, value, stackable [, min_cart_total]
 *
 * Expected cart.csv columns:
 *   item_id, product, brand, platform, base_price
 */

import Papa from 'papaparse'

/**
 * Parses the raw text of rules.csv into item rules and cart rules.
 *
 * Returns { itemRules: DiscountRule[], cartRules: CartRule[], errors: string[] }
 *
 * Rows with scope "brand" or "platform" become DiscountRule objects.
 * Rows with scope "cart" become CartRule objects (require min_cart_total).
 */
export function parseRulesCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return {
      itemRules: [],
      cartRules: [],
      errors: parseErrors.map((e) => e.message),
    }
  }

  const itemRules = []
  const cartRules = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2 // account for header row

    if (!row.rule_id) {
      errors.push(`Row ${rowNum}: missing rule_id`)
      return
    }
    if (!row.scope) {
      errors.push(`Row ${rowNum}: missing scope`)
      return
    }

    const scope = row.scope.trim().toLowerCase()

    // ── Cart-level rule ──
    if (scope === 'cart') {
      if (!row.type) {
        errors.push(`Row ${rowNum}: missing type for cart rule`)
        return
      }
      const type = row.type.trim().toLowerCase()
      if (type !== 'percentage' && type !== 'flat') {
        errors.push(
          `Row ${rowNum}: type must be "percentage" or "flat", got "${row.type}"`,
        )
        return
      }

      const value = parseFloat(row.value)
      if (isNaN(value) || value <= 0) {
        errors.push(
          `Row ${rowNum}: value must be a positive number, got "${row.value}"`,
        )
        return
      }

      const minCartRaw =
        row.min_cart_value !== undefined && row.min_cart_value !== ''
          ? row.min_cart_value
          : row.min_cart_total
      const minCartTotal = parseFloat(minCartRaw)
      if (isNaN(minCartTotal) || minCartTotal <= 0) {
        errors.push(
          `Row ${rowNum}: min_cart_value (or min_cart_total) must be a positive number for cart rules, got "${minCartRaw}"`,
        )
        return
      }

      const stackableStr = (row.stackable || '').trim().toLowerCase()
      const stackable =
        stackableStr === 'true' || stackableStr === '1' || stackableStr === 'yes'

      cartRules.push({
        ruleId: row.rule_id.trim(),
        scope: 'cart',
        type,
        value,
        stackable,
        minCartTotal: Math.round(minCartTotal),
        minCartValue: Math.round(minCartTotal),
      })
      return
    }

    // ── Item-level rule ──
    if (scope !== 'brand' && scope !== 'platform') {
      errors.push(
        `Row ${rowNum}: scope must be "brand", "platform", or "cart", got "${row.scope}"`,
      )
      return
    }

    const missing = []
    if (!row.applies_to) missing.push('applies_to')
    if (!row.type) missing.push('type')
    if (row.value === undefined || row.value === '') missing.push('value')
    if (row.stackable === undefined || row.stackable === '')
      missing.push('stackable')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const type = row.type.trim().toLowerCase()
    if (type !== 'percentage' && type !== 'flat') {
      errors.push(
        `Row ${rowNum}: type must be "percentage" or "flat", got "${row.type}"`,
      )
      return
    }

    const value = parseFloat(row.value)
    if (isNaN(value) || value <= 0) {
      errors.push(
        `Row ${rowNum}: value must be a positive number, got "${row.value}"`,
      )
      return
    }

    const stackableStr = row.stackable.trim().toLowerCase()
    const stackable =
      stackableStr === 'true' || stackableStr === '1' || stackableStr === 'yes'

    itemRules.push({
      ruleId: row.rule_id.trim(),
      scope,
      appliesTo: row.applies_to.trim(),
      type,
      value,
      stackable,
    })
  })

  return { itemRules, cartRules, errors }
}

/**
 * Parses the raw text of cart.csv into an array of CartItem objects.
 * Returns { data, errors } where errors is an array of row-level issues.
 */
export function parseCartCSV(csvText) {
  const { data: rows, errors: parseErrors } = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parseErrors.length > 0) {
    return { data: [], errors: parseErrors.map((e) => e.message) }
  }

  const data = []
  const errors = []

  rows.forEach((row, i) => {
    const rowNum = i + 2
    const missing = []

    if (!row.item_id) missing.push('item_id')
    if (!row.product) missing.push('product')
    if (!row.brand) missing.push('brand')
    if (!row.platform) missing.push('platform')
    if (row.base_price === undefined || row.base_price === '')
      missing.push('base_price')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields — ${missing.join(', ')}`)
      return
    }

    const basePrice = parseFloat(row.base_price)
    if (isNaN(basePrice) || basePrice <= 0) {
      errors.push(
        `Row ${rowNum}: base_price must be a positive number, got "${row.base_price}"`,
      )
      return
    }

    data.push({
      itemId: row.item_id.trim(),
      product: row.product.trim(),
      brand: row.brand.trim(),
      platform: row.platform.trim(),
      basePrice: Math.round(basePrice),
    })
  })

  return { data, errors }
}
