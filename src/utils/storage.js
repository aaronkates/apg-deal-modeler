// Thin localStorage wrappers used by the Notes & Team sidebar and Lawyer Dashboard.
// Per-artist data is keyed by artist_id; pending deals are a separate list.

const NS = 'apg'
const k = (...parts) => [NS, ...parts].join(':')

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

// ---------- per-artist notes & team ----------
export const A_AND_R_OPTIONS  = ['Jordan Mills', 'Priya Okafor', 'Devon Chase', 'Marcus Teel', 'Simone Varga']
export const LAWYER_OPTIONS   = ['Rachel Huang', 'Tom Beckford', 'Nadia Stern']

export function loadArtistMeta(artistId) {
  return load(k('artist', artistId), {
    notes:      '',
    spotifyUrl: '',
    instagram:  '',
    tiktok:     '',
    twitter:    '',
    assignedAR:     '',
    assignedLawyer: '',
  })
}
export function saveArtistMeta(artistId, meta) {
  save(k('artist', artistId), meta)
}

// ---------- current lawyer profile (per browser) ----------
const CURRENT_LAWYER_KEY = k('lawyerCurrent')

export function loadCurrentLawyer() {
  try { return localStorage.getItem(CURRENT_LAWYER_KEY) || null } catch { return null }
}
export function saveCurrentLawyer(name) {
  try { localStorage.setItem(CURRENT_LAWYER_KEY, name) } catch { /* ignore */ }
}
export function clearCurrentLawyer() {
  try { localStorage.removeItem(CURRENT_LAWYER_KEY) } catch { /* ignore */ }
}

// ---------- pending deals to the lawyer dashboard ----------
const DEALS_KEY = k('deals')

export function loadPendingDeals() {
  return load(DEALS_KEY, [])
}
export function savePendingDeals(deals) {
  save(DEALS_KEY, deals)
}

export function appendPendingDeal(deal) {
  const list = loadPendingDeals()
  list.push({ ...deal, sentAt: new Date().toISOString(), status: 'pending', revisionNotes: '' })
  savePendingDeals(list)
  return list
}

export function updateDealById(id, patch) {
  const list = loadPendingDeals()
  const idx  = list.findIndex(d => d.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch }
    savePendingDeals(list)
  }
  return list
}
