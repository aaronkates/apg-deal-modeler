const ROYALTY_RATE = 0.0035

// Catalog growth rate decays by half every N months — prevents indefinite compounding
// of an artist's recent growth into multi-year projections.
const GROWTH_HALF_LIFE_MONTHS = 18

// ROI above this threshold triggers a warning in the UI
export const ROI_WARNING_THRESHOLD = 500

export const DEFAULT_PARAMS = {
  contractTermYears:     3,
  advance:               500_000,
  marketingBudget:       200_000,
  distributionFee:       20,    // %
  labelSplitPre:         80,    // label % pre-recoupment
  labelSplitPost:        50,    // label % post-recoupment
  recoupmentRate:        100,   // % of artist royalties applied to recoupment
  costOfCapital:         8,     // annual %
  numReleases:           3,
  deliveryWindowMonths:  24,
  frontlinePeakMultiplier: 1.5, // peak streams in release month, as multiple of daily run rate × 30
  monthlyDecayRate:      30,    // % decay per month on frontline release streams
}

// Linear interpolation with clamping at the anchor points
function lerpClamped(x, x0, x1, y0, y1) {
  if (x <= x0) return y0
  if (x >= x1) return y1
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
}

// Scenario multipliers scale with the artist's tier.
// Smaller artists have higher upside variance (3.0× best) AND deeper downside risk
// (0.3× worst — no established floor). Larger artists have less upside but a more
// resilient downside (0.7× worst — catalog provides a floor). Anchors at 100K and 1M daily streams.
export function calcScenarioMultipliers(dailyStreams = 0) {
  const best  = lerpClamped(dailyStreams, 100_000, 1_000_000, 3.0, 2.0)
  const worst = lerpClamped(dailyStreams, 100_000, 1_000_000, 0.3, 0.7)
  return { best, base: 1.0, worst }
}

// Confidence band derived from the same multipliers — wider for more uncertain scenarios.
// Best band = (best − 1) × 0.5 → preserves the legacy 15% at the legacy 1.3× anchor.
// Worst band = (1 − worst) → preserves the legacy 30% at the legacy 0.7× anchor.
export function calcScenarioBands(multipliers) {
  return {
    best:  (multipliers.best  - 1) * 0.5,
    base:  0.15,
    worst: (1 - multipliers.worst),
  }
}

// Round to a clean number for default-advance display
export function roundToNice(n) {
  if (n < 50_000)    return Math.max(10_000, Math.round(n / 5_000)   * 5_000)
  if (n < 500_000)   return Math.round(n / 25_000)  * 25_000
  if (n < 5_000_000) return Math.round(n / 100_000) * 100_000
  return Math.round(n / 500_000) * 500_000
}

function tierContractTerm(dailyStreams) {
  if (dailyStreams >= 2_000_000) return 5
  if (dailyStreams >=   500_000) return 4
  if (dailyStreams >=    50_000) return 3
  return 2
}

function calcAnnualRoyalty(artistMetrics, distFeePct, labelSplitPrePct) {
  const annualGross  = artistMetrics.trailing12mAvgDaily * 365 * ROYALTY_RATE
  const artistShare  = (100 - labelSplitPrePct) / 100
  return annualGross * (1 - distFeePct / 100) * artistShare
}

export function suggestDealDefaults(artistMetrics) {
  if (!artistMetrics?.trailing12mAvgDaily) return { ...DEFAULT_PARAMS }
  const contractTermYears = tierContractTerm(artistMetrics.trailing12mAvgDaily)
  const annualRoyalty     = calcAnnualRoyalty(artistMetrics, DEFAULT_PARAMS.distributionFee, DEFAULT_PARAMS.labelSplitPre)
  const advance           = roundToNice(annualRoyalty * contractTermYears * 0.6)
  const marketingBudget   = roundToNice(advance * 0.4)
  return { ...DEFAULT_PARAMS, contractTermYears, advance, marketingBudget }
}

// When the user changes one field with link mode on, cascade to dependent fields.
// - contractTermYears → advance, marketingBudget, deliveryWindowMonths
// - advance           → marketingBudget
export function cascadeLinkedParams(prev, changedKey, newValue, artistMetrics) {
  const next = { ...prev, [changedKey]: newValue }

  if (changedKey === 'contractTermYears' && artistMetrics) {
    const annualRoyalty = calcAnnualRoyalty(artistMetrics, next.distributionFee, next.labelSplitPre)
    next.advance         = roundToNice(annualRoyalty * newValue * 0.6)
    next.marketingBudget = roundToNice(next.advance * 0.4)
    // Scale delivery window proportionally; cap at the new term in months
    const oldTerm   = prev.contractTermYears || newValue
    const scaled    = Math.round(prev.deliveryWindowMonths / oldTerm * newValue)
    next.deliveryWindowMonths = Math.max(1, Math.min(scaled, newValue * 12))
  }

  if (changedKey === 'advance') {
    next.marketingBudget = roundToNice(newValue * 0.4)
  }

  return next
}

export function calculateDeal(artistMetrics, params, scenario = 'base') {
  const multipliers = calcScenarioMultipliers(artistMetrics?.trailing12mAvgDaily ?? 0)
  const bands       = calcScenarioBands(multipliers)
  const multiplier  = multipliers[scenario]
  const bandPct     = bands[scenario]

  const months       = params.contractTermYears * 12
  const monthlyCoC   = Math.pow(1 + params.costOfCapital / 100, 1 / 12) - 1

  const releaseMonths = Array.from({ length: params.numReleases }, (_, i) =>
    Math.ceil(((i + 1) * params.deliveryWindowMonths) / params.numReleases)
  )

  const dailyBase         = artistMetrics.trailing12mAvgDaily * multiplier
  const catalogFrac       = artistMetrics.catalogFraction
  const catalogMonthlyBase = dailyBase * 30 * catalogFrac
  const growthRate        = (artistMetrics.avgMonthlyGrowthRate ?? 0) / 100
  const releasePeak       = dailyBase * 30 * params.frontlinePeakMultiplier

  let outstanding     = params.advance + params.marketingBudget
  let recoupmentMonth = null
  let breakEvenMonth  = null
  let cumulative      = -params.advance
  let cumulativeUpper = -params.advance
  let cumulativeLower = -params.advance
  let catalogRunRate  = catalogMonthlyBase

  const cashFlows = []

  for (let t = 1; t <= months; t++) {
    const effectiveGrowth = growthRate * Math.pow(0.5, t / GROWTH_HALF_LIFE_MONTHS)
    catalogRunRate *= (1 + effectiveGrowth)
    const catalogStreams = catalogRunRate

    let newReleaseStreams = 0
    for (const rm of releaseMonths) {
      if (t >= rm) {
        const delta = t - rm
        newReleaseStreams += releasePeak * Math.pow(1 - params.monthlyDecayRate / 100, delta)
      }
    }

    const totalStreams  = catalogStreams + newReleaseStreams
    const grossRevenue  = totalStreams * ROYALTY_RATE
    const netRevenue    = grossRevenue * (1 - params.distributionFee / 100)

    const isRecouped   = recoupmentMonth !== null
    const labelSplit   = (isRecouped ? params.labelSplitPost : params.labelSplitPre) / 100
    const artistSplit  = 1 - labelSplit

    const labelGross   = netRevenue * labelSplit
    const artistRoyalty = netRevenue * artistSplit

    const marketingCost = t <= params.deliveryWindowMonths
      ? params.marketingBudget / params.deliveryWindowMonths
      : 0
    const cocCost = outstanding > 0 ? outstanding * monthlyCoC : 0

    if (outstanding > 0) {
      outstanding -= artistRoyalty * (params.recoupmentRate / 100)
      if (outstanding <= 0 && recoupmentMonth === null) {
        outstanding = 0
        recoupmentMonth = t
      }
      outstanding = Math.max(0, outstanding)
    }

    const labelNet = labelGross - marketingCost - cocCost
    cumulative += labelNet
    if (cumulative >= 0 && breakEvenMonth === null) breakEvenMonth = t

    const bandAmount = labelGross * bandPct
    cumulativeUpper += labelNet + bandAmount
    cumulativeLower += labelNet - bandAmount

    cashFlows.push({
      month: t,
      catalogStreams:   Math.round(catalogStreams),
      newReleaseStreams: Math.round(newReleaseStreams),
      totalStreams:     Math.round(totalStreams),
      grossRevenue, netRevenue, labelGross, artistRoyalty,
      marketingCost, cocCost, labelNet,
      cumulative, cumulativeUpper, cumulativeLower,
      outstandingBalance: outstanding, isRecouped,
      catalogRevenue:     totalStreams > 0 ? (catalogStreams / totalStreams)     * labelGross : 0,
      newReleaseRevenue:  totalStreams > 0 ? (newReleaseStreams / totalStreams)  * labelGross : 0,
    })
  }

  const totalLabelGross = cashFlows.reduce((s, m) => s + m.labelGross, 0)
  const totalCosts      = params.advance + params.marketingBudget + cashFlows.reduce((s, m) => s + m.cocCost, 0)
  const totalLabelProfit = totalLabelGross - totalCosts
  const totalInvestment  = params.advance + params.marketingBudget
  const totalROI         = totalInvestment > 0 ? (totalLabelProfit / totalInvestment) * 100 : 0

  return {
    cashFlows, breakEvenMonth, recoupmentMonth, totalROI,
    totalLabelProfit, totalLabelGross, totalCosts, totalInvestment,
    multiplier, bandPct, multipliers, bands,
  }
}
