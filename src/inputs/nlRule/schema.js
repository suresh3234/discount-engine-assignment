/**
 * schema.js
 *
 * Zod validation schema for the natural language rule parser output.
 * Ensures strict typing and defensive constraints before any rule touches the app.
 */

import { z } from 'zod'

/**
 * Strips markdown code blocks (```json ... ```) or extracts JSON substring.
 */
export function extractJson(text) {
  if (typeof text !== 'string') return ''
  const trimmed = text.trim()

  // Match ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // Find outermost JSON object
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return trimmed
}

// ── Unresolvable Schema ──────────────────────────────────────────

export const UnresolvablePayloadSchema = z.object({
  unresolvable: z.literal(true),
  reason: z.string().min(1, 'Reason is required for unresolvable rule'),
  missing: z.array(z.string()).optional().default([]),
})

// ── Valid Rule Schema ────────────────────────────────────────────

export const ValidRulePayloadSchema = z
  .object({
    unresolvable: z.literal(false).optional(),
    scope: z.enum(['brand', 'platform', 'cart'], {
      errorMap: () => ({ message: 'Scope must be "brand", "platform", or "cart"' }),
    }),
    type: z.enum(['percentage', 'flat'], {
      errorMap: () => ({ message: 'Type must be "percentage" or "flat"' }),
    }),
    value: z
      .number({ invalid_type_error: 'Discount value must be a number' })
      .positive('Discount value must be greater than 0'),
    stackable: z.boolean().default(false),
    applies_to: z.string().nullable().optional(),
    min_cart_value: z
      .number({ invalid_type_error: 'min_cart_value must be a number' })
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Percentage check: <= 100
    if (data.type === 'percentage' && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentage discount cannot exceed 100%',
      })
    }

    // 2. Brand & Platform rules require applies_to
    if (data.scope === 'brand' || data.scope === 'platform') {
      if (!data.applies_to || typeof data.applies_to !== 'string' || data.applies_to.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applies_to'],
          message: `${data.scope === 'brand' ? 'Brand' : 'Platform'} rules require an applies_to target`,
        })
      }
    }

    // 3. Cart rules require a positive min_cart_value
    if (data.scope === 'cart') {
      if (typeof data.min_cart_value !== 'number' || isNaN(data.min_cart_value) || data.min_cart_value <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['min_cart_value'],
          message: 'Cart rules require a positive min_cart_value threshold',
        })
      }
    }
  })

// ── Combined LLM Output Schema ───────────────────────────────────

export const NlRuleResponseSchema = z.union([
  UnresolvablePayloadSchema,
  ValidRulePayloadSchema,
])

/**
 * Validates a raw JavaScript object or parsed JSON payload against the schema.
 * Returns { success: true, data } or { success: false, error: string }
 */
export function validateRulePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { success: false, error: 'Rule payload must be an object' }
  }

  if (payload.unresolvable === true) {
    const result = UnresolvablePayloadSchema.safeParse(payload)
    if (!result.success) {
      const issues = result.error.issues || result.error.errors || []
      return { success: false, error: issues.map((e) => e.message).join('; ') }
    }
    return { success: true, data: result.data }
  }

  const result = ValidRulePayloadSchema.safeParse(payload)
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || []
    return { success: false, error: issues.map((e) => e.message).join('; ') }
  }
  return { success: true, data: result.data }
}
