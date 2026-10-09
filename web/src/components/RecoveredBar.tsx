import { useEffect, useState } from 'react'
import { getRecovered, type Recovered } from '../api'
import { type Lang, T } from '../i18n'

export function RecoveredBar({ lang, refreshKey }: { lang: Lang; refreshKey: number }) {
  const [r, setR] = useState<Recovered | null>(null)
  const t = T[lang]

  useEffect(() => { getRecovered().then(setR).catch(() => {}) }, [refreshKey])

  if (!r) return null
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl px-4 py-3"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>🌱 {t.recovered}</span>
      <span className="text-lg font-bold">
        {r.kwh} {t.kwh} · ₹{r.rupees} · {r.co2_kg} kg CO₂
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.fixes} {t.fixes}</span>
    </div>
  )
}
