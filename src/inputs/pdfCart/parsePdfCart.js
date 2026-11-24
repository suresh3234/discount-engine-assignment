/**
 * parsePdfCart.js
 *
 * PDF Cart input adapter (src/inputs/pdfCart/).
 * Extracts cart items from structured PDF invoices / order summaries client-side using pdfjs-dist.
 * Reconstructs rows from text items by Y-position, anchors on the price, and maps columns.
 *
 * Contract:
 *   parsePdfCart(file, options) -> Promise<{
 *     items: CartItem[],
 *     skipped: { line: string, reason: string }[],
 *     warnings: string[]
 *   }>
 *
 * Canonical CartItem:
 *   { itemId: string, product: string, brand: string, platform: string, basePrice: number }
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// Configure workerSrc in browser environments if needed
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  } catch {
    // Fall back to main-thread parsing
  }
}

const DEFAULT_PLATFORMS = [
  'Amazon India',
  'Amazon',
  'Flipkart',
  'Noon',
  'Myntra',
  'Ajio',
  'Meesho',
  'Tata CLiQ',
  'Nykaa',
]

const DEFAULT_BRANDS = [
  'Natura Casa',
  'LivSpace Pro',
  'Nordic Basics',
]

/**
 * Checks if a line is a table header or invoice document header.
 */
function isHeaderLine(lineText) {
  const s = lineText.trim().toLowerCase()
  if (/^order\s*#/i.test(s)) return true
  if (/date\s*:/i.test(s)) return true
  if (s.includes('product') && s.includes('brand')) return true
  if (s.includes('platform') && s.includes('price')) return true
  return false
}

/**
 * Normalizes input into a pure Uint8Array suitable for pdfjs-dist.
 */
async function toUint8Array(file) {
  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  }
  if (file && typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  }
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file)
  }
  if (file instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(file))) {
    // pdfjs-dist requires a pure Uint8Array instance, not a Node Buffer
    const copy = new Uint8Array(file.byteLength)
    copy.set(file)
    return copy
  }
  throw new Error('Unsupported file input: expected File, Blob, ArrayBuffer, or Uint8Array.')
}

/**
 * Parses a PDF file and extracts cart items.
 *
 * @param {File|Blob|ArrayBuffer|Uint8Array} file
 * @param {object} [options]
 * @param {string[]} [options.knownPlatforms]
 * @param {string[]} [options.knownBrands]
 * @returns {Promise<{ items: Array, skipped: Array, warnings: string[] }>}
 */
export async function parsePdfCart(file, options = {}) {
  const items = []
  const skipped = []
  const warnings = []

  if (!file) {
    return {
      items: [],
      skipped: [{ line: '', reason: 'No file provided' }],
      warnings: ['No cart items found: file was empty or missing.'],
    }
  }

  let uint8Array
  try {
    uint8Array = await toUint8Array(file)
  } catch (err) {
    return {
      items: [],
      skipped: [{ line: '', reason: err.message }],
      warnings: [`Failed to read PDF file: ${err.message}`],
    }
  }

  let pdf
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    })
    pdf = await loadingTask.promise
  } catch (err) {
    return {
      items: [],
      skipped: [{ line: '', reason: `Corrupt or invalid PDF: ${err.message}` }],
      warnings: [`Could not load PDF document: ${err.message}`],
    }
  }

  // Build sorted lists of known platforms and brands (longest first for greedy matching)
  const knownPlatforms = Array.from(
    new Set([...(options.knownPlatforms || []), ...DEFAULT_PLATFORMS]),
  ).sort((a, b) => b.length - a.length)

  const knownBrands = Array.from(
    new Set([...(options.knownBrands || []), ...DEFAULT_BRANDS]),
  ).sort((a, b) => b.length - a.length)

  // Process all pages
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Cluster text items by y-position within 4pt tolerance
    const lineMap = new Map() // yKey -> Array of { x, y, str }

    for (const item of textContent.items) {
      const str = (item.str || '').trim()
      if (!str) continue

      const x = item.transform[4]
      const y = item.transform[5]

      // Find an existing yKey within tolerance
      let matchedKey = null
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          matchedKey = existingY
          break
        }
      }

      if (matchedKey !== null) {
        lineMap.get(matchedKey).push({ x, y, str })
      } else {
        lineMap.set(y, [{ x, y, str }])
      }
    }

    // Sort lines by y descending (top of page to bottom)
    const sortedYKeys = Array.from(lineMap.keys()).sort((a, b) => b - a)

    for (const yKey of sortedYKeys) {
      const lineItems = lineMap.get(yKey)
      // Sort items left to right
      lineItems.sort((a, b) => a.x - b.x)

      const lineText = lineItems.map((it) => it.str).join(' ').trim()
      if (!lineText) continue

      // Skip document and table headers
      if (isHeaderLine(lineText)) {
        continue
      }

      // ── Row Parsing ──

      // 1. Anchor on price at the end of the row
      const priceRegex = /(?:rs\.?|inr|₹)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\s*$/i
      const priceMatch = lineText.match(priceRegex)

      if (!priceMatch) {
        skipped.push({
          line: lineText,
          reason: 'Missing or non-numeric price',
        })
        warnings.push(`Skipped row "${lineText}": Missing or non-numeric price.`)
        continue
      }

      const rawPriceStr = priceMatch[1].replace(/,/g, '')
      const basePrice = Math.round(parseFloat(rawPriceStr))
      if (isNaN(basePrice) || basePrice <= 0) {
        skipped.push({
          line: lineText,
          reason: 'Price must be a positive number',
        })
        warnings.push(`Skipped row "${lineText}": Invalid price "${priceMatch[1]}".`)
        continue
      }

      let remaining = lineText.slice(0, priceMatch.index).trim()
      if (!remaining) {
        skipped.push({
          line: lineText,
          reason: 'Missing product, brand, and platform information',
        })
        warnings.push(`Skipped row "${lineText}": No product details preceding price.`)
        continue
      }

      // 2. Match platform (greedy match from end of remaining text)
      let platform = null
      for (const p of knownPlatforms) {
        if (remaining.toLowerCase().endsWith(p.toLowerCase())) {
          platform = p
          remaining = remaining.slice(0, remaining.length - p.length).trim()
          break
        }
      }

      // 3. Match brand (greedy match from end of remaining text)
      let brand = null
      for (const b of knownBrands) {
        if (remaining.toLowerCase().endsWith(b.toLowerCase())) {
          brand = b
          remaining = remaining.slice(0, remaining.length - b.length).trim()
          break
        }
      }

      // 4. Fallback: column-gap splitting if brand or platform not matched
      if (!platform || !brand) {
        // If lineItems has 4 separate column chunks (Product, Brand, Platform, Price)
        if (lineItems.length >= 4) {
          const productGuess = lineItems[0].str.trim()
          const brandGuess = lineItems[1].str.trim()
          const platformGuess = lineItems[2].str.trim()

          if (!platform) platform = platformGuess
          if (!brand) brand = brandGuess
          if (!remaining) remaining = productGuess
        }
      }

      const product = remaining.trim()

      if (!product || !brand || !platform) {
        skipped.push({
          line: lineText,
          reason: 'Unknown row shape: could not separate product, brand, and platform',
        })
        warnings.push(`Skipped row "${lineText}": Could not separate product, brand, and platform.`)
        continue
      }

      const itemId = `ITEM-${String(items.length + 1).padStart(2, '0')}`
      items.push({
        itemId,
        product,
        brand,
        platform,
        basePrice,
      })
    }
  }

  if (items.length === 0) {
    warnings.push('No cart items found')
  }

  return { items, skipped, warnings }
}
