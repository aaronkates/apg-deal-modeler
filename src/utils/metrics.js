// Sliding-window mean; fills with partial window at the start
export function rollingMean(arr, window) {
  const out = new Array(arr.length)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= window) sum -= arr[i - window]
    out[i] = sum / Math.min(i + 1, window)
  }
  return out
}

export function formatMonthLabel(key) {
  const [y, m] = key.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(m, 10) - 1]} '${y.slice(2)}`
}

function dateSubMonths(isoDate, months) {
  const d = new Date(isoDate)
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

// Aggregate the last 24 months of daily streaming rows into weekly buckets (Sunday-start).
// Returns: [{ weekKey, weekLabel, catalog, newRelease, total }, …]
export function computeWeeklyStreams(rows, dataEnd) {
  if (!rows || rows.length === 0) return []
  const cutoff24m = dateSubMonths(dataEnd, 24)
  const last24m = rows.filter(r => r.date >= cutoff24m)

  const weeks = []
  let current = null
  for (const r of last24m) {
    const d = new Date(r.date + 'T00:00:00Z')
    const dow = d.getUTCDay()
    const ws  = new Date(d)
    ws.setUTCDate(d.getUTCDate() - dow)
    const weekKey = ws.toISOString().slice(0, 10)
    if (!current || current.weekKey !== weekKey) {
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      current = {
        weekKey,
        weekLabel: `${monthNames[ws.getUTCMonth()]} ${ws.getUTCDate()}`,
        catalog: 0, newRelease: 0, total: 0,
      }
      weeks.push(current)
    }
    current.catalog    += r.catalog_streams
    current.newRelease += r.new_release_streams
    current.total      += r.streams
  }
  return weeks
}

export const DEFAULT_WEIGHTS = { growth: 40, stability: 30, listener: 20, ratio: 10 }

// Full per-artist metrics used in the deal modeler view
export function computeArtistDetailMetrics(rows, dataEnd) {
  if (!rows || rows.length === 0) return null

  const cutoff12m = dateSubMonths(dataEnd, 12)
  const cutoff24m = dateSubMonths(dataEnd, 24)

  const last12m = rows.filter(r => r.date >= cutoff12m)
  const last24m = rows.filter(r => r.date >= cutoff24m)

  const trailing12mAvgDaily = last12m.length > 0
    ? Math.round(last12m.reduce((s, r) => s + r.streams, 0) / last12m.length)
    : 0

  const monthlyListeners = rows[rows.length - 1]?.monthly_listeners ?? 0

  const totalStreams12m  = last12m.reduce((s, r) => s + r.streams, 0)
  const catalogStreams12m = last12m.reduce((s, r) => s + r.catalog_streams, 0)
  const catalogFraction  = totalStreams12m > 0 ? catalogStreams12m / totalStreams12m : 0.7

  const smoothed = rollingMean(last24m.map(r => r.catalog_streams), 30)

  const monthMap = {}
  last24m.forEach((r, i) => {
    const key = r.date.slice(0, 7)
    if (!monthMap[key]) monthMap[key] = []
    monthMap[key].push(smoothed[i])
  })

  const sortedKeys = Object.keys(monthMap).sort()
  const monthly = sortedKeys.map(key => ({
    monthKey: key,
    monthLabel: formatMonthLabel(key),
    avgStreams: monthMap[key].reduce((s, v) => s + v, 0) / monthMap[key].length,
  }))

  const trajectoryData = monthly.map((m, i) => {
    if (i === 0) return { ...m, growthPct: null }
    const prev = monthly[i - 1].avgStreams
    return { ...m, growthPct: prev > 0 ? ((m.avgStreams - prev) / prev) * 100 : 0 }
  }).filter(m => m.growthPct !== null)

  // Average monthly growth across the full 24-month trajectory (matches case-study spec)
  const last24Growth = trajectoryData.slice(-24).map(m => m.growthPct)
  const avgMonthlyGrowthRate = last24Growth.length > 0
    ? last24Growth.reduce((s, v) => s + v, 0) / last24Growth.length
    : 0

  const listenersStart = last12m[0]?.monthly_listeners ?? monthlyListeners
  const listenersTrend = listenersStart > 0
    ? ((monthlyListeners - listenersStart) / listenersStart) * 100
    : 0

  return {
    trailing12mAvgDaily,
    monthlyListeners,
    catalogFraction,
    trajectoryData,
    weeklyStreams: computeWeeklyStreams(rows, dataEnd),
    avgMonthlyGrowthRate,
    listenersTrend,
  }
}

// Lightweight metrics for all artists (used in roster scoring)
export function computeRosterMetrics(byArtist, artists, dataEnd) {
  const cutoff24m = dateSubMonths(dataEnd, 24)
  const cutoff12m = dateSubMonths(dataEnd, 12)

  return artists.map(artist => {
    const rows = byArtist[artist.artist_id] || []
    if (rows.length === 0) return { ...artist, _valid: false }

    const last24m = rows.filter(r => r.date >= cutoff24m)
    const last12m = rows.filter(r => r.date >= cutoff12m)

    const monthMap = {}
    for (const r of last24m) {
      const k = r.date.slice(0, 7)
      if (!monthMap[k]) monthMap[k] = { catalog: 0, total: 0 }
      monthMap[k].catalog += r.catalog_streams
      monthMap[k].total   += r.streams
    }
    const keys = Object.keys(monthMap).sort()
    const monthlyCatalog = keys.map(k => monthMap[k].catalog)

    const factors = []
    for (let i = 1; i < monthlyCatalog.length; i++) {
      if (monthlyCatalog[i - 1] > 0) {
        factors.push(monthlyCatalog[i] / monthlyCatalog[i - 1])
      }
    }
    const geoMean = factors.length > 0
      ? Math.pow(factors.reduce((a, b) => a * b, 1), 1 / factors.length)
      : 1
    const avgMonthlyGrowthPct = (geoMean - 1) * 100

    const mean = monthlyCatalog.reduce((s, v) => s + v, 0) / (monthlyCatalog.length || 1)
    const variance = monthlyCatalog.reduce((s, v) => s + (v - mean) ** 2, 0) / (monthlyCatalog.length || 1)
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1

    const firstRow = last12m[0]
    const lastRow  = last12m[last12m.length - 1]
    const listenersTrend = firstRow?.monthly_listeners > 0
      ? ((lastRow.monthly_listeners - firstRow.monthly_listeners) / firstRow.monthly_listeners) * 100
      : 0

    const total12m   = last12m.reduce((s, r) => s + r.streams, 0)
    const catalog12m = last12m.reduce((s, r) => s + r.catalog_streams, 0)
    const catalogRatio = total12m > 0 ? catalog12m / total12m : 0.7

    return {
      artist_id:    artist.artist_id,
      artist_name:  artist.artist_name,
      genre:        artist.genre,
      primary_country: artist.primary_country,
      trailing12mAvgDaily: artist.trailing_12mo_avg_daily_streams,
      monthlyListeners: lastRow?.monthly_listeners ?? 0,
      avgMonthlyGrowthPct,
      cv,
      listenersTrend,
      catalogRatio,
      _valid: true,
    }
  })
}

// Accepts weight object with keys: growth, stability, listener, ratio (each 0-100, summing to ~100)
export function scoreArtists(metrics, weights = DEFAULT_WEIGHTS) {
  const valid = metrics.filter(m => m._valid)
  if (valid.length === 0) return []

  const normalize = (values, invert = false) => {
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (max === min) return values.map(() => 50)
    return values.map(v => {
      const n = ((v - min) / (max - min)) * 100
      return invert ? 100 - n : n
    })
  }

  const growthNorm    = normalize(valid.map(m => m.avgMonthlyGrowthPct))
  const stabilityNorm = normalize(valid.map(m => m.cv), true)
  const listenerNorm  = normalize(valid.map(m => m.listenersTrend))

  const ratioScores = valid.map(m => {
    const pct = m.catalogRatio * 100
    if (pct >= 65 && pct <= 85) return 100
    if (pct < 65) return (pct / 65) * 100
    return Math.max(0, 100 - (pct - 85) * 4)
  })

  const wg = weights.growth    / 100
  const ws = weights.stability / 100
  const wl = weights.listener  / 100
  const wr = weights.ratio     / 100

  return valid.map((m, i) => ({
    ...m,
    growthScore:    growthNorm[i],
    stabilityScore: stabilityNorm[i],
    listenerScore:  listenerNorm[i],
    ratioScore:     ratioScores[i],
    totalScore:
      wg * growthNorm[i] +
      ws * stabilityNorm[i] +
      wl * listenerNorm[i] +
      wr * ratioScores[i],
  })).sort((a, b) => b.totalScore - a.totalScore)
}
