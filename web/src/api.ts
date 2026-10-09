const BASE = import.meta.env.VITE_API_URL as string

export type Status = 'ok' | 'shortfall' | 'trip' | 'likely_dust' | 'insufficient_data'

export interface DailyPoint {
  date: string
  p10: number
  p50: number
  p90: number
  actual: number
  flag: Exclude<Status, 'ok' | 'insufficient_data'> | null
}

export interface Verdict {
  homeId: string
  name: string | null
  isDemo: boolean
  label: string | null
  status: Status
  period: { start: string; end: string } | null
  expected_kwh: number
  expected_band_kwh: [number, number]
  actual_kwh: number
  units_lost: number
  rupees_lost: number
  co2_kg: number
  daily: DailyPoint[]
  message: { en: string; hi: string }
  assumptions: { tariff_inr_per_kwh: number; co2_kg_per_kwh: number; co2_source: string }
  activeIssue: string | null
  installerName: string | null
  replayFrom: string | null
}

export interface TimelineEvent {
  at: string
  event: string
  note: string
}

export type IssueStatus =
  | 'sent' | 'visit_booked' | 'fixed_remotely' | 'disputed' | 'fixed'
  | 'reopened' | 'escalation_draft' | 'no_data'

export interface Issue {
  issueId: string
  homeId: string
  status: IssueStatus
  deadlineText: string
  installerName: string
  summary: string
  timeline: TimelineEvent[]
  recovered: { kwh: number; rupees: number; co2_kg: number } | null
  escalationDraft: string | null
  installerLink: string
  chartUrl: string
}

export interface CleanOrSkip {
  decision: 'clean' | 'skip'
  reason_en: string
  reason_hi: string
  dust_loss_pct: number
  rupees_per_month: number
  cleaning_cost: number
  rain_expected: { date: string; mm: number } | null
  days_since_rain: number
  simulated: 'rain' | 'dust' | null
}

export interface Recovered {
  kwh: number
  rupees: number
  co2_kg: number
  fixes: number
}

export interface InstallerView {
  issueId: string
  status: IssueStatus
  deadlineText: string
  system: { kw: number; name: string | null }
  summary: string
  likelyCause: string
  unitsLost: number
  co2Kg: number
  period: { start: string; end: string }
  daily: DailyPoint[]
  chartUrl: string
  timeline: TimelineEvent[]
  isDemo: boolean
}

export interface Accuracy {
  dataset: string
  method: string
  seeds: number
  tuned_on: string
  tested_on: string
  catch_rules: { trip: string; step_20pct: string; dust: string }
  by_kind: Record<'trip' | 'step' | 'dust', { injected: number; caught: number; missed: number }>
  dust_below_5pct: { injected: number; flagged: number }
  false_alarms: { clean_inverter_days: number; flagged: number; rate: number }
  real_underperformers_plant_1: { source_key: string; median_vs_peers: number; days_below_90pct_of_peers: number }[]
  plant_2_note: string
  plant_2_flag_rate_original: number
}

export type InstallerAction = 'book_visit' | 'fixed_remotely' | 'not_system_issue'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const text = await res.text()
  let data: unknown = null
  try { data = JSON.parse(text) } catch { /* not json */ }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? text
    throw new ApiError(res.status, msg)
  }
  return data as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const getVerdict = (homeId: string) => call<Verdict>(`/homes/${homeId}/verdict`)
export const getVoice = (homeId: string, lang: 'hi' | 'en') =>
  call<{ audio_url: string; text: string }>(`/homes/${homeId}/voice`, post({ lang }))
export type Scenario = 'live' | 'rain' | 'dust'
export const getCleanOrSkip = (homeId: string, scenario: Scenario = 'live') =>
  call<CleanOrSkip>(`/homes/${homeId}/clean-or-skip${scenario === 'live' ? '' : `?scenario=${scenario}`}`)
export const getAccuracy = () => call<Accuracy>('/accuracy')
export const getRecovered = () => call<Recovered>('/recovered')

export const sendIssue = (homeId: string, approved: boolean) =>
  call<{ issueId: string }>('/issues', post({ homeId, approved }))
export const getIssue = (issueId: string, homeId: string) =>
  call<Issue>(`/issues/${issueId}?homeId=${encodeURIComponent(homeId)}`)

export const getInstallerView = (token: string) => call<InstallerView>(`/r/${token}`)
export const respond = (token: string, action: InstallerAction, note?: string) =>
  call<{ ok: boolean; late?: boolean; status?: string }>(`/r/${token}/respond`, post({ action, note }))

export const demoReplayFix = (issueId: string, outcome: 'fixed' | 'still_low') =>
  call<{ result: string }>('/demo/replay-fix', post({ issueId, outcome }))
export const demoReset = () => call<{ ok: boolean }>('/demo/reset', post({}))
