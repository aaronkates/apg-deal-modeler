import React, { useState, useEffect } from 'react'
import {
  loadPendingDeals, updateDealById,
  loadCurrentLawyer, saveCurrentLawyer, clearCurrentLawyer,
  LAWYER_OPTIONS,
} from '../utils/storage.js'

const INK = '#1a1a1a'   // primary dark text on white cards

function fmtUSD(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const s   = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${s}$${(abs / 1_000).toFixed(0)}K`
  return `${s}$${abs.toFixed(0)}`
}

function StatusBadge({ status }) {
  const styles = {
    pending:  { bg: '#f0f0f0', fg: '#555555', label: 'Pending Review' },
    approved: { bg: '#e6f4ea', fg: '#1e7a35', label: 'Approved' },
    rejected: { bg: '#fce8e8', fg: '#c62828', label: 'Rejected' },
    revision: { bg: '#fff4e0', fg: '#a86b00', label: 'Revision Requested' },
  }
  const s = styles[status] ?? styles.pending
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

function TermRow({ label, value }) {
  return (
    <div className="flex justify-between text-xs py-1">
      <span style={{ color: '#666666' }}>{label}</span>
      <span className="mono font-medium" style={{ color: INK }}>{value}</span>
    </div>
  )
}

function DealCard({ deal, onApprove, onReject, onRevise }) {
  const [revising, setRevising] = useState(false)
  const [revisionText, setRevisionText] = useState(deal.revisionNotes ?? '')
  const [sent, setSent] = useState(false)

  const handleSendRevision = () => {
    onRevise(deal.id, revisionText)
    setSent(true)
    setRevising(false)
    setTimeout(() => setSent(false), 2500)
  }

  const p = deal.params

  return (
    <div className="rounded-lg p-5 shadow-sm" style={{ background: '#ffffff', border: '1px solid #e5e5e5', color: INK }}>
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: INK }}>{deal.artistName}</h3>
          <div className="text-xs mt-0.5" style={{ color: '#666666' }}>
            A&R: <span style={{ color: INK }}>{deal.assignedAR}</span> &nbsp;·&nbsp;
            Lawyer: <span style={{ color: INK }}>{deal.assignedLawyer}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#999999' }}>Sent {new Date(deal.sentAt).toLocaleString()}</div>
        </div>
        <StatusBadge status={deal.status} />
      </div>

      <div className="rounded p-3 mb-3" style={{ background: '#f7f7f7', border: '1px solid #ececec' }}>
        <div className="grid grid-cols-2 gap-x-6">
          <div>
            <TermRow label="Contract Term"      value={`${p.contractTermYears} yrs`} />
            <TermRow label="Advance"            value={fmtUSD(p.advance)} />
            <TermRow label="Marketing Budget"   value={fmtUSD(p.marketingBudget)} />
            <TermRow label="Distribution Fee"   value={`${p.distributionFee}%`} />
          </div>
          <div>
            <TermRow label="Label Split (pre)"  value={`${p.labelSplitPre}% / ${100-p.labelSplitPre}%`} />
            <TermRow label="Label Split (post)" value={`${p.labelSplitPost}% / ${100-p.labelSplitPost}%`} />
            <TermRow label="Recoupment Rate"    value={`${p.recoupmentRate}%`} />
            <TermRow label="New Releases"       value={`${p.numReleases} over ${p.deliveryWindowMonths} mo`} />
          </div>
        </div>
      </div>

      {deal.notes && (
        <div className="mb-3 rounded p-3" style={{ background: '#f7f7f7', border: '1px solid #ececec' }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#888888' }}>A&R Notes</div>
          <div className="text-sm whitespace-pre-wrap" style={{ color: INK }}>{deal.notes}</div>
        </div>
      )}

      {deal.status === 'revision' && deal.revisionNotes && !revising && (
        <div className="mb-3 rounded p-3" style={{ background: '#fff8e6', border: '1px solid #ffe4a8' }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#a86b00' }}>Revision Sent</div>
          <div className="text-sm whitespace-pre-wrap" style={{ color: '#5c3a00' }}>{deal.revisionNotes}</div>
        </div>
      )}

      {revising ? (
        <div className="space-y-2">
          <textarea
            value={revisionText}
            onChange={e => setRevisionText(e.target.value)}
            placeholder="Revision notes for the A&R team…"
            rows={3}
            className="w-full px-3 py-2 text-sm rounded focus:outline-none"
            style={{ border: '1px solid #d0d0d0', color: INK, background: '#ffffff' }}
          />
          <div className="flex gap-2">
            <button onClick={handleSendRevision} disabled={!revisionText.trim()}
              className="px-3 py-1.5 rounded text-sm font-medium text-white disabled:cursor-not-allowed"
              style={{ background: revisionText.trim() ? '#1a1a1a' : '#cccccc' }}>
              Send Revision
            </button>
            <button onClick={() => setRevising(false)}
              className="px-3 py-1.5 rounded text-sm hover:underline"
              style={{ color: '#666666' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <button onClick={() => onApprove(deal.id)}
            className="px-4 py-1.5 rounded text-sm font-medium text-white hover:opacity-90"
            style={{ background: '#1e7a35' }}>
            Approve
          </button>
          <button onClick={() => onReject(deal.id)}
            className="px-4 py-1.5 rounded text-sm font-medium text-white hover:opacity-90"
            style={{ background: '#c62828' }}>
            Reject
          </button>
          <button onClick={() => setRevising(true)}
            className="px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-300"
            style={{ background: '#e5e5e5', color: INK }}>
            Request Revision
          </button>
          {sent && <span className="text-xs" style={{ color: '#1e7a35' }}>✓ Revision sent</span>}
        </div>
      )}
    </div>
  )
}

function LawyerSelectScreen({ onSelect }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl font-semibold text-white mb-2">APG Legal — Deal Review Dashboard</h1>
        <p className="text-sm text-gray-400 mb-10">Select your profile to continue</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LAWYER_OPTIONS.map(name => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-gray-700 group-hover:bg-gray-600 flex items-center justify-center text-base font-medium text-white">
                {name.split(' ').map(p => p[0]).join('')}
              </div>
              <div className="text-sm font-medium text-white">{name}</div>
              <div className="text-xs text-gray-500">Attorney</div>
            </button>
          ))}
        </div>

        <a href="/" className="inline-block mt-10 text-xs text-gray-500 hover:text-white transition-colors">
          ← Back to Deal Modeler
        </a>
      </div>
    </div>
  )
}

export default function LawyerDashboard() {
  const [currentLawyer, setCurrentLawyer] = useState(() => loadCurrentLawyer())
  const [deals, setDeals] = useState(() => loadPendingDeals())

  useEffect(() => {
    const onStorage = () => setDeals(loadPendingDeals())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const handleSelectLawyer = (name) => {
    saveCurrentLawyer(name)
    setCurrentLawyer(name)
  }
  const handleSwitchLawyer = () => {
    clearCurrentLawyer()
    setCurrentLawyer(null)
  }

  const setStatus = (id, status) => {
    const next = updateDealById(id, { status })
    setDeals(next)
  }
  const sendRevision = (id, notes) => {
    const next = updateDealById(id, { status: 'revision', revisionNotes: notes })
    setDeals(next)
  }

  if (!currentLawyer) {
    return <LawyerSelectScreen onSelect={handleSelectLawyer} />
  }

  const myDeals = deals.filter(d => d.assignedLawyer === currentLawyer)

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-black border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">APG Legal</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Deal Review Dashboard · <span className="text-gray-300">{currentLawyer}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleSwitchLawyer} className="text-xs text-gray-400 hover:text-white transition-colors">
              Switch lawyer
            </button>
            <a href="/" className="text-xs text-gray-400 hover:text-white transition-colors">
              ← Back to Deal Modeler
            </a>
          </div>
        </div>
      </header>

      <main
        className="max-w-4xl mx-auto px-6 py-8 min-h-[calc(100vh-65px)]"
        style={{ background: '#ffffff', color: INK }}
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold" style={{ color: INK }}>
            Pending Deals ({myDeals.length})
          </h2>
          <p className="text-sm mt-1" style={{ color: '#666666' }}>
            Review and approve, reject, or request revisions on deals submitted by A&R to {currentLawyer}.
          </p>
        </div>

        {myDeals.length === 0 && (
          <div className="text-center py-16" style={{ color: '#888888' }}>
            <p className="text-sm">No deals pending review.</p>
            <p className="text-xs mt-2" style={{ color: '#aaaaaa' }}>
              Deals will appear here when A&R assigns them to you from the Notes & Team panel.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {myDeals.map(d => (
            <DealCard
              key={d.id}
              deal={d}
              onApprove={(id) => setStatus(id, 'approved')}
              onReject={(id) => setStatus(id, 'rejected')}
              onRevise={(id, notes) => sendRevision(id, notes)}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
