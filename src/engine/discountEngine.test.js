/**
 * discountEngine.test.js
 *
 * Unit tests for the pure discount engine.
 * Covers every sample-data row, cart-level rules, and edge cases.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  ruleMatchesItem,
  calculateDiscountAmount,
  applyDiscounts,
  processCart,
  cartTotal,
  applyCartDiscount,
} from './discountEngine.js'
import { parseRulesCSV, parseCartCSV } from '../adapters/csvAdapter.js'

// ── Fixtures (mirror sample-data/*.csv) ──────────────────────────

const RULES = [
  { ruleId: 'RULE-01', scope: 'platform', appliesTo: 'Amazon India', type: 'percentage', value: 15, stackable: false },
  { ruleId: 'RULE-02', scope: 'brand',    appliesTo: 'Natura Casa',  type: 'flat',       value: 150, stackable: false },
  { ruleId: 'RULE-03', scope: 'platform', appliesTo: 'Flipkart',     type: 'percentage', value: 10,  stackable: true },
]

const CART_RULES = [
  { ruleId: 'RULE-04', type: 'percentage', value: 10, minCartTotal: 4000 },
]

const CART = [
  { itemId: 'ITEM-01', product: 'Cushion Cover',  brand: 'Natura Casa',   platform: 'Amazon India', basePrice: 1299 },
  { itemId: 'ITEM-02', product: 'Bed Sheet Set',  brand: 'Natura Casa',   platform: 'Flipkart',     basePrice: 849 },
  { itemId: 'ITEM-03', product: 'Wall Shelf',     brand: 'LivSpace Pro',  platform: 'Amazon India', basePrice: 599 },
  { itemId: 'ITEM-04', product: 'Ceramic Vase',   brand: 'LivSpace Pro',  platform: 'Noon',         basePrice: 2499 },
  { itemId: 'ITEM-05', product: 'Cutting Board',  brand: 'Nordic Basics', platform: 'Amazon India', basePrice: 449 },
  { itemId: 'ITEM-06', product: 'Desk Organiser', brand: 'Nordic Basics', platform: 'Flipkart',     basePrice: 899 },
]

// ── ruleMatchesItem ──────────────────────────────────────────────

describe('ruleMatchesItem', () => {
  it('matches by brand (case-insensitive)', () => {
    expect(ruleMatchesItem(CART[0], RULES[1])).toBe(true) // Natura Casa
    const upper = { ...CART[0], brand: 'NATURA CASA' }
    expect(ruleMatchesItem(upper, RULES[1])).toBe(true)
  })

  it('matches by platform', () => {
    expect(ruleMatchesItem(CART[0], RULES[0])).toBe(true) // Amazon India
  })

  it('rejects non-matching brand', () => {
    expect(ruleMatchesItem(CART[2], RULES[1])).toBe(false) // LivSpace Pro ≠ Natura Casa
  })

  it('rejects non-matching platform', () => {
    expect(ruleMatchesItem(CART[3], RULES[0])).toBe(false) // Noon ≠ Amazon India
  })

  it('rejects unknown scope', () => {
    const bogus = { ...RULES[0], scope: 'region' }
    expect(ruleMatchesItem(CART[0], bogus)).toBe(false)
  })
})

// ── calculateDiscountAmount ──────────────────────────────────────

describe('calculateDiscountAmount', () => {
  it('15% of 1299 → 195 (rounded from 194.85)', () => {
    expect(calculateDiscountAmount(1299, { type: 'percentage', value: 15 })).toBe(195)
  })

  it('10% of 699 → 70 (rounded from 69.9)', () => {
    expect(calculateDiscountAmount(699, { type: 'percentage', value: 10 })).toBe(70)
  })

  it('flat 150 on 849 → 150', () => {
    expect(calculateDiscountAmount(849, { type: 'flat', value: 150 })).toBe(150)
  })

  it('flat 150 on 100 → clamps to 100', () => {
    expect(calculateDiscountAmount(100, { type: 'flat', value: 150 })).toBe(100)
  })

  it('any discount on 0 → 0', () => {
    expect(calculateDiscountAmount(0, { type: 'percentage', value: 50 })).toBe(0)
    expect(calculateDiscountAmount(0, { type: 'flat', value: 100 })).toBe(0)
  })

  it('unknown type → 0', () => {
    expect(calculateDiscountAmount(1000, { type: 'bogus', value: 10 })).toBe(0)
  })
})

// ── applyDiscounts — sample data ─────────────────────────────────

describe('applyDiscounts — sample data', () => {
  it('ITEM-01: RULE-01 15% (Rs.195) beats RULE-02 Rs.150 → final 1104', () => {
    const r = applyDiscounts(CART[0], RULES)
    expect(r.finalPrice).toBe(1104)
    expect(r.totalDiscount).toBe(195)
    expect(r.appliedRules).toEqual(['RULE-01'])
    expect(r.skippedRules).toEqual(['RULE-02'])
    expect(r.reasoning).toContain('you got 15% off')
    expect(r.reasoning).toContain('Rs.195 saved')
  })

  it('ITEM-02: RULE-02 flat 150 (winner) + RULE-03 10% stackable → final 629', () => {
    const r = applyDiscounts(CART[1], RULES)
    expect(r.finalPrice).toBe(629)
    expect(r.totalDiscount).toBe(220)
    expect(r.appliedRules).toContain('RULE-02')
    expect(r.appliedRules).toContain('RULE-03')
    expect(r.skippedRules).toEqual([])
    expect(r.reasoning).toContain('Rs.150 off')
    expect(r.reasoning).toContain('10% off')
    expect(r.reasoning).toContain('Rs.220 saved')
  })

  it('ITEM-03: RULE-01 15% → final 509', () => {
    const r = applyDiscounts(CART[2], RULES)
    expect(r.finalPrice).toBe(509)
    expect(r.totalDiscount).toBe(90)
    expect(r.appliedRules).toEqual(['RULE-01'])
  })

  it('ITEM-04: no rules → 2499 + "No offers available"', () => {
    const r = applyDiscounts(CART[3], RULES)
    expect(r.finalPrice).toBe(2499)
    expect(r.totalDiscount).toBe(0)
    expect(r.appliedRules).toEqual([])
    expect(r.reasoning).toBe('No offers available')
  })

  it('ITEM-05: RULE-01 15% → final 382', () => {
    const r = applyDiscounts(CART[4], RULES)
    expect(r.finalPrice).toBe(382)
    expect(r.totalDiscount).toBe(67)
  })

  it('ITEM-06: RULE-03 10% stackable alone → final 809', () => {
    const r = applyDiscounts(CART[5], RULES)
    expect(r.finalPrice).toBe(809)
    expect(r.totalDiscount).toBe(90)
    expect(r.appliedRules).toEqual(['RULE-03'])
    expect(r.skippedRules).toEqual([])
  })
})

// ── processCart + cartTotal ───────────────────────────────────────

describe('processCart + cartTotal', () => {
  it('sum of rounded item finals = 5932', () => {
    const results = processCart(CART, RULES)
    expect(results).toHaveLength(6)
    expect(cartTotal(results)).toBe(5932)
  })

  it('empty cart → empty results, total 0', () => {
    expect(processCart([], RULES)).toEqual([])
    expect(cartTotal([])).toBe(0)
  })

  it('null cart → empty results, total 0', () => {
    expect(processCart(null, RULES)).toEqual([])
    expect(cartTotal(null)).toBe(0)
  })
})

// ── applyCartDiscount ────────────────────────────────────────────

describe('applyCartDiscount', () => {
  it('RULE-04: 10% of 5932 (≥ 4000 threshold) → discount 593, final 5339', () => {
    const r = applyCartDiscount(5932, CART_RULES)
    expect(r.discount).toBe(593)
    expect(r.finalTotal).toBe(5339)
    expect(r.appliedRule).toBe('RULE-04')
    expect(r.reasoning).toContain('10% off')
    expect(r.reasoning).toContain('Rs.593 saved')
  })

  it('cart total exactly at threshold → applies', () => {
    const r = applyCartDiscount(4000, CART_RULES)
    expect(r.discount).toBe(400)
    expect(r.finalTotal).toBe(3600)
    expect(r.appliedRule).toBe('RULE-04')
  })

  it('cart total 1 rupee below threshold → does not apply and no cart row (discount is 0, appliedRule is null)', () => {
    const r = applyCartDiscount(3999, CART_RULES)
    expect(r.discount).toBe(0)
    expect(r.finalTotal).toBe(3999)
    expect(r.appliedRule).toBeNull()
    expect(r.reasoning).toContain('Add Rs.1 more')
  })

  it('no cart rules → subtotal unchanged, no reasoning', () => {
    const r = applyCartDiscount(5000, [])
    expect(r.discount).toBe(0)
    expect(r.finalTotal).toBe(5000)
    expect(r.appliedRule).toBeNull()
    expect(r.reasoning).toBe('')
  })

  it('null cart rules or zero subtotal → subtotal unchanged', () => {
    const r = applyCartDiscount(5000, null)
    expect(r.discount).toBe(0)
    expect(r.finalTotal).toBe(5000)
    expect(applyCartDiscount(0, CART_RULES).discount).toBe(0)
  })

  it('multiple non-stackable cart rules: picks rule giving largest rupee saving', () => {
    const rules = [
      { ruleId: 'C1', type: 'percentage', value: 5,  minCartTotal: 2000, stackable: false },
      { ruleId: 'C2', type: 'percentage', value: 10, minCartTotal: 4000, stackable: false },
      { ruleId: 'C3', type: 'flat',       value: 300, minCartTotal: 3000, stackable: false },
    ]
    const r = applyCartDiscount(5000, rules)
    // C1: 250, C2: 500, C3: 300 → C2 wins (500 saved)
    expect(r.discount).toBe(500)
    expect(r.finalTotal).toBe(4500)
    expect(r.appliedRule).toBe('C2')
    expect(r.skippedRules).toContain('C1')
    expect(r.skippedRules).toContain('C3')
  })

  it('multiple cart rules with stackable: winner applies first, stackable applies on top', () => {
    const rules = [
      { ruleId: 'C_WIN',   type: 'flat',       value: 500, minCartTotal: 3000, stackable: false },
      { ruleId: 'C_SKIP',  type: 'flat',       value: 200, minCartTotal: 2000, stackable: false },
      { ruleId: 'C_STACK', type: 'percentage', value: 10,  minCartTotal: 4000, stackable: true },
    ]
    // Subtotal: 5000.
    // Winner: C_WIN (500 off) -> remaining 4500.
    // Stackable: C_STACK (10% of 4500 = 450 off) -> remaining 4050.
    // Total discount: 500 + 450 = 950.
    const r = applyCartDiscount(5000, rules)
    expect(r.discount).toBe(950)
    expect(r.finalTotal).toBe(4050)
    expect(r.appliedRules).toEqual(['C_WIN', 'C_STACK'])
    expect(r.skippedRules).toEqual(['C_SKIP'])
  })

  it('flat-type cart rule applies and clamps at subtotal if larger', () => {
    const rules = [
      { ruleId: 'FLAT_BIG', type: 'flat', value: 1000, minCartTotal: 500, stackable: false },
    ]
    const r = applyCartDiscount(600, rules)
    expect(r.discount).toBe(600)
    expect(r.finalTotal).toBe(0)
  })

  it('supports min_cart_value property alias', () => {
    const rules = [
      { ruleId: 'VAL_ALIAS', type: 'percentage', value: 10, minCartValue: 2000 },
    ]
    const r = applyCartDiscount(2500, rules)
    expect(r.discount).toBe(250)
    expect(r.finalTotal).toBe(2250)
  })
})

// ── Edge cases ───────────────────────────────────────────────────

describe('edge cases', () => {
  it('tie between two non-stackable rules → one wins, one skipped, total correct', () => {
    const item = { itemId: 'TIE', product: 'Test', brand: 'BrandX', platform: 'PlatX', basePrice: 1000 }
    const rules = [
      { ruleId: 'A', scope: 'brand',    appliesTo: 'BrandX', type: 'flat',       value: 100, stackable: false },
      { ruleId: 'B', scope: 'platform', appliesTo: 'PlatX',  type: 'percentage', value: 10,  stackable: false },
    ]
    // Both give exactly 100 off.
    const r = applyDiscounts(item, rules)
    expect(r.finalPrice).toBe(900)
    expect(r.totalDiscount).toBe(100)
    expect(r.appliedRules).toHaveLength(1)
    expect(r.skippedRules).toHaveLength(1)
  })

  it('stackable-only: applies without a non-stackable winner', () => {
    const item = { itemId: 'SO', product: 'Test', brand: 'B', platform: 'P', basePrice: 500 }
    const rules = [
      { ruleId: 'S1', scope: 'brand', appliesTo: 'B', type: 'percentage', value: 20, stackable: true },
    ]
    const r = applyDiscounts(item, rules)
    expect(r.finalPrice).toBe(400)       // 500 - 100
    expect(r.totalDiscount).toBe(100)
    expect(r.appliedRules).toEqual(['S1'])
    expect(r.skippedRules).toEqual([])
  })

  it('multiple stackables accumulate sequentially', () => {
    const item = { itemId: 'MS', product: 'Test', brand: 'B', platform: 'P', basePrice: 1000 }
    const rules = [
      { ruleId: 'S1', scope: 'brand',    appliesTo: 'B', type: 'percentage', value: 10, stackable: true },
      { ruleId: 'S2', scope: 'platform', appliesTo: 'P', type: 'flat',       value: 50, stackable: true },
    ]
    // S1: 10% of 1000 = 100 → 900.  S2: flat 50 → 850.
    const r = applyDiscounts(item, rules)
    expect(r.finalPrice).toBe(850)
    expect(r.totalDiscount).toBe(150)
    expect(r.appliedRules).toEqual(['S1', 'S2'])
  })

  it('no matching rules → base price, reasoning "No offers available"', () => {
    const item = { itemId: 'NM', product: 'Test', brand: 'Unknown', platform: 'Unknown', basePrice: 999 }
    const r = applyDiscounts(item, RULES)
    expect(r.finalPrice).toBe(999)
    expect(r.totalDiscount).toBe(0)
    expect(r.reasoning).toBe('No offers available')
    expect(r.appliedRules).toEqual([])
    expect(r.skippedRules).toEqual([])
  })

  it('flat discount larger than price → clamps at 0', () => {
    const item = { itemId: 'CL', product: 'Test', brand: 'B', platform: 'P', basePrice: 50 }
    const rules = [
      { ruleId: 'BIG', scope: 'brand', appliesTo: 'B', type: 'flat', value: 200, stackable: false },
    ]
    const r = applyDiscounts(item, rules)
    expect(r.finalPrice).toBe(0)
    expect(r.totalDiscount).toBe(50)
  })

  it('handles null or empty rules safely without throwing', () => {
    const item = { itemId: 'TEST', product: 'Test', brand: 'B', platform: 'P', basePrice: 500 }
    expect(applyDiscounts(item, null)).toEqual({
      itemId: 'TEST',
      product: 'Test',
      brand: 'B',
      platform: 'P',
      basePrice: 500,
      finalPrice: 500,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    })
    expect(applyDiscounts(null, RULES)).toBeNull()
  })

  it('non-stackable winner + stackable that together exceed price → clamps at 0', () => {
    const item = { itemId: 'OV', product: 'Test', brand: 'B', platform: 'P', basePrice: 100 }
    const rules = [
      { ruleId: 'W', scope: 'brand',    appliesTo: 'B', type: 'flat',       value: 90,  stackable: false },
      { ruleId: 'S', scope: 'platform', appliesTo: 'P', type: 'flat',       value: 50,  stackable: true },
    ]
    // W: 100 → 90 off → 10.  S: flat 50 on 10 → clamps to 10 → 0.
    const r = applyDiscounts(item, rules)
    expect(r.finalPrice).toBe(0)
    expect(r.totalDiscount).toBe(100)
  })
})

// ── Full pipeline with sample CSVs ───────────────────────────────

describe('full pipeline — sample-data/*.csv', () => {
  it('parses and computes correct totals end-to-end', () => {
    const rulesText = readFileSync('sample-data/rules.csv', 'utf-8')
    const cartText  = readFileSync('sample-data/cart.csv', 'utf-8')

    const { itemRules, cartRules, errors: ruleErrors } = parseRulesCSV(rulesText)
    const { data: cartItems, errors: cartErrors } = parseCartCSV(cartText)

    expect(ruleErrors).toEqual([])
    expect(cartErrors).toEqual([])
    expect(itemRules).toHaveLength(3)
    expect(cartRules).toHaveLength(1)
    expect(cartItems).toHaveLength(6)

    const results = processCart(cartItems, itemRules)
    const subtotal = cartTotal(results)
    expect(subtotal).toBe(5932)

    const cd = applyCartDiscount(subtotal, cartRules)
    expect(cd.discount).toBe(593)
    expect(cd.finalTotal).toBe(5339)
  })
})
