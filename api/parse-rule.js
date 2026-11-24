/**
 * api/parse-rule.js
 *
 * Serverless function for Vercel (POST /api/parse-rule).
 * Calls the Anthropic Messages API using the server-side ANTHROPIC_API_KEY environment variable.
 * Ensures the API key never ships to the browser.
 */

const SYSTEM_PROMPT = `You are an expert natural language discount rule parser for an e-commerce platform.
Your task is to parse a customer's or store manager's plain English rule description into a strict JSON object.

RULES:
1. Output valid JSON ONLY. Do not include markdown code fences, notes, or any conversational prose.
2. The JSON schema must strictly match ONE of the following:

If the rule is actionable:
{
  "scope": "brand" | "platform" | "cart",
  "applies_to": string | null, // target brand (e.g. "Natura Casa") or platform (e.g. "Flipkart"). Required if scope is "brand" or "platform".
  "type": "percentage" | "flat", // "percentage" or "flat" in rupees
  "value": number, // positive number (e.g. 20 for 20%, 100 for Rs.100). For percentage, must be <= 100.
  "stackable": boolean, // true ONLY if explicitly described as stackable or combinable, otherwise false
  "min_cart_value": number | null // minimum order subtotal. Required if scope is "cart" (e.g. 5000).
}

If the rule description is ambiguous, missing required values (e.g. missing discount percentage/amount, missing target brand/platform, or missing cart threshold), or unresolvable:
{
  "unresolvable": true,
  "reason": "Clear, friendly explanation of why the rule cannot be resolved and what information is missing.",
  "missing": ["list", "of", "missing", "fields"]
}

EXAMPLES:
1. "20% off for Natura Casa brand, stackable with other offers"
   {"scope":"brand","applies_to":"Natura Casa","type":"percentage","value":20,"stackable":true,"min_cart_value":null}

2. "Rs.100 flat discount on all Flipkart items"
   {"scope":"platform","applies_to":"Flipkart","type":"flat","value":100,"stackable":false,"min_cart_value":null}

3. "10% off if cart value is more than Rs.5,000"
   {"scope":"cart","applies_to":null,"type":"percentage","value":10,"stackable":false,"min_cart_value":5000}

4. "Give a discount for big orders"
   {"unresolvable":true,"reason":"The discount percentage/amount and the minimum cart threshold for big orders are not specified.","missing":["discount value","minimum cart threshold"]}`

/**
 * Strips markdown code blocks (```json ... ```) or extracts JSON substring.
 */
function cleanJson(text) {
  if (typeof text !== 'string') return ''
  const trimmed = text.trim()
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const text = (body.text || '').trim()

    if (!text) {
      res.status(400).json({
        unresolvable: true,
        reason: 'Rule description is required.',
        missing: ['rule description'],
      })
      return
    }

    const apiKey = process.env.ANTHROPIC_API_KEY

    // Fallback if ANTHROPIC_API_KEY is not configured in environment
    if (!apiKey) {
      // Offline fallback pattern matcher so local / demo environments function without an API key
      const lower = text.toLowerCase()
      if (/give (a )?discount/i.test(text) && !/\d+/.test(text)) {
        res.status(200).json({
          unresolvable: true,
          reason: "The discount value and eligibility threshold or brand/platform target are missing.",
          missing: ["discount value", "target threshold or brand/platform"],
        })
        return
      }

      const pctBrand = lower.match(/(\d+(?:\.\d+)?)\s*%\s*off\s+(?:for|on)\s+([a-z0-9\s]+?)\s+brand/i)
      if (pctBrand) {
        res.status(200).json({
          scope: 'brand',
          applies_to: pctBrand[2].trim(),
          type: 'percentage',
          value: parseFloat(pctBrand[1]),
          stackable: /stackable/i.test(lower) && !/non[- ]stackable/i.test(lower),
          min_cart_value: null,
        })
        return
      }

      const flatPlat = lower.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:flat\s+discount|flat\s+off|off)\s+on\s+(?:all\s+)?([a-z0-9\s]+?)\s+(?:items|platform|store)/i)
      if (flatPlat) {
        res.status(200).json({
          scope: 'platform',
          applies_to: flatPlat[2].trim(),
          type: 'flat',
          value: parseFloat(flatPlat[1]),
          stackable: /stackable/i.test(lower) && !/non[- ]stackable/i.test(lower),
          min_cart_value: null,
        })
        return
      }

      const cartMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s*off\s+(?:if\s+)?cart\s+(?:value|total)\s+(?:is\s+)?(?:more\s+than|above|greater\s+than|over)\s+(?:rs\.?|inr|₹)?\s*([0-9,]+)/i)
      if (cartMatch) {
        res.status(200).json({
          scope: 'cart',
          applies_to: null,
          type: 'percentage',
          value: parseFloat(cartMatch[1]),
          stackable: /stackable/i.test(lower) && !/non[- ]stackable/i.test(lower),
          min_cart_value: parseFloat(cartMatch[2].replace(/,/g, '')),
        })
        return
      }

      res.status(200).json({
        unresolvable: true,
        reason: "ANTHROPIC_API_KEY environment variable is not set and the description could not be matched by local patterns.",
        missing: ["ANTHROPIC_API_KEY or clearer rule description"],
      })
      return
    }

    // Call Anthropic Messages API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 400,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      res.status(502).json({
        unresolvable: true,
        reason: `Anthropic API error (${response.status}): ${errText}`,
        missing: [],
      })
      return
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''
    const parsed = JSON.parse(cleanJson(content))
    res.status(200).json(parsed)
  } catch (err) {
    res.status(500).json({
      unresolvable: true,
      reason: `Server error while parsing rule: ${err.message}`,
      missing: [],
    })
  }
}
