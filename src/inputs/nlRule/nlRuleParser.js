/**
 * nlRuleParser.js
 *
 * Natural language rule parser adapter (src/inputs/nlRule/).
 * Converts plain English rule descriptions into canonical DiscountRule or CartRule objects.
 * Never touches the discount engine calculator.
 *
 * Contract:
 *   parseRule(text, options) ->
 *     | { status: "ok", rule: DiscountRule | CartRule }
 *     | { status: "unresolvable", reason: string, missing: string[] }
 */

import { extractJson, validateRulePayload } from './schema.js'

/**
 * Deterministic offline rule parser fallback.
 * Allows instant local testing and offline verification for standard English patterns.
 */
export function offlineParseRule(text) {
  if (!text || typeof text !== 'string') {
    return {
      unresolvable: true,
      reason: 'Rule description is empty.',
      missing: ['rule description'],
    }
  }

  const s = text.trim()
  const lower = s.toLowerCase()

  // Pattern 4: Ambiguous ("Give a discount for big orders", etc.)
  if (
    /give (a )?discount/i.test(s) &&
    !/\d+/.test(s)
  ) {
    return {
      unresolvable: true,
      reason: 'The discount value and eligibility threshold or brand/platform target are missing.',
      missing: ['discount value', 'target threshold or brand/platform'],
    }
  }

  // Pattern 1: "20% off for Natura Casa brand, stackable with other offers"
  const pctBrandMatch = lower.match(
    /(\d+(?:\.\d+)?)\s*%\s*off\s+(?:for|on)\s+([a-z0-9\s]+?)\s+brand/i,
  )
  if (pctBrandMatch) {
    const val = parseFloat(pctBrandMatch[1])
    const brand = pctBrandMatch[2].trim()
    const stackable = /stackable/i.test(lower) && !/non[- ]stackable|not stackable/i.test(lower)
    return {
      scope: 'brand',
      applies_to: s.substring(
        text.toLowerCase().indexOf(brand.toLowerCase()),
        text.toLowerCase().indexOf(brand.toLowerCase()) + brand.length,
      ).trim(),
      type: 'percentage',
      value: val,
      stackable,
      min_cart_value: null,
    }
  }

  // Pattern 2: "Rs.100 flat discount on all Flipkart items"
  const flatPlatMatch = lower.match(
    /(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:flat\s+discount|flat\s+off|off)\s+on\s+(?:all\s+)?([a-z0-9\s]+?)\s+(?:items|platform|store)/i,
  )
  if (flatPlatMatch) {
    const val = parseFloat(flatPlatMatch[1])
    const plat = flatPlatMatch[2].trim()
    const stackable = /stackable/i.test(lower) && !/non[- ]stackable|not stackable/i.test(lower)
    return {
      scope: 'platform',
      applies_to: s.substring(
        text.toLowerCase().indexOf(plat.toLowerCase()),
        text.toLowerCase().indexOf(plat.toLowerCase()) + plat.length,
      ).trim(),
      type: 'flat',
      value: val,
      stackable,
      min_cart_value: null,
    }
  }

  // Pattern 3: "10% off if cart value is more than Rs.5,000"
  const cartMatch = lower.match(
    /(\d+(?:\.\d+)?)\s*%\s*off\s+(?:if\s+)?cart\s+(?:value|total)\s+(?:is\s+)?(?:more\s+than|above|greater\s+than|over)\s+(?:rs\.?|inr|₹)?\s*([0-9,]+)/i,
  )
  if (cartMatch) {
    const val = parseFloat(cartMatch[1])
    const minVal = parseFloat(cartMatch[2].replace(/,/g, ''))
    const stackable = /stackable/i.test(lower) && !/non[- ]stackable|not stackable/i.test(lower)
    return {
      scope: 'cart',
      applies_to: null,
      type: 'percentage',
      value: val,
      stackable,
      min_cart_value: minVal,
    }
  }

  // Catch-all ambiguous
  return {
    unresolvable: true,
    reason: "Could not clearly resolve discount type, scope, or value from the description.",
    missing: ['unrecognized rule pattern'],
  }
}

/**
 * Parses natural language rule text into a typed rule object.
 *
 * @param {string} text - Raw natural language description
 * @param {object} [options]
 * @param {function} [options.fetchFn] - Custom fetch function (for unit tests)
 * @param {string} [options.apiUrl] - API URL (defaults to '/api/parse-rule')
 * @param {number} [options.timeoutMs] - Timeout in milliseconds (defaults to 10000)
 * @returns {Promise<{ status: "ok", rule: object } | { status: "unresolvable", reason: string, missing: string[] }>}
 */
export async function parseRule(text, options = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      status: 'unresolvable',
      reason: 'Please enter a description of the discount rule.',
      missing: ['rule description'],
    }
  }

  const cleanText = text.trim()
  const fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  const apiUrl = options.apiUrl || '/api/parse-rule'
  const timeoutMs = options.timeoutMs || 10000

  // Helper to call backend API
  async function callApi() {
    if (!fetchFn) {
      // Fallback directly to offline parser if no fetch environment
      return offlineParseRule(cleanText)
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

    try {
      const res = await fetchFn(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
        signal: controller ? controller.signal : undefined,
      })

      if (timer) clearTimeout(timer)

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`)
      }

      const responseText = await res.text()
      const jsonStr = extractJson(responseText)
      return JSON.parse(jsonStr)
    } catch (err) {
      if (timer) clearTimeout(timer)
      throw err
    }
  }

  // Attempt with retry at most once on invalid JSON / malformed payload
  let rawResult = null
  let lastError = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      rawResult = await callApi()
      const validation = validateRulePayload(rawResult)
      if (validation.success) {
        lastError = null
        break
      } else {
        lastError = validation.error
      }
    } catch (err) {
      lastError = err.message || 'JSON parse error'
    }
  }

  // If both attempts failed, check offline fallback as safety net
  if (lastError || !rawResult) {
    const fallback = offlineParseRule(cleanText)
    const validation = validateRulePayload(fallback)
    if (validation.success) {
      rawResult = fallback
      lastError = null
    }
  }

  if (lastError || !rawResult) {
    return {
      status: 'unresolvable',
      reason: `Rule format validation failed: ${lastError || 'Unable to parse rule.'}`,
      missing: ['valid rule structure'],
    }
  }

  // Handle unresolvable response from model
  if (rawResult.unresolvable === true) {
    return {
      status: 'unresolvable',
      reason: rawResult.reason || 'The rule description is too ambiguous or missing essential details.',
      missing: Array.isArray(rawResult.missing) ? rawResult.missing : [],
    }
  }

  // Map to canonical engine object
  if (rawResult.scope === 'cart') {
    return {
      status: 'ok',
      rule: {
        scope: 'cart',
        type: rawResult.type,
        value: rawResult.value,
        stackable: Boolean(rawResult.stackable),
        minCartTotal: Math.round(rawResult.min_cart_value),
        minCartValue: Math.round(rawResult.min_cart_value),
      },
    }
  }

  return {
    status: 'ok',
    rule: {
      scope: rawResult.scope,
      appliesTo: (rawResult.applies_to || '').trim(),
      type: rawResult.type,
      value: rawResult.value,
      stackable: Boolean(rawResult.stackable),
    },
  }
}
