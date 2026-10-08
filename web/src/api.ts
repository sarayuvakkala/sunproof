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
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const getVerdict = (homeId: string) => call<Verdict>(`/homes/${homeId}/verdict`)

export const getVoice = (homeId: string, lang: 'hi' | 'en') =>
  call<{ audio_url: string; text: string }>(`/homes/${homeId}/voice`, {
    method: 'POST',
    body: JSON.stringify({ lang }),
  })
