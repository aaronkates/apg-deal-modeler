import React from 'react'

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function ArtistSelector({ artists, selectedId, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs uppercase tracking-widest text-gray-400 shrink-0">Artist</label>
      <div className="relative flex-1 max-w-sm">
        <select
          value={selectedId ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="w-full appearance-none bg-apg-bg border border-gray-700 rounded-lg px-4 py-2.5
                     text-white text-sm focus:outline-none focus:ring-1 focus:ring-apg-red
                     focus:border-apg-red cursor-pointer pr-9"
        >
          <option value="">— select an artist —</option>
          {artists.map(a => (
            <option key={a.artist_id} value={a.artist_id}>
              {a.artist_name} · {fmt(a.trailing_12mo_avg_daily_streams)}/day · {a.genre}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {selectedId && (
        <div className="text-xs text-gray-500">
          {artists.find(a => a.artist_id === selectedId)?.primary_country}
          {' · '}
          {artists.find(a => a.artist_id === selectedId)?.genre}
        </div>
      )}
    </div>
  )
}
