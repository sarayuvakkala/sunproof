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
  kw?: number
  city?: string
}

export interface TimelineEvent {
  at: string
  event: string
  note: string
}

export type IssueStatus =
  | 'sent' | 'visit_booked' | 'fixed_remotely' | 'disputed' | 'fixed'
  | 'reopened' | 'escalation_draft' | 'no_data' | 'fix_failed'

export interface Issue {
  issueId: string
  homeId: string
  status: IssueStatus
  deadlineText: string
  installerName: string
  summary: string
  timeline: TimelineEvent[]
  recovered: { kwh: number; rupees: number; co2_kg: number; by?: string } | null
  escalationDraft: string | null
  installerLink: string
  chartUrl: string
  /** Visit progress from the installer app. visitDone is null for a visit booked through the old link. */
  visit?: { date: string; time: string } | null
  visitDone?: boolean | null
  trip?: { stage: 'on_the_way' | 'arrived'; at: string } | null
  /** The 7-day check so far: one entry per day, ok = that day's output was inside the expected range. */
  checkDays?: { day: number; ok: boolean }[]
  failedDay?: number | null
  failedPct?: number | null
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
export const demoAdvanceDay = (issueId: string, manual = false) => call<{ result: string }>('/demo/advance-day', post({ issueId, manual }))
export const cleanedApi = (issueId: string, homeId: string) => call<{ ok: boolean }>(`/issues/${issueId}/cleaned`, post({ homeId }))
export const revisit = (issueId: string, homeId: string) => call<{ ok: boolean }>(`/issues/${issueId}/revisit`, post({ homeId }))
export const demoReset = () => call<{ ok: boolean }>('/demo/reset', post({}))

// Installer app (one fixed demo installer). See docs/api.md.
export interface ProJob {
  issueId: string; homeId: string; name: string; kw: number | null; city: string
  state: 'new' | 'visit' | 'check' | 'fixed' | 'closed'; overdue: boolean; status: IssueStatus
  daysLeft: number | null; deadlineText: string; pctBelow: number; weeks: number; unitsLost: number
  visit: { date: string; time: string } | null; day: number
  recovered: { kwh: number; rupees: number; co2_kg: number; by?: string } | null
  replyDays: number | null; created: string; reopened: boolean
  trip: 'on_the_way' | 'arrived' | null
  fixFailed?: boolean
}
export interface ProJobDetail extends ProJob {
  summary: string; likelyCause: string; period: { start: string; end: string }; co2Kg: number
  daily: DailyPoint[]; chartUrl: string; timeline: TimelineEvent[]; isDemo: boolean
}
export interface ProReply { action: InstallerAction; visit_date?: string; visit_time?: string; note?: string }

export const proJobs = () => call<{ installer: string; jobs: ProJob[] }>('/pro/jobs')
export const proJob = (id: string) => call<ProJobDetail>(`/pro/jobs/${id}`)
export const proRespond = (id: string, body: ProReply) =>
  call<{ ok: boolean; late?: boolean; status?: string }>(`/pro/jobs/${id}/respond`, post(body))
export const proTrip = (id: string, step: 'on_the_way' | 'arrived') => call<{ ok: boolean }>(`/pro/jobs/${id}/trip`, post({ step }))
export const proVisitDone = (id: string) => call<{ ok: boolean }>(`/pro/jobs/${id}/visit-done`, post({}))
