import { useEffect, useRef, useState } from 'react'
import { getVerdict, getVoice, type Verdict } from '../api'
import { DailyChart } from '../components/DailyChart'
import { STATUS, type Lang, T } from '../i18n'

const HOMES = [
  { id: 'demo-sharma', hi: 'शर्मा जी (डेमो)', en: 'Sharma ji (demo)' },
  { id: 'demo', hi: 'डेमो घर', en: 'Demo home' },
]

const inr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

export function Home() {
  const [lang, setLang] = useState<Lang>('hi')
  const [homeId, setHomeId] = useState(HOMES[0].id)
  const [v, setV] = useState<Verdict | null>(null)
  const [err, setErr] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const t = T[lang]

  useEffect(() => {
    setV(null)
    setErr(false)
    getVerdict(homeId).then(setV).catch(() => setErr(true))
  }, [homeId])

  async function listen() {
    setVoiceBusy(true)
    try {
      const { audio_url } = await getVoice(homeId, lang)
      if (audio.current) {
        audio.current.src = audio_url
        await audio.current.play()
      }
    } finally {
      setVoiceBusy(false)
    }
  }

  const s = v ? STATUS[v.status] : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SunProof</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={homeId}
            onChange={(e) => setHomeId(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
            aria-label="Home"
          >
            {HOMES.map((h) => <option key={h.id} value={h.id}>{h[lang]}</option>)}
          </select>
          <button
            onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
            className="rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
          >
            {lang === 'hi' ? 'English' : 'हिंदी'}
          </button>
        </div>
      </header>

      {v?.isDemo && (
        <div className="mb-4 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--demo-bg)', color: 'var(--demo-ink)' }}>
          {t.demo}
        </div>
      )}

      {err && <div className="card p-6">{t.error}</div>}
      {!v && !err && <div className="card p-6" style={{ color: 'var(--text-secondary)' }}>{t.loading}</div>}

      {v && s && (
        <>
          <section className="card mb-4 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: `var(--${s.tone})`, color: '#0b0b0b' }}
                aria-hidden
              >
                {s.icon}
              </span>
              <span className="text-lg font-semibold">{s[lang]}</span>
            </div>
            <p className="mb-4 text-base leading-relaxed sm:text-lg">{v.message[lang]}</p>
            <button
              onClick={listen}
              disabled={voiceBusy}
              className="rounded-xl px-5 py-3 text-base font-semibold disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              🔊 {voiceBusy ? t.loadingVoice : lang === 'hi' ? t.listen : 'Listen in English'}
            </button>
            <audio ref={audio} className="hidden" />
          </section>

          <section className="mb-4 grid grid-cols-3 gap-3">
            {[
              { n: inr(v.units_lost), l: t.unitsLost },
              { n: `₹${inr(v.rupees_lost)}`, l: t.rupeesLost },
              { n: inr(v.co2_kg), l: t.co2 },
            ].map((x) => (
              <div key={x.l} className="card p-4">
                <div className="text-2xl font-bold sm:text-3xl">{x.n}</div>
                <div className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>{x.l}</div>
              </div>
            ))}
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t.chartTitle}</h2>
            <DailyChart data={v.daily} lang={lang} />
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              {t.assumptions(v.assumptions.tariff_inr_per_kwh, v.assumptions.co2_kg_per_kwh)}
            </p>
          </section>
        </>
      )}
    </div>
  )
}
