import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccuracy, type Accuracy } from '../api'

const KINDS = [
  { key: 'trip', label: 'System stopped', rule: (a: Accuracy) => `Caught ${a.catch_rules.trip}` },
  { key: 'step', label: 'Sudden 20% drop', rule: (a: Accuracy) => `Caught ${a.catch_rules.step_20pct}` },
  { key: 'dust', label: 'Gradual dust build-up', rule: (a: Accuracy) => `Caught ${a.catch_rules.dust}` },
] as const

export function AccuracyPage() {
  const [a, setA] = useState<Accuracy | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => { getAccuracy().then(setA).catch(() => setErr(true)) }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">How accurate is the check?</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            We hide known faults in real Indian plant data and see how many SunProof finds, without telling it where they are.
          </p>
        </div>
        <Link to="/" className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>← Back</Link>
      </header>

      {err && <div className="card p-6">Couldn't load the results. Please try again shortly.</div>}
      {!a && !err && <div className="card p-6" style={{ color: 'var(--text-secondary)' }}>Loading…</div>}

      {a && (
        <>
          <section className="card mb-4 p-5 sm:p-6">
            <h2 className="mb-1 text-lg font-semibold">Faults caught</h2>
            <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              Tested on {a.tested_on}. Thresholds were tuned on {a.tuned_on}. {a.seeds} different random fault layouts.
            </p>
            <div className="space-y-4">
              {KINDS.map((k) => {
                const r = a.by_kind[k.key]
                const pct = r.injected ? (100 * r.caught) / r.injected : 0
                return (
                  <div key={k.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="font-medium">{k.label}</span>
                      <span className="text-sm"><b>{r.caught}</b> of {r.injected} caught · {r.missed} missed</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--grid)' }}
                      role="img" aria-label={`${pct.toFixed(0)}% caught`}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--series-1)' }} />
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{k.rule(a)} · {pct.toFixed(0)}%</div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="card p-5">
              <div className="text-3xl font-bold">{(a.false_alarms.rate * 100).toFixed(2)}%</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>false alarms</div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {a.false_alarms.flagged} flagged out of {a.false_alarms.clean_inverter_days.toLocaleString('en-IN')} healthy inverter-days
              </div>
            </div>
            <div className="card p-5">
              <div className="text-3xl font-bold">{a.real_underperformers_plant_1.length}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>real underperformers spotted</div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                In the original, untouched Plant 1 data, these inverters make {a.real_underperformers_plant_1
                  .map((u) => `${Math.round((1 - u.median_vs_peers) * 100)}%`).join(' and ')} less than their neighbours under the same sun.
              </div>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-2 text-lg font-semibold">What this does and doesn't show</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <li>Data: {a.dataset}. The faults are injected by us, so this shows detection ability, not guaranteed field accuracy.</li>
              <li>These are large solar plants, not homes. Catching a stopped system is easy because output is zero. The 20% drop and dust results are the meaningful ones.</li>
              <li>{a.dust_below_5pct.injected} very slow dust cases never reached 5% loss within the test period and are not counted. {a.dust_below_5pct.flagged} were flagged.</li>
              <li>{a.plant_2_note} On its original data it flags {(a.plant_2_flag_rate_original * 100).toFixed(0)}% of days, which we report separately and do not count as accuracy.</li>
              <li>Not yet tested: real Indian rooftops and US residential systems (NREL PVDAQ). Next step.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
