/**
 * src/inputs/index.js
 *
 * Unified entry point and common contract for all input adapters.
 *
 * Common Adapter Shape:
 *   type Result<T> = {
 *     success: boolean,
 *     data?: T,
 *     errors?: string[],
 *     warnings?: string[],
 *     skipped?: Array<{ line: string, reason: string }>
 *   }
 *
 *   type InputAdapter<TInput, TOutput> = (source: TInput, options?: object) => Promise<Result<TOutput>>
 *
 * All adapters transform raw input formats into the engine's canonical types
 * (DiscountRule, CartRule, CartItem) without touching the pure calculation engine.
 */

import { parseRulesCSV, parseCartCSV } from './csv/csvAdapter.js'
import { parseRule } from './nlRule/nlRuleParser.js'
import { parsePdfCart } from './pdfCart/parsePdfCart.js'

// ── 1. CSV Adapters ──────────────────────────────────────────────

export const csvRulesAdapter = async (csvText) => {
  const { itemRules, cartRules, errors } = parseRulesCSV(csvText)
  return {
    success: errors.length === 0,
    data: { itemRules, cartRules },
    errors,
  }
}

export const csvCartAdapter = async (csvText) => {
  const { data, errors } = parseCartCSV(csvText)
  return {
    success: errors.length === 0,
    data,
    errors,
  }
}

// ── 2. Natural Language Rule Adapter ─────────────────────────────

export const nlRuleAdapter = async (plainEnglishText, options) => {
  const res = await parseRule(plainEnglishText, options)
  if (res.status === 'ok') {
    return {
      success: true,
      data: res.rule,
    }
  }
  return {
    success: false,
    errors: [res.reason],
    warnings: res.missing ? [`Missing: ${res.missing.join(', ')}`] : [],
  }
}

// ── 3. PDF Cart Invoice Adapter ──────────────────────────────────

export const pdfCartAdapter = async (pdfFile, options) => {
  const { items, skipped, warnings } = await parsePdfCart(pdfFile, options)
  return {
    success: items.length > 0,
    data: items,
    skipped,
    warnings,
    errors: items.length === 0 ? warnings : [],
  }
}

// ── Direct exports for backward compatibility ────────────────────
export { parseRulesCSV, parseCartCSV } from './csv/csvAdapter.js'
export { parseRule } from './nlRule/nlRuleParser.js'
export { parsePdfCart } from './pdfCart/parsePdfCart.js'
