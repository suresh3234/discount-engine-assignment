/**
 * nlRuleParser.test.js
 *
 * Unit tests for Zod schema validator and natural language rule adapter.
 * Uses mocked LLM responses — no live network calls.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  extractJson,
  validateRulePayload,
  ValidRulePayloadSchema,
  UnresolvablePayloadSchema,
} from './schema.js'
import { parseRule, offlineParseRule } from './nlRuleParser.js'

// ── Zod Validator Tests ──────────────────────────────────────────

describe('Zod Validator — Valid Payloads', () => {
  it('validates a correct brand percentage rule', () => {
    const payload = {
      scope: 'brand',
      applies_to: 'Natura Casa',
      type: 'percentage',
      value: 20,
      stackable: true,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(true)
    expect(res.data.scope).toBe('brand')
    expect(res.data.applies_to).toBe('Natura Casa')
    expect(res.data.value).toBe(20)
    expect(res.data.stackable).toBe(true)
  })

  it('validates a correct platform flat rule', () => {
    const payload = {
      scope: 'platform',
      applies_to: 'Flipkart',
      type: 'flat',
      value: 100,
      stackable: false,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(true)
    expect(res.data.scope).toBe('platform')
    expect(res.data.type).toBe('flat')
    expect(res.data.value).toBe(100)
    expect(res.data.stackable).toBe(false)
  })

  it('validates a correct cart percentage rule with min_cart_value', () => {
    const payload = {
      scope: 'cart',
      type: 'percentage',
      value: 10,
      stackable: false,
      min_cart_value: 5000,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(true)
    expect(res.data.scope).toBe('cart')
    expect(res.data.min_cart_value).toBe(5000)
  })

  it('validates an unresolvable payload with reason and missing fields', () => {
    const payload = {
      unresolvable: true,
      reason: 'Missing discount value and minimum threshold',
      missing: ['discount value', 'minimum order value'],
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(true)
    expect(res.data.unresolvable).toBe(true)
    expect(res.data.missing).toContain('discount value')
  })
})

describe('Zod Validator — Invalid Payloads', () => {
  it('rejects invalid scope enum', () => {
    const payload = {
      scope: 'category',
      applies_to: 'Electronics',
      type: 'percentage',
      value: 15,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/brand|platform|cart/i)
  })

  it('rejects invalid type enum', () => {
    const payload = {
      scope: 'brand',
      applies_to: 'Nike',
      type: 'bogo',
      value: 15,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/percentage|flat/i)
  })

  it('rejects non-numeric value', () => {
    const payload = {
      scope: 'brand',
      applies_to: 'Nike',
      type: 'percentage',
      value: 'twenty',
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/number/i)
  })

  it('rejects value <= 0', () => {
    const payload = {
      scope: 'brand',
      applies_to: 'Nike',
      type: 'flat',
      value: 0,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Discount value must be greater than 0')
  })

  it('rejects percentage value > 100', () => {
    const payload = {
      scope: 'brand',
      applies_to: 'Nike',
      type: 'percentage',
      value: 120,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Percentage discount cannot exceed 100%')
  })

  it('rejects brand rule without applies_to', () => {
    const payload = {
      scope: 'brand',
      type: 'percentage',
      value: 15,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Brand rules require an applies_to target')
  })

  it('rejects platform rule with empty applies_to string', () => {
    const payload = {
      scope: 'platform',
      applies_to: '   ',
      type: 'flat',
      value: 50,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Platform rules require an applies_to target')
  })

  it('rejects cart rule without min_cart_value', () => {
    const payload = {
      scope: 'cart',
      type: 'percentage',
      value: 10,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Cart rules require a positive min_cart_value threshold')
  })

  it('rejects cart rule with non-positive min_cart_value', () => {
    const payload = {
      scope: 'cart',
      type: 'percentage',
      value: 10,
      min_cart_value: -100,
    }
    const res = validateRulePayload(payload)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Cart rules require a positive min_cart_value threshold')
  })
})

// ── Markdown JSON Extraction ─────────────────────────────────────

describe('extractJson', () => {
  it('extracts JSON from standard markdown fences', () => {
    const input = '```json\n{"scope":"brand","value":10}\n```'
    expect(extractJson(input)).toBe('{"scope":"brand","value":10}')
  })

  it('extracts JSON from plain backticks', () => {
    const input = 'Here is the rule:\n```\n{"scope":"cart"}\n```'
    expect(extractJson(input)).toBe('{"scope":"cart"}')
  })

  it('extracts JSON when surrounded by commentary', () => {
    const input = 'Sure! {"scope":"platform","applies_to":"Amazon"} is the rule.'
    expect(extractJson(input)).toBe('{"scope":"platform","applies_to":"Amazon"}')
  })
})

// ── Mocked LLM Adapter Tests (parseRule) ─────────────────────────

describe('parseRule with Mocked LLM', () => {
  it('parses valid JSON response from mock LLM', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        scope: 'brand',
        applies_to: 'Natura Casa',
        type: 'percentage',
        value: 20,
        stackable: true,
      }),
    })

    const result = await parseRule('20% off for Natura Casa', { fetchFn: mockFetch })
    expect(result.status).toBe('ok')
    expect(result.rule.scope).toBe('brand')
    expect(result.rule.appliesTo).toBe('Natura Casa')
    expect(result.rule.value).toBe(20)
    expect(result.rule.stackable).toBe(true)
  })

  it('handles markdown-fenced LLM output', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '```json\n{\n  "scope": "platform",\n  "applies_to": "Flipkart",\n  "type": "flat",\n  "value": 100,\n  "stackable": false\n}\n```',
    })

    const result = await parseRule('Rs.100 flat discount on Flipkart', { fetchFn: mockFetch })
    expect(result.status).toBe('ok')
    expect(result.rule.scope).toBe('platform')
    expect(result.rule.appliesTo).toBe('Flipkart')
    expect(result.rule.value).toBe(100)
    expect(result.rule.stackable).toBe(false)
  })

  it('retries once if LLM returns malformed JSON on first attempt', async () => {
    let callCount = 0
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return { ok: true, text: async () => 'not json at all' }
      }
      return {
        ok: true,
        text: async () => JSON.stringify({
          scope: 'cart',
          type: 'percentage',
          value: 10,
          stackable: false,
          min_cart_value: 5000,
        }),
      }
    })

    const result = await parseRule('10% off for orders over 5000', { fetchFn: mockFetch })
    expect(result.status).toBe('ok')
    expect(result.rule.scope).toBe('cart')
    expect(result.rule.minCartValue).toBe(5000)
    expect(callCount).toBe(2)
  })

  it('returns unresolvable status when LLM returns unresolvable flag', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        unresolvable: true,
        reason: 'Threshold for big orders is undefined.',
        missing: ['minimum order value', 'discount percentage'],
      }),
    })

    const result = await parseRule('Give a discount for big orders', { fetchFn: mockFetch })
    expect(result.status).toBe('unresolvable')
    expect(result.reason).toContain('Threshold for big orders is undefined.')
    expect(result.missing).toContain('minimum order value')
  })

  it('handles network error gracefully without crashing', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    const result = await parseRule('20% off for Natura Casa brand, stackable with other offers', { fetchFn: mockFetch })
    // Fallback parser kicks in seamlessly
    expect(result.status).toBe('ok')
    expect(result.rule.scope).toBe('brand')
  })
})

// ── Required 4 Examples Verification ─────────────────────────────

describe('4 Required Natural Language Examples', () => {
  it('Example 1: "20% off for Natura Casa brand, stackable with other offers" -> Brand · Natura Casa · Percentage · 20% · stackable Yes', async () => {
    const res = await parseRule('20% off for Natura Casa brand, stackable with other offers', { fetchFn: null })
    expect(res.status).toBe('ok')
    expect(res.rule.scope).toBe('brand')
    expect(res.rule.appliesTo).toBe('Natura Casa')
    expect(res.rule.type).toBe('percentage')
    expect(res.rule.value).toBe(20)
    expect(res.rule.stackable).toBe(true)
  })

  it('Example 2: "Rs.100 flat discount on all Flipkart items" -> Platform · Flipkart · Flat · Rs.100 · stackable No', async () => {
    const res = await parseRule('Rs.100 flat discount on all Flipkart items', { fetchFn: null })
    expect(res.status).toBe('ok')
    expect(res.rule.scope).toBe('platform')
    expect(res.rule.appliesTo).toBe('Flipkart')
    expect(res.rule.type).toBe('flat')
    expect(res.rule.value).toBe(100)
    expect(res.rule.stackable).toBe(false)
  })

  it('Example 3: "10% off if cart value is more than Rs.5,000" -> Cart · Percentage · 10% · min cart value Rs.5,000', async () => {
    const res = await parseRule('10% off if cart value is more than Rs.5,000', { fetchFn: null })
    expect(res.status).toBe('ok')
    expect(res.rule.scope).toBe('cart')
    expect(res.rule.type).toBe('percentage')
    expect(res.rule.value).toBe(10)
    expect(res.rule.minCartValue).toBe(5000)
    expect(res.rule.minCartTotal).toBe(5000)
  })

  it('Example 4: "Give a discount for big orders" -> unresolvable with missing details', async () => {
    const res = await parseRule('Give a discount for big orders', { fetchFn: null })
    expect(res.status).toBe('unresolvable')
    expect(res.reason).toBeTruthy()
    expect(res.missing.length).toBeGreaterThan(0)
  })
})
