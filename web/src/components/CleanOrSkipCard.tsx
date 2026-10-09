import { useEffect, useState } from 'react'
import { getCleanOrSkip, type CleanOrSkip, type Scenario } from '../api'
import { type Lang, T } from '../i18n'

const SCENARIOS: Scenario[] = ['live', 'rain', 'dust']

export function CleanOrSkipCard({ homeId, lang, refreshKey, isDemo }: {
  homeId: string
  lang: Lang
  refreshKey: number
  isDemo: boolean
}) {
  const [d, setD] = useState<CleanOrSkip | null>(null)
  const [scenario, setScenario] = useState<Scenario>('live')
  const t = T[lang]

  useEffect(() => { setScenario('live'); setD(null) }, [homeId])
  useEffect(() => {
    getCleanOrSkip(homeId, isDemo ? scenario : 'live').then(setD).catch(() => {})
  }, [homeId, refreshKey, scenario, isDemo])

  if (!d) return null
  const clean = d.decision === 'clean'
  return (
    <section className="card mb-4 p-5 sm:p-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t.cleanTitle}</h2>
        <span className="rounded-full px-3 py-1 text-sm font-bold"
          style={{ background: clean ? 'var(--warning)' : 'var(--good)', color: '#0b0b0b' }}>
          {clean ? t.clean : t.skip}
        </span>
      </div>
      <p className="text-base leading-relaxed">{lang === 'hi' ? d.reason_hi : d.reason_en}</p>
      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{t.dustLoss(d.dust_loss_pct)}</p>

      {d.simulated && (
        <p className="mt-2 inline-block rounded px-2 py-1 text-xs font-bold"
          style={{ background: 'var(--demo-bg)', color: 'var(--demo-ink)' }}>{t.simulatedTag}</p>
      )}

      {isDemo && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t.scenarioLabel}:</span>
          {SCENARIOS.map((s) => (
            <button key={s} onClick={() => setScenario(s)} aria-pressed={scenario === s}
              className="rounded-md px-2.5 py-1.5 font-medium"
              style={scenario === s
                ? { background: 'var(--demo-bg)', color: 'var(--demo-ink)', outline: '2px solid var(--demo-ink)' }
                : { background: 'var(--surface-0)', border: '1px solid var(--border)' }}>
              {t.scenarios[s]}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
