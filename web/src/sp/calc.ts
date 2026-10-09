import type { CleanOrSkip, Verdict } from '../api'
import type { Cl } from './state'

export const NCL = 'Estimated from the dust loss, not metered. Your next days of output will confirm it.'

export interface CleanResult {
  k: string
  t: string
  n: string
  /** 1 = counted, 2 = rain in progress, 0 = waiting */
  g: 0 | 1 | 2
  u: number
  r: number
  c: number
}

export const r1 = (v: number) => Math.round(v * 10) / 10

export function daysUntil(iso: string): number {
  const d = new Date(`${iso}T00:00:00`)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(1, Math.round((d.getTime() - today.getTime()) / 86_400_000))
}

/** Rupees lost to dust until the next washing rain (or over a month when none is due). */
export function dustLossRs(d: CleanOrSkip): number {
  if (!d.rain_expected) return Math.round(d.rupees_per_month)
  return Math.round((d.rupees_per_month * daysUntil(d.rain_expected.date)) / 30)
}

/** Estimated energy recovered by cleaning, or by waiting for rain. Estimates, not measurements. */
export function cleanResult(cl: Cl, d: CleanOrSkip | null, v: Verdict | null): CleanResult | null {
  if (!cl || !d) return null
  const tariff = v?.assumptions.tariff_inr_per_kwh ?? 8
  const co2f = v?.assumptions.co2_kg_per_kwh ?? 0.705
  const raining = d.rain_expected !== null
  const make = (rs: number) => {
    const u = r1(rs / tariff)
    return { u, r: rs, c: r1(u * co2f) }
  }
  if (cl === 'raining') return { k: 'RAIN IS FALLING', t: 'Washing your panels…', n: 'The rain is washing the dust off. Hang on a few seconds.', g: 2, u: 0, r: 0, c: 0 }
  if (cl === 'clean') {
    const x = make(dustLossRs(d))
    return raining
      ? { k: 'PANELS CLEANED', t: 'Clean, but rain was due', n: `Rain would have washed them for free, so the ₹${Math.round(d.cleaning_cost)} cleaning was not needed. ${NCL}`, g: 1, ...x }
      : { k: 'PANELS CLEANED', t: 'Back to full output', n: `Estimated gain over the next month, now that dust has stopped costing you. ${NCL}`, g: 1, ...x }
  }
  if (raining) {
    return { k: 'RAIN DID THE JOB', t: 'Washed for free', n: `Dust loss avoided, and the ₹${Math.round(d.cleaning_cost)} cleaning saved. ${NCL}`, g: 1, ...make(dustLossRs(d)) }
  }
  return { k: 'WAITING FOR RAIN', t: 'No rain in the forecast', n: `Dust keeps costing about ₹${Math.round(d.rupees_per_month)} a month until it rains. You can still clean any time.`, g: 0, u: 0, r: 0, c: 0 }
}

export const fmtDate = (iso: string, lang: 'en' | 'hi') =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })

export const fmtTime = (iso: string, lang: 'en' | 'hi') =>
  new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const weekday = (iso: string, lang: 'en' | 'hi') =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short' })
