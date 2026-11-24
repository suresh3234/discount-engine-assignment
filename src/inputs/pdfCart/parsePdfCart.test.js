/**
 * parsePdfCart.test.js
 *
 * Unit tests for PDF cart input adapter using generated fixtures:
 * 1. Good sample PDF (all 6 items from brief)
 * 2. Malformed PDF (valid rows + rows with missing/invalid prices)
 * 3. Empty PDF (header only, zero valid items)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parsePdfCart } from './parsePdfCart.js'
import { processCart, cartTotal, applyCartDiscount } from '../../engine/discountEngine.js'

const RULES = [
  { ruleId: 'RULE-01', scope: 'platform', appliesTo: 'Amazon India', type: 'percentage', value: 15, stackable: false },
  { ruleId: 'RULE-02', scope: 'brand',    appliesTo: 'Natura Casa',  type: 'flat',       value: 150, stackable: false },
  { ruleId: 'RULE-03', scope: 'platform', appliesTo: 'Flipkart',     type: 'percentage', value: 10,  stackable: true },
]

const CART_RULES = [
  { ruleId: 'RULE-04', type: 'percentage', value: 10, minCartTotal: 4000 },
]

describe('parsePdfCart — Good PDF Fixture', () => {
  it('parses all 6 items from sample-cart.pdf accurately', async () => {
    const pdfBuffer = readFileSync('test/fixtures/sample-cart.pdf')
    const { items, skipped, warnings } = await parsePdfCart(pdfBuffer)

    expect(skipped).toEqual([])
    expect(warnings).toEqual([])
    expect(items).toHaveLength(6)

    // ITEM-01: Cushion Cover
    expect(items[0]).toEqual({
      itemId: 'ITEM-01',
      product: 'Cushion Cover',
      brand: 'Natura Casa',
      platform: 'Amazon India',
      basePrice: 1299,
    })

    // ITEM-02: Bed Sheet Set
    expect(items[1]).toEqual({
      itemId: 'ITEM-02',
      product: 'Bed Sheet Set',
      brand: 'Natura Casa',
      platform: 'Flipkart',
      basePrice: 849,
    })

    // ITEM-03: Wall Shelf
    expect(items[2]).toEqual({
      itemId: 'ITEM-03',
      product: 'Wall Shelf',
      brand: 'LivSpace Pro',
      platform: 'Amazon India',
      basePrice: 599,
    })

    // ITEM-04: Ceramic Vase
    expect(items[3]).toEqual({
      itemId: 'ITEM-04',
      product: 'Ceramic Vase',
      brand: 'LivSpace Pro',
      platform: 'Noon',
      basePrice: 2499,
    })

    // ITEM-05: Cutting Board
    expect(items[4]).toEqual({
      itemId: 'ITEM-05',
      product: 'Cutting Board',
      brand: 'Nordic Basics',
      platform: 'Amazon India',
      basePrice: 449,
    })

    // ITEM-06: Desk Organiser
    expect(items[5]).toEqual({
      itemId: 'ITEM-06',
      product: 'Desk Organiser',
      brand: 'Nordic Basics',
      platform: 'Flipkart',
      basePrice: 899,
    })

    // End-to-end calculation verification with the pure engine
    const results = processCart(items, RULES)
    const subtotal = cartTotal(results)
    expect(subtotal).toBe(5932)

    const cartOffer = applyCartDiscount(subtotal, CART_RULES)
    expect(cartOffer.discount).toBe(593)
    expect(cartOffer.finalTotal).toBe(5339)
  })
})

describe('parsePdfCart — Malformed PDF Fixture', () => {
  it('skips malformed rows, extracts valid rows, and records warnings without crashing', async () => {
    const pdfBuffer = readFileSync('test/fixtures/malformed-cart.pdf')
    const { items, skipped, warnings } = await parsePdfCart(pdfBuffer)

    // Valid items extracted
    expect(items).toHaveLength(3)
    expect(items.map((i) => i.product)).toEqual([
      'Cushion Cover',
      'Bed Sheet Set',
      'Wall Shelf',
    ])

    // Malformed rows recorded
    expect(skipped).toHaveLength(2)
    expect(skipped[0].line).toContain('Ceramic Planter')
    expect(skipped[0].reason).toContain('price')

    expect(skipped[1].line).toContain('Throw Blanket')
    expect(skipped[1].reason).toContain('price')

    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })
})

describe('parsePdfCart — Empty / No Items PDF', () => {
  it('returns empty items array and "No cart items found" warning', async () => {
    const pdfBuffer = readFileSync('test/fixtures/empty-cart.pdf')
    const { items, skipped, warnings } = await parsePdfCart(pdfBuffer)

    expect(items).toEqual([])
    expect(warnings).toContain('No cart items found')
  })

  it('handles null or corrupted file inputs gracefully', async () => {
    const res = await parsePdfCart(null)
    expect(res.items).toEqual([])
    expect(res.warnings[0]).toContain('No cart items found')

    const corruptRes = await parsePdfCart(new Uint8Array([1, 2, 3, 4]))
    expect(corruptRes.items).toEqual([])
    expect(corruptRes.warnings[0]).toContain('Could not load PDF document')
  })
})
