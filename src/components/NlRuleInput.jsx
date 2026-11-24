/**
 * NlRuleInput.jsx
 *
 * Interactive component allowing users to describe discount rules in plain English.
 * Wires the natural language adapter to a confirmation card and in-memory engine update.
 */

import { useState } from 'react'
import { parseRule } from '../inputs/nlRule/nlRuleParser.js'

const EXAMPLES = [
  '20% off for Natura Casa brand, stackable with other offers',
  'Rs.100 flat discount on all Flipkart items',
  '10% off if cart value is more than Rs.5,000',
  'Give a discount for big orders',
]

const S = {
  container: {
    background: '#fff',
    border: '1px solid #CECECE',
    borderRadius: 6,
    padding: '1.2rem 1.4rem',
    marginBottom: '1.2rem',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: 14,
    color: '#131A48',
    marginBottom: '0.4rem',
    paddingBottom: 4,
    borderBottom: '2px solid #FF5800',
    display: 'inline-block',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: '0.8rem',
  },
  row: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'stretch',
    marginBottom: '0.6rem',
  },
  input: {
    flex: 1,
    padding: '0.6rem 0.8rem',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 4,
    outline: 'none',
    fontFamily: 'inherit',
  },
  btnParse: {
    background: '#131A48',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0 1.4rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
  },
  pillsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    alignItems: 'center',
    marginBottom: '0.8rem',
  },
  pillsLabel: {
    fontSize: 11,
    color: '#888',
    marginRight: 4,
  },
  pill: {
    fontSize: 11,
    padding: '0.2rem 0.6rem',
    background: '#f0f0f4',
    border: '1px solid #ddd',
    borderRadius: 12,
    cursor: 'pointer',
    color: '#333',
    transition: 'background 0.15s',
  },
  errorCard: {
    background: '#fdf3f2',
    border: '1px solid #f5c2c7',
    borderRadius: 4,
    padding: '0.8rem 1rem',
    color: '#842029',
    fontSize: 12,
    marginTop: '0.6rem',
  },
  card: {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: '1rem',
    marginTop: '0.8rem',
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  fieldBlock: {
    background: '#fff',
    padding: '0.5rem 0.6rem',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: 2,
  },
  fieldVal: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1e293b',
  },
  actions: {
    display: 'flex',
    gap: '0.6rem',
    justifyContent: 'flex-end',
  },
  btnConfirm: {
    background: '#1e5c2c',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.45rem 1.2rem',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnDiscard: {
    background: '#fff',
    color: '#64748b',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    padding: '0.45rem 1rem',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
}

export default function NlRuleInput({ onConfirmRule }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsedCandidate, setParsedCandidate] = useState(null)
  const [errorInfo, setErrorInfo] = useState(null)

  async function handleParse(ruleText) {
    const input = (ruleText !== undefined ? ruleText : text).trim()
    if (!input) return

    setLoading(true)
    setErrorInfo(null)
    setParsedCandidate(null)

    try {
      const res = await parseRule(input)
      if (res.status === 'ok') {
        setParsedCandidate(res.rule)
      } else {
        setErrorInfo({
          reason: res.reason,
          missing: res.missing || [],
        })
      }
    } catch (err) {
      setErrorInfo({
        reason: err.message || 'An unexpected error occurred while parsing.',
        missing: [],
      })
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!parsedCandidate) return
    onConfirmRule(parsedCandidate)
    setParsedCandidate(null)
    setText('')
    setErrorInfo(null)
  }

  function handleDiscard() {
    setParsedCandidate(null)
    setErrorInfo(null)
  }

  function handleSelectPill(example) {
    setText(example)
    handleParse(example)
  }

  return (
    <div style={S.container}>
      <div style={S.title}>Describe a Rule in Plain English</div>
      <div style={S.subtitle}>
        Type a natural language discount offer (brand, platform, or cart threshold).
      </div>

      <div style={S.row}>
        <input
          style={S.input}
          placeholder='e.g. "20% off for Natura Casa brand, stackable with other offers"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleParse()
          }}
          disabled={loading}
        />
        <button
          style={S.btnParse}
          onClick={() => handleParse()}
          disabled={loading || !text.trim()}
        >
          {loading ? 'Parsing...' : 'Parse Rule'}
        </button>
      </div>

      {/* Quick Example Pills */}
      <div style={S.pillsContainer}>
        <span style={S.pillsLabel}>Try examples:</span>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            type="button"
            style={S.pill}
            onClick={() => handleSelectPill(ex)}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Ambiguous / Unresolvable Error Message */}
      {errorInfo && (
        <div style={S.errorCard}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            I couldn't turn that into a rule
          </div>
          <div>{errorInfo.reason}</div>
          {errorInfo.missing && errorInfo.missing.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11 }}>
              <strong>Missing details:</strong> {errorInfo.missing.join(', ')}
            </div>
          )}
          <div style={{ marginTop: 4, fontStyle: 'italic', fontSize: 11 }}>
            Please be more specific with the discount percentage/amount, brand/platform, or cart minimum threshold.
          </div>
        </div>
      )}

      {/* Confirmation Card */}
      {parsedCandidate && (
        <div style={S.card}>
          <div style={S.cardHeader}>Parsed Rule Preview (Confirmation Required)</div>
          <div style={S.cardGrid}>
            <div style={S.fieldBlock}>
              <div style={S.fieldLabel}>Scope</div>
              <div style={S.fieldVal}>
                {parsedCandidate.scope.charAt(0).toUpperCase() + parsedCandidate.scope.slice(1)}
              </div>
            </div>

            <div style={S.fieldBlock}>
              <div style={S.fieldLabel}>Applies to</div>
              <div style={S.fieldVal}>
                {parsedCandidate.appliesTo || (parsedCandidate.scope === 'cart' ? 'Entire Cart' : '—')}
              </div>
            </div>

            <div style={S.fieldBlock}>
              <div style={S.fieldLabel}>Type</div>
              <div style={S.fieldVal}>
                {parsedCandidate.type.charAt(0).toUpperCase() + parsedCandidate.type.slice(1)}
              </div>
            </div>

            <div style={S.fieldBlock}>
              <div style={S.fieldLabel}>Value</div>
              <div style={S.fieldVal}>
                {parsedCandidate.type === 'percentage'
                  ? `${parsedCandidate.value}% off`
                  : `Rs.${parsedCandidate.value} off`}
              </div>
            </div>

            <div style={S.fieldBlock}>
              <div style={S.fieldLabel}>Stackable</div>
              <div style={S.fieldVal}>
                {parsedCandidate.stackable ? 'Yes' : 'No'}
              </div>
            </div>

            {parsedCandidate.scope === 'cart' && (
              <div style={S.fieldBlock}>
                <div style={S.fieldLabel}>Min Cart Value</div>
                <div style={S.fieldVal}>
                  Rs.{(parsedCandidate.minCartValue || parsedCandidate.minCartTotal || 0).toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>

          <div style={S.actions}>
            <button style={S.btnDiscard} onClick={handleDiscard}>
              Discard
            </button>
            <button style={S.btnConfirm} onClick={handleConfirm}>
              Confirm &amp; add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
