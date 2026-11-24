/**
 * App.jsx
 *
 * Top-level component. Manages state for rules, cart items, and results.
 * Wires together input adapters → engine → display.
 */

import { useState, useEffect } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import NlRuleInput from './components/NlRuleInput.jsx'
import PdfUploader from './components/PdfUploader.jsx'
import { parseRulesCSV, parseCartCSV } from './adapters/csvAdapter.js'
import { parsePdfCart } from './inputs/pdfCart/parsePdfCart.js'
import {
  processCart,
  cartTotal,
  applyCartDiscount,
} from './engine/discountEngine.js'

// ── Column definitions ───────────────────────────────────────────

const RULES_COLUMNS = [
  { key: 'ruleId', label: 'Rule ID' },
  {
    key: 'scope',
    label: 'Scope',
    render: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  },
  { key: 'appliesTo', label: 'Applies To' },
  {
    key: 'type',
    label: 'Type',
    render: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) =>
      row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  { key: 'stackable', label: 'Stackable', render: (v) => (v ? 'Yes' : 'No') },
]

const CART_RULES_COLUMNS = [
  { key: 'ruleId', label: 'Rule ID' },
  {
    key: 'type',
    label: 'Type',
    render: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  },
  {
    key: 'value',
    label: 'Discount',
    render: (v, row) =>
      row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  {
    key: 'minCartTotal',
    label: 'Min Cart Total',
    render: (v) => `Rs.${v.toLocaleString('en-IN')}`,
  },
]

const CART_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  { key: 'brand', label: 'Brand' },
  { key: 'platform', label: 'Platform' },
  {
    key: 'basePrice',
    label: 'Base Price',
    render: (v) => `Rs.${v.toLocaleString('en-IN')}`,
  },
]

const RESULTS_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  {
    key: 'basePrice',
    label: 'Base Price',
    render: (v) => `Rs.${v.toLocaleString('en-IN')}`,
  },
  {
    key: 'finalPrice',
    label: 'Final Price',
    render: (v, row) => (
      <span
        style={{
          fontWeight: 700,
          color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48',
        }}
      >
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>
          Rs.{v.toLocaleString('en-IN')}
        </span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span
        style={{
          color: v === 'No offers available' ? '#888' : '#131A48',
          fontStyle: v === 'No offers available' ? 'italic' : 'normal',
        }}
      >
        {v}
      </span>
    ),
  },
]

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#f7f7f9',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    background: '#131A48',
    padding: '0.85rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoTxt: {
    fontFamily: 'Georgia, serif',
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  logoSpan: { color: '#FF5800' },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  main: { maxWidth: 960, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: {
    background: '#fff',
    border: '1px solid #CECECE',
    borderRadius: 6,
    padding: '1.2rem 1.4rem',
    marginBottom: '1.2rem',
  },
  sectionTitle: {
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: 14,
    color: '#131A48',
    marginBottom: '0.7rem',
    paddingBottom: 6,
    borderBottom: '2px solid #FF5800',
    display: 'inline-block',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn: {
    background: '#FF5800',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.65rem 2rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.65rem 2rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'not-allowed',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
}

const DEFAULT_RULES_CSV = `rule_id,scope,applies_to,type,value,stackable,min_cart_value
RULE-01,brand,Natura Casa,percentage,15,false,
RULE-02,brand,Natura Casa,flat,150,false,
RULE-03,platform,Flipkart,percentage,10,true,
RULE-04,cart,,percentage,10,false,4000`

const DEFAULT_CART_CSV = `item_id,product,brand,platform,base_price
ITEM-01,Cushion Cover,Natura Casa,Amazon India,1299
ITEM-02,Bed Sheet Set,Natura Casa,Flipkart,849
ITEM-03,Wall Shelf,LivSpace Pro,Amazon India,599
ITEM-04,Ceramic Vase,LivSpace Pro,Noon,2499
ITEM-05,Cutting Board,Nordic Basics,Amazon India,449
ITEM-06,Desk Organiser,Nordic Basics,Flipkart,899`

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules] = useState([])
  const [cartRules, setCartRules] = useState([])
  const [rulesErrors, setRulesErr] = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems] = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName] = useState('')
  const [cartMode, setCartMode] = useState('csv') // 'csv' | 'pdf'
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfSkipped, setPdfSkipped] = useState([])
  const [pdfWarnings, setPdfWarnings] = useState([])
  const [previousCart, setPreviousCart] = useState(null)

  const [results, setResults] = useState(null)
  const [cartDiscountResult, setCartDiscountResult] = useState(null)

  function loadSampleData() {
    const { itemRules, cartRules: cr } = parseRulesCSV(DEFAULT_RULES_CSV)
    const { data: items } = parseCartCSV(DEFAULT_CART_CSV)
    setRules(itemRules)
    setCartRules(cr)
    setRulesErr([])
    setRulesFileName('rules.csv (sample)')
    setCartItems(items)
    setCartErrors([])
    setCartFileName('cart.csv (sample)')
    setPdfSkipped([])
    setPdfWarnings([])
    setPreviousCart(null)

    const res = processCart(items, itemRules)
    setResults(res)
    const subtotal = cartTotal(res)
    setCartDiscountResult(applyCartDiscount(subtotal, cr))
  }

  // Auto-populate with sample rules and cart items on mount
  useEffect(() => {
    loadSampleData()
  }, [])

  // ── Handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { itemRules, cartRules: cr, errors } = parseRulesCSV(csvText)
    setRules(itemRules)
    setCartRules(cr)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setResults(null)
    setCartDiscountResult(null)
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setPdfSkipped([])
    setPdfWarnings([])
    setPreviousCart(null)
    setResults(null)
    setCartDiscountResult(null)
  }

  async function handlePdfLoad(file) {
    setPdfLoading(true)
    setPdfWarnings([])
    setPdfSkipped([])
    setCartErrors([])

    try {
      const activeBrands = rules.filter((r) => r.scope === 'brand').map((r) => r.appliesTo)
      const { items, skipped, warnings } = await parsePdfCart(file, {
        knownBrands: activeBrands,
      })

      if (items.length === 0) {
        setCartErrors(['No cart items found: the PDF did not contain any valid cart rows. Current cart left untouched.'])
        setPdfLoading(false)
        return
      }

      // Save previous cart state in case user cancels / reverts
      setPreviousCart(cartItems)

      // Replace current cart
      setCartItems(items)
      setCartFileName(file.name)
      setPdfSkipped(skipped)
      setPdfWarnings(warnings)

      // Automatically re-run the engine on the new cart with active rules
      if (rules.length > 0) {
        const res = processCart(items, rules)
        setResults(res)
        const subtotal = cartTotal(res)
        setCartDiscountResult(
          cartRules.length > 0 ? applyCartDiscount(subtotal, cartRules) : null,
        )
      } else {
        setResults(null)
        setCartDiscountResult(null)
      }
    } catch (err) {
      setCartErrors([`Error processing PDF: ${err.message}`])
    } finally {
      setPdfLoading(false)
    }
  }

  function handleRevertCart() {
    if (!previousCart) return
    setCartItems(previousCart)
    setPdfSkipped([])
    setPdfWarnings([])
    setPreviousCart(null)
    if (rules.length > 0 && previousCart.length > 0) {
      const res = processCart(previousCart, rules)
      setResults(res)
      const subtotal = cartTotal(res)
      setCartDiscountResult(
        cartRules.length > 0 ? applyCartDiscount(subtotal, cartRules) : null,
      )
    } else {
      setResults(null)
      setCartDiscountResult(null)
    }
  }

  function handleCalculate() {
    const res = processCart(cartItems, rules)
    setResults(res)
    const subtotal = cartTotal(res)
    setCartDiscountResult(
      cartRules.length > 0 ? applyCartDiscount(subtotal, cartRules) : null,
    )
  }

  function handleAddNlRule(parsedRule) {
    const allRuleIds = [
      ...rules.map((r) => r.ruleId),
      ...cartRules.map((r) => r.ruleId),
    ]
    const idsNums = allRuleIds
      .map((id) => {
        const m = (id || '').match(/^RULE-(\d+)$/i)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !isNaN(n))
    const nextNum = (idsNums.length > 0 ? Math.max(...idsNums) : 0) + 1
    const nextRuleId = `RULE-${String(nextNum).padStart(2, '0')}`

    const newRuleWithId = { ...parsedRule, ruleId: nextRuleId }

    let updatedRules = rules
    let updatedCartRules = cartRules

    if (newRuleWithId.scope === 'cart') {
      updatedCartRules = [...cartRules, newRuleWithId]
      setCartRules(updatedCartRules)
    } else {
      updatedRules = [...rules, newRuleWithId]
      setRules(updatedRules)
    }

    // Only on Confirm: add the rule to in-memory state and re-run the engine on the current cart
    if (cartItems.length > 0) {
      const res = processCart(cartItems, updatedRules)
      setResults(res)
      const subtotal = cartTotal(res)
      setCartDiscountResult(
        updatedCartRules.length > 0
          ? applyCartDiscount(subtotal, updatedCartRules)
          : null,
      )
    }
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0
  const totalRulesCount = rules.length + cartRules.length

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={S.logoTxt}>
            O<span style={S.logoSpan}>pp</span>tra
          </div>
          <div style={S.headerSub}>Discount Engine</div>
        </div>
        <button
          type="button"
          onClick={loadSampleData}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            borderRadius: 4,
            padding: '0.35rem 0.75rem',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          title="Reset rules and cart to standard sample data"
        >
          ⚡ Reset to Sample Data
        </button>
      </div>

      <div style={S.main}>
        {/* Natural Language Rule Input */}
        <NlRuleInput onConfirmRule={handleAddNlRule} />

        {/* Upload row */}
        <div style={S.grid2}>
          {/* Rules upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={totalRulesCount > 0}
              fileName={rulesFileName}
            />
            <ErrorBanner errors={rulesErrors} />
            {totalRulesCount > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} item rule{rules.length !== 1 ? 's' : ''}
                  {cartRules.length > 0 &&
                    ` + ${cartRules.length} cart rule${cartRules.length !== 1 ? 's' : ''}`}{' '}
                  loaded
                </div>
                {rules.length > 0 && (
                  <DataTable columns={RULES_COLUMNS} rows={rules} />
                )}
                {cartRules.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <DataTable
                      columns={CART_RULES_COLUMNS}
                      rows={cartRules}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart upload */}
          <div style={S.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
              <div style={S.sectionTitle}>Cart Items</div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  type="button"
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: 11,
                    fontWeight: 700,
                    background: cartMode === 'csv' ? '#131A48' : '#f0f0f4',
                    color: cartMode === 'csv' ? '#fff' : '#666',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => setCartMode('csv')}
                >
                  CSV (.csv)
                </button>
                <button
                  type="button"
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: 11,
                    fontWeight: 700,
                    background: cartMode === 'pdf' ? '#131A48' : '#f0f0f4',
                    color: cartMode === 'pdf' ? '#fff' : '#666',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => setCartMode('pdf')}
                >
                  PDF (.pdf)
                </button>
              </div>
            </div>

            {cartMode === 'csv' ? (
              <CsvUploader
                label="cart.csv"
                description="Upload your cart CSV"
                onLoad={handleCartLoad}
                hasData={cartItems.length > 0 && cartFileName.endsWith('.csv')}
                fileName={cartFileName}
              />
            ) : (
              <PdfUploader
                onPdfSelect={handlePdfLoad}
                loading={pdfLoading}
                hasData={cartItems.length > 0 && cartFileName.endsWith('.pdf')}
                fileName={cartFileName}
              />
            )}

            <ErrorBanner errors={cartErrors} />

            {/* Prominent Warning Panel for Skipped / Malformed Rows in PDF */}
            {pdfSkipped.length > 0 && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 6,
                  padding: '0.75rem 1rem',
                  marginTop: '0.75rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <strong style={{ color: '#92400e', fontSize: 12 }}>
                    ⚠️ Partially Parsed PDF: {pdfSkipped.length} malformed row
                    {pdfSkipped.length > 1 ? 's' : ''} skipped
                  </strong>
                  {previousCart && previousCart.length > 0 && (
                    <button
                      type="button"
                      style={{
                        background: '#fff',
                        border: '1px solid #d97706',
                        color: '#d97706',
                        fontSize: 10,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                      onClick={handleRevertCart}
                    >
                      Revert Cart
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#b45309', marginBottom: 4 }}>
                  Valid items were loaded into the cart. Skipped entries:
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.2rem',
                    fontSize: 11,
                    color: '#78350f',
                  }}
                >
                  {pdfSkipped.map((s, idx) => (
                    <li key={idx} style={{ marginBottom: 2 }}>
                      <code>{s.line || '(blank)'}</code> — <em>{s.reason}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''}{' '}
                  loaded {cartFileName ? `(${cartFileName})` : ''}
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Upload both files to calculate
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Summary</div>
            <DataTable columns={RESULTS_COLUMNS} rows={results} />

            {/* Item subtotal */}
            <div style={S.totalRow}>
              <span style={S.totalLabel}>
                {cartDiscountResult ? 'Item Subtotal' : 'Cart Total'}
              </span>
              <span style={S.totalValue}>
                Rs.{cartTotal(results).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Cart discount line (applied) */}
            {cartDiscountResult && cartDiscountResult.discount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '0.4rem',
                }}
              >
                <span style={{ fontSize: 12, color: '#1e5c2c' }}>
                  {cartDiscountResult.reasoning}
                </span>
                <span
                  style={{ fontWeight: 700, fontSize: 14, color: '#1e5c2c' }}
                >
                  −Rs.{cartDiscountResult.discount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {/* Near-threshold nudge */}
            {cartDiscountResult &&
              cartDiscountResult.discount === 0 &&
              cartDiscountResult.reasoning && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '0.4rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: '#888',
                      fontStyle: 'italic',
                    }}
                  >
                    {cartDiscountResult.reasoning}
                  </span>
                </div>
              )}

            {/* Final cart total (after cart discount) */}
            {cartDiscountResult && cartDiscountResult.discount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '3px solid #131A48',
                }}
              >
                <span
                  style={{ fontWeight: 700, fontSize: 15, color: '#131A48' }}
                >
                  Final Cart Total
                </span>
                <span
                  style={{ fontWeight: 700, fontSize: 18, color: '#131A48' }}
                >
                  Rs.{cartDiscountResult.finalTotal.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
