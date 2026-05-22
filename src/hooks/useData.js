import { useState, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import { computeArtistDetailMetrics, computeRosterMetrics } from '../utils/metrics.js'

export function useData() {
  const [loading, setLoading]         = useState(true)
  const [loadingMsg, setMsg]          = useState('Loading artists…')
  const [error, setError]             = useState(null)
  const [artists, setArtists]         = useState([])
  const [byArtist, setByArtist]       = useState({})
  const [rosterMetrics, setRoster]    = useState([])
  const [dataEnd, setDataEnd]         = useState(null)

  useEffect(() => {
    function parseCSV(path, opts) {
      return new Promise((resolve, reject) => {
        Papa.parse(path, {
          header: true,
          dynamicTyping: true,
          download: true,
          skipEmptyLines: true,
          ...opts,
          complete: r => resolve(r.data),
          error:   e => reject(e),
        })
      })
    }

    async function load() {
      try {
        const artistMeta = await parseCSV('/data/artists.csv')
        artistMeta.sort((a, b) =>
          (b.trailing_12mo_avg_daily_streams ?? 0) - (a.trailing_12mo_avg_daily_streams ?? 0)
        )
        setArtists(artistMeta)

        setMsg('Loading streaming data (365 k rows)…')
        const rows = await parseCSV('/data/streaming_data.csv')

        setMsg('Processing data…')

        // Find latest date across the entire dataset — this is our "current date"
        let maxDate = ''
        for (const r of rows) {
          if (r.date && r.date > maxDate) maxDate = r.date
        }
        setDataEnd(maxDate)

        // Group by artist, then guarantee date order per artist
        const grouped = {}
        for (const r of rows) {
          if (!r.artist_id) continue
          if (!grouped[r.artist_id]) grouped[r.artist_id] = []
          grouped[r.artist_id].push(r)
        }
        Object.values(grouped).forEach(arr =>
          arr.sort((a, b) => (a.date < b.date ? -1 : 1))
        )
        setByArtist(grouped)

        // Compute raw roster metrics; scoring happens reactively in the component
        setRoster(computeRosterMetrics(grouped, artistMeta, maxDate))

        setLoading(false)
      } catch (e) {
        setError(e?.message ?? String(e))
        setLoading(false)
      }
    }

    load()
  }, [])

  const getArtistMetrics = useCallback((artistId) => {
    if (!artistId || !byArtist[artistId] || !dataEnd) return null
    return computeArtistDetailMetrics(byArtist[artistId], dataEnd)
  }, [byArtist, dataEnd])

  return { loading, loadingMsg, error, artists, rosterMetrics, dataEnd, getArtistMetrics }
}
