import React, { useState, useEffect } from 'react'
import {
  loadArtistMeta, saveArtistMeta, appendPendingDeal,
  A_AND_R_OPTIONS, LAWYER_OPTIONS,
} from '../utils/storage.js'

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-apg-bg border border-gray-800 rounded-lg px-3 py-2 text-sm text-white
                   placeholder-gray-700 focus:outline-none focus:border-apg-red focus:ring-1 focus:ring-apg-red/40 mono"
      />
    </div>
  )
}

function Select({ label, value, options, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-apg-bg border border-gray-800 rounded-lg px-3 py-2 text-sm text-white
                   focus:outline-none focus:border-apg-red focus:ring-1 focus:ring-apg-red/40 appearance-none cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function NotesSidebar({ open, onClose, artist, params }) {
  const [meta, setMeta] = useState(() => loadArtistMeta(artist?.artist_id))
  const [toast, setToast] = useState(null)

  // Load fresh meta when artist changes or panel opens
  useEffect(() => {
    if (artist?.artist_id) setMeta(loadArtistMeta(artist.artist_id))
  }, [artist?.artist_id])

  // Persist on any change
  useEffect(() => {
    if (artist?.artist_id) saveArtistMeta(artist.artist_id, meta)
  }, [meta, artist?.artist_id])

  const update = (k, v) => setMeta(m => ({ ...m, [k]: v }))

  const sendToLawyer = () => {
    if (!meta.assignedLawyer || !artist) return
    appendPendingDeal({
      id: `${artist.artist_id}-${Date.now()}`,
      artistId:       artist.artist_id,
      artistName:     artist.artist_name,
      assignedAR:     meta.assignedAR || 'Unassigned',
      assignedLawyer: meta.assignedLawyer,
      notes:          meta.notes,
      params:         { ...params },
    })
    setToast(`Deal sent to ${meta.assignedLawyer} for review.`)
    setTimeout(() => setToast(null), 3500)
  }

  // Backdrop + slide-in panel
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 transition-opacity z-30 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-apg-surface border-l border-gray-800
                    shadow-2xl z-40 transform transition-transform overflow-y-auto ${
                      open ? 'translate-x-0' : 'translate-x-full'
                    }`}
        style={{ borderLeft: '1px solid #2a2a2a' }}
      >
        <div className="sticky top-0 bg-apg-surface border-b border-gray-800 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-sm font-medium text-white">Notes & Team</h3>
            <p className="text-xs text-gray-500 mt-0.5">{artist?.artist_name ?? 'No artist selected'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {!artist && (
          <div className="p-5 text-sm text-gray-500">Select an artist to start taking notes.</div>
        )}

        {artist && (
          <div className="p-5 space-y-5">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">A&R Notes</label>
              <textarea
                value={meta.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="Add internal notes about this artist…"
                rows={6}
                className="w-full bg-apg-bg border border-gray-800 rounded-lg px-3 py-2 text-sm text-white
                           placeholder-gray-700 focus:outline-none focus:border-apg-red focus:ring-1 focus:ring-apg-red/40 resize-y"
              />
              <p className="text-xs text-gray-600 mt-1">Saved automatically · keyed by artist</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-gray-500">Social Media</h4>
              <Field label="Spotify URL"     value={meta.spotifyUrl} onChange={v => update('spotifyUrl', v)} placeholder="https://open.spotify.com/artist/…" type="url" />
              <Field label="Instagram"       value={meta.instagram}  onChange={v => update('instagram', v)}  placeholder="@handle" />
              <Field label="TikTok"          value={meta.tiktok}     onChange={v => update('tiktok', v)}     placeholder="@handle" />
              <Field label="Twitter / X"     value={meta.twitter}    onChange={v => update('twitter', v)}    placeholder="@handle" />
            </div>

            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-gray-500">Team</h4>
              <Select label="A&R"     value={meta.assignedAR}     options={A_AND_R_OPTIONS}  onChange={v => update('assignedAR', v)}     placeholder="— unassigned —" />
              <Select label="Lawyer"  value={meta.assignedLawyer} options={LAWYER_OPTIONS}   onChange={v => update('assignedLawyer', v)} placeholder="— unassigned —" />
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-800">
              <button
                onClick={sendToLawyer}
                disabled={!meta.assignedLawyer}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  meta.assignedLawyer
                    ? 'bg-apg-red hover:bg-apg-red/90 text-white'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                Send to Lawyer
              </button>
              {!meta.assignedLawyer && (
                <p className="text-xs text-gray-600">Assign a lawyer above to enable.</p>
              )}
              {toast && (
                <p className="text-xs text-apg-green mt-2">✓ {toast}</p>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
