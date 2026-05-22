import React, { useState, useMemo, useEffect } from 'react'
import { useData } from './hooks/useData.js'
import { DEFAULT_PARAMS, suggestDealDefaults, cascadeLinkedParams } from './utils/dealModel.js'
import ArtistSelector from './components/ArtistSelector.jsx'
import KeyMetrics from './components/KeyMetrics.jsx'
import TrajectoryChart from './components/TrajectoryChart.jsx'
import DealParameters from './components/DealParameters.jsx'
import ScenarioTabs from './components/ScenarioTabs.jsx'
import RosterRecommendation from './components/RosterRecommendation.jsx'
import NotesSidebar from './components/NotesSidebar.jsx'
import LawyerDashboard from './components/LawyerDashboard.jsx'

function LoadingScreen({ msg }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-apg-bg">
      <div className="w-8 h-8 border-2 border-apg-red border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">{msg}</p>
      <p className="text-xs text-gray-600">Large dataset — this takes ~5 s on first load</p>
    </div>
  )
}

function ErrorScreen({ msg }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-apg-bg">
      <p className="text-apg-red text-sm">Failed to load data</p>
      <p className="text-gray-500 text-xs mono max-w-sm text-center">{msg}</p>
      <p className="text-gray-600 text-xs mt-2">Ensure /public/data/artists.csv and streaming_data.csv are present, then refresh.</p>
    </div>
  )
}

const NAV_TABS = [
  { id: 'artist', label: 'Artist Deal Modeler' },
  { id: 'roster', label: 'Roster Recommendation' },
]

function MainApp() {
  const { loading, loadingMsg, error, artists, rosterMetrics, getArtistMetrics } = useData()
  const [view, setView]             = useState('artist')
  const [selectedId, setSelected]   = useState(null)
  const [params, setParams]         = useState(DEFAULT_PARAMS)
  const [linked, setLinked]         = useState(false)
  const [notesOpen, setNotesOpen]   = useState(false)

  const artistMetrics = useMemo(
    () => (selectedId ? getArtistMetrics(selectedId) : null),
    [selectedId, getArtistMetrics]
  )

  useEffect(() => {
    if (!artistMetrics) return
    const tiered = suggestDealDefaults(artistMetrics)
    setParams(prev => ({
      ...prev,
      contractTermYears: tiered.contractTermYears,
      advance:           tiered.advance,
      marketingBudget:   tiered.marketingBudget,
    }))
  }, [selectedId, artistMetrics])

  const selectedArtist = artists.find(a => a.artist_id === selectedId)

  const handleParamChange = (key, value) => {
    setParams(prev => linked
      ? cascadeLinkedParams(prev, key, value, artistMetrics)
      : { ...prev, [key]: value }
    )
  }

  if (loading) return <LoadingScreen msg={loadingMsg} />
  if (error)   return <ErrorScreen msg={error} />

  const handleRosterSelect = (id) => {
    setSelected(id)
    setView('artist')
  }

  return (
    <div className="min-h-screen bg-apg-bg text-white">
      <header className="border-b border-gray-800 bg-apg-bg/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-apg-red flex items-center justify-center text-xs font-bold">A</div>
            <div>
              <span className="text-sm font-semibold text-white">APG Music</span>
              <span className="text-gray-500 text-sm"> · Master Rights Deal Modeler</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-0.5">
              {NAV_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                    view === t.id
                      ? 'bg-apg-red/15 text-apg-red font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-apg-surface'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {view === 'artist' && selectedId && (
              <button
                onClick={() => setNotesOpen(true)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors flex items-center gap-1.5"
                title="Open notes & team panel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Notes & Team
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-5">
        {view === 'artist' && (
          <>
            <div className="bg-apg-surface border border-gray-800 rounded-xl p-4">
              <ArtistSelector
                artists={artists}
                selectedId={selectedId}
                onChange={setSelected}
              />
            </div>

            {!selectedId && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="text-4xl">🎵</div>
                <p className="text-gray-400 text-sm">Select an artist above to begin modeling a deal</p>
                <p className="text-gray-600 text-xs">
                  {artists.length} artists loaded · sorted by trailing 12-month daily streams
                </p>
                <button
                  onClick={() => setView('roster')}
                  className="mt-2 text-gray-400 text-xs hover:text-white underline underline-offset-2"
                >
                  Not sure? View roster recommendations →
                </button>
              </div>
            )}

            {selectedId && artistMetrics && (
              <>
                <KeyMetrics metrics={artistMetrics} artist={selectedArtist} />
                <TrajectoryChart
                  trajectoryData={artistMetrics.trajectoryData}
                  weeklyStreams={artistMetrics.weeklyStreams}
                />
                <DealParameters
                  params={params}
                  onChange={handleParamChange}
                  linked={linked}
                  onToggleLinked={() => setLinked(v => !v)}
                />
                <div className="bg-apg-surface border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-medium text-white mb-4">Scenario Analysis</h3>
                  <ScenarioTabs artistMetrics={artistMetrics} params={params} />
                </div>
              </>
            )}

            {selectedId && !artistMetrics && (
              <p className="text-gray-500 text-sm py-8 text-center">No streaming data found for this artist.</p>
            )}
          </>
        )}

        {view === 'roster' && (
          <RosterRecommendation rosterMetrics={rosterMetrics} onSelectArtist={handleRosterSelect} />
        )}
      </main>

      <footer className="border-t border-gray-800/50 mt-12 py-4 px-6">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between text-xs text-gray-700">
          <span>APG Music · Deal Modeler · Royalty rate $0.0035/stream · All figures USD · Synthetic data</span>
          <a href="/lawyer" className="text-gray-500 hover:text-white transition-colors">Lawyer Dashboard →</a>
        </div>
      </footer>

      <NotesSidebar
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        artist={selectedArtist}
        params={params}
      />
    </div>
  )
}

export default function App() {
  // Pathname-based routing — vercel.json rewrite handles refresh in prod; Vite serves index.html for unknown paths in dev
  const [pathname, setPathname] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  )
  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (pathname === '/lawyer') {
    return <LawyerDashboard />
  }
  return <MainApp />
}
