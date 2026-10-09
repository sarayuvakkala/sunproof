import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CleanOrSkip } from '../api'
import { cleanResult, dustLossRs, weekday } from './calc'
import { Ic } from './ic'
import { useApp, type Scn } from './state'
import { Ticker } from './Ticker'
import { Card } from './ui'

function Panel({ dusty, fade }: { dusty: boolean; fade?: boolean }) {
  return (
    <svg viewBox="0 0 300 112" width="100%" height="112" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <g transform="translate(90,26) skewX(-16)">
        <rect width="130" height="62" rx="6" fill="#1e3a8a" /><path d="M43 0v62M87 0v62M0 31h130" stroke="#93c5fd" strokeWidth="1.2" />
        {dusty && <rect className={fade ? 'dustfade' : undefined} width="130" height="62" rx="6" fill="#c2a36b" opacity=".45" />}
        {dusty && [...Array(14)].map((_, i) => <circle key={i} className={fade ? 'dustfade' : undefined} cx={8 + ((i * 37) % 116)} cy={6 + ((i * 19) % 52)} r={1.4 + (i % 3) * 0.6} fill="#7c4a03" opacity=".6" />)}
      </g>
      <rect x="60" y="96" width="200" height="4" rx="2" fill="#fff" opacity=".35" />
    </svg>
  )
}

function Cloud({ x = 170, drops = 5 }: { x?: number; drops?: number }) {
  return (
    <svg viewBox="0 0 300 112" width="100%" height="112" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <g transform={`translate(${x},4)`}>
        <ellipse cx="40" cy="22" rx="40" ry="17" fill="#cbd5e1" /><ellipse cx="18" cy="26" rx="22" ry="13" fill="#e2e8f0" /><ellipse cx="62" cy="26" rx="22" ry="13" fill="#e2e8f0" />
        {[...Array(drops)].map((_, i) => <line key={i} className="rdrop" x1={14 + i * 13} y1="40" x2={11 + i * 13} y2="50" stroke="#bfdbfe" strokeWidth="2.4" strokeLinecap="round" style={{ animationDelay: `${i * 0.18}s` }} />)}
      </g>
    </svg>
  )
}

function Sparkles() {
  return (
    <>
      <div className="shine" />
      {[[40, 22], [250, 28], [60, 76], [232, 80], [150, 12]].map((p, i) => (
        <svg key={i} className="spark" style={{ left: p[0], top: p[1], animationDelay: `${i * 0.35}s` }} width="16" height="16" viewBox="-8 -8 16 16" aria-hidden><path d="M0-8 1.6-1.6 8 0 1.6 1.6 0 8-1.6 1.6-8 0-1.6-1.6Z" fill="#fff" /></svg>
      ))}
    </>
  )
}

/** Next 5 days of rain chance. Simulated for demo weather; built from the real forecast date otherwise. */
function Forecast({ d }: { d: CleanOrSkip }) {
  const { t, lang } = useApp()
  const days = [...Array(5)].map((_, i) => {
    const dt = new Date(); dt.setDate(dt.getDate() + i + 1)
    return dt.toISOString().slice(0, 10)
  })
  const rainDay = d.rain_expected ? days.indexOf(d.rain_expected.date) : -1
  const base = d.rain_expected ? [20, 40, 10, 5, 5] : [10, 5, 0, 10, 5]
  const pct = days.map((_, i) => (d.rain_expected && i === (rainDay >= 0 ? rainDay : 1) ? 85 : base[i]))
  const peak = Math.max(...pct)
  const label = d.rain_expected
    ? t(`Rain likely on ${weekday(d.rain_expected.date, lang)} · ${Math.round(d.rain_expected.mm)} mm`)
    : t('Rain unlikely this week')
  return (
    <Card delay={0.04}>
      <div className="h">{t('Chance of rain')}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.03em', color: peak >= 50 ? '#2563eb' : 'var(--ink)' }}>{peak}%</span>
        <span className="sm mut">{label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginTop: 12 }}>
        {pct.map((v, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ height: 46, display: 'flex', alignItems: 'flex-end' }}>
              <i style={{ display: 'block', width: '100%', height: Math.max(4, v * 0.46), borderRadius: 6, background: v >= 50 ? 'linear-gradient(180deg,#60a5fa,#2563eb)' : 'var(--line)' }} />
            </div>
            <div className="sm" style={{ fontWeight: 700, marginTop: 4 }}>{v}%</div>
            <div className="sm mut" style={{ fontSize: 10.5 }}>{weekday(days[i], lang)}</div>
          </div>
        ))}
      </div>
      {d.simulated && <div className="sm mut" style={{ marginTop: 10, fontSize: 11 }}>{t('Simulated forecast')}</div>}
    </Card>
  )
}

export function CleaningTab() {
  const { clean: d, scn, setScn, cl, setCl, v, t, lang } = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (cl !== 'raining') return
    const id = setTimeout(() => setCl('rain'), 3700)
    return () => clearTimeout(id)
  }, [cl, setCl])

  if (!d) return <Card style={{ color: 'var(--mut)' }}>{t('Loading…')}</Card>
  const dust = scn === 'dust'
  const res = cleanResult(cl, d, v)
  const isClean = d.decision === 'clean'
  const lossRs = dustLossRs(d)
  const max = Math.max(d.cleaning_cost, lossRs, 1)
  const reason = lang === 'hi' ? d.reason_hi : d.reason_en
  const nextRain = d.rain_expected ? `${weekday(d.rain_expected.date, lang)} · ${Math.round(d.rain_expected.mm)} mm` : t('None')
  const SW: [Scn, string][] = [['dust', '🌫 Heavy dust'], ['rain', '🌧 Rain coming']]

  return (
    <>
      {v?.isDemo && (
        <div className={`sgm ${dust ? '' : 'r'}`} style={{ margin: '2px 0 12px' }}>
          <b />
          {SW.map(([k, l]) => <span key={k} className={scn === k ? 'on' : ''} role="button" tabIndex={0} onClick={() => setScn(k)}>{t(l)}</span>)}
        </div>
      )}

      {!res && (
        <>
          <div className={`card hero up ${isClean ? 'clean' : 'skip'}`}>
            <div className="art">
              <Panel dusty={isClean} />
              {isClean ? <Sparkles /> : <Cloud />}
            </div>
            <div style={{ padding: '4px 18px 18px' }}>
              <div className="k" style={{ opacity: 0.85 }}>{t('OUR ADVICE')}</div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.05, marginTop: 4 }}>{isClean ? t('Clean now') : t('Skip it')}</div>
              <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 6, opacity: 0.95 }}>{reason}</div>
            </div>
          </div>
          <Forecast d={d} />
          <Card delay={0.05}>
            <div className="h">{t('What will you do?')}</div>
            <div className="chs">
              <span className="ch" role="button" tabIndex={0} onClick={() => setCl('clean')}><Ic n="brush" size={26} color="#e8a400" style={{ display: 'block', margin: '0 auto 6px' }} />{t("I'll clean them")}<small>{t(`₹${Math.round(d.cleaning_cost)} · one time`)}</small></span>
              <span className="ch" role="button" tabIndex={0} onClick={() => setCl(d.rain_expected ? 'raining' : 'rain')}><Ic n="cloud-rain" size={26} color="#2563eb" style={{ display: 'block', margin: '0 auto 6px' }} />{t('Let the rain wash them')}<small>{d.rain_expected ? `${weekday(d.rain_expected.date, lang)} · ${Math.round(d.rain_expected.mm)} mm` : t('No rain in the forecast')}</small></span>
            </div>
          </Card>
          <Card delay={0.1}>
            <div className="trio">
              <div><b style={{ color: isClean ? '#ea580c' : '#d97706' }}>{d.dust_loss_pct}%</b><span>{t('dust loss')}<br />{t('(estimated)')}</span></div>
              <div><b>{d.days_since_rain}</b><span>{t('days since')}<br />{t('rain')}</span></div>
              <div><b style={{ fontSize: d.rain_expected ? 16 : 20, color: d.rain_expected ? '#2563eb' : 'var(--ink)' }}>{nextRain}</b><span>{t('next washing')}<br />{t('rain')}</span></div>
            </div>
          </Card>
          <Card delay={0.15}>
            <div className="h">{t('The money math')}</div>
            <div className="sm mut" style={{ marginTop: 2 }}>{t('Cleaning once vs what dust takes from you')}</div>
            <Bar label={t('Cleaning, one time')} value={d.cleaning_cost} pct={(d.cleaning_cost / max) * 100} bg="#6366f1" />
            <Bar label={d.rain_expected ? t('Dust loss until the rain') : t('Dust loss next month')} value={lossRs} pct={Math.max(3, (lossRs / max) * 100)} bg="linear-gradient(90deg,#fbbf24,#ea580c)" />
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: isClean ? '#dcfce7' : '#dbeafe', color: isClean ? '#166534' : '#1e40af' }}>
              {isClean ? t('Cleaning pays for itself in about a month') : t(`Save ₹${Math.round(d.cleaning_cost)}. Let the rain do it.`)}
            </div>
          </Card>
          <div className={`card accd up ${open ? 'open' : ''}`} style={{ padding: 0, animationDelay: '.2s' }}>
            <div className="acc-h" role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(!open) }}>
              <span className="h"><Ic n="bulb" size={18} color="#e8a400" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />{t('Cleaning tips')}</span>
              <Ic n="chevron-down" size={18} className="chev" />
            </div>
            <div className="acc-b"><div className="acc-in">
              {([['clock', 'Early morning or evening, when panels are cool.'], ['droplet', 'Plain water and a soft cloth. No detergent.'], ['alert-triangle', "Don't climb without safety gear. Use a pole or a professional."]] as const).map(([ic, tx], i) => (
                <div className="tip" key={i} style={{ transitionDelay: `${open ? 0.1 + i * 0.08 : 0}s` }}><Ic n={ic} size={18} color="#e8a400" /><span>{t(tx)}</span></div>
              ))}
            </div></div>
          </div>
        </>
      )}

      {res && res.g === 2 && (
        <div className="card hero up skip">
          <div className="art"><Panel dusty fade /><Cloud x={110} drops={7} /></div>
          <div style={{ padding: '4px 18px 18px' }}>
            <div className="k" style={{ opacity: 0.9 }}>{t(res.k)}</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.05, marginTop: 4 }}>{t(res.t)}</div>
            <RainBar />
            <div style={{ fontSize: 12.5, marginTop: 10, opacity: 0.95 }}>{t(res.n)}</div>
          </div>
        </div>
      )}

      {res && res.g !== 2 && (
        <>
          <div className="card hero up" style={{ background: `linear-gradient(150deg,${res.g ? '#22c55e,#15803d' : '#f59e0b,#b45309'})` }}>
            <div className="art">
              <Panel dusty={!res.g} />
              {res.g ? <Sparkles /> : null}
              <span className="pop">{res.g ? t('✓ Done') : t('⏳ Waiting')}</span>
            </div>
            <div style={{ padding: '4px 18px 18px' }}>
              <div className="k" style={{ opacity: 0.9 }}>{t(res.k)}</div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.05, marginTop: 4 }}>{t(res.t)}</div>
              {res.g === 1 && (
                <div className="wst">
                  <div><b><Ticker value={res.u} decimals={1} delay={300} /></b><span>{t('units back')}</span></div>
                  <div><b>₹<Ticker value={res.r} delay={440} /></b><span>{t('saved')}</span></div>
                  <div><b><Ticker value={res.c} decimals={1} delay={580} /> {t('kg')}</b><span>{t('CO₂ avoided')}</span></div>
                </div>
              )}
              <div style={{ fontSize: 12.5, marginTop: 10, opacity: 0.95, lineHeight: 1.45 }}>{t(res.n)}</div>
            </div>
          </div>
          <Card delay={0.15}>
            {res.g === 1 ? (
              <>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="ico" style={{ width: 40, height: 40, background: '#dcfce7' }}><Ic n="leaf" size={20} color="#166534" /></div>
                  <div style={{ flex: 1 }}><div className="h">{t('Added to your Impact')}</div><div className="sm mut">{t('Counted with your other recovered energy')}</div></div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <span className="ghost" role="button" tabIndex={0} onClick={() => nav('/app/impact')}>{t('See Impact →')}</span>
                  <span className="ghost" role="button" tabIndex={0} onClick={() => setCl(null)}>{t('Undo')}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="ghost" role="button" tabIndex={0} onClick={() => setCl('clean')}>{t("I'll clean them instead")}</span>
                <span className="ghost" role="button" tabIndex={0} onClick={() => setCl(null)}>{t('Back')}</span>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}

function Bar({ label, value, pct, bg }: { label: string; value: number; pct: number; bg: string }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id = setTimeout(() => setW(pct), 250); return () => clearTimeout(id) }, [pct])
  return (
    <div className="mrow">
      <div className="lb"><span>{label}</span><b>₹{Math.round(value)}</b></div>
      <div className="trk"><i style={{ width: `${w}%`, background: bg }} /></div>
    </div>
  )
}


function RainBar() {
  const [w, setW] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => setW(100))); return () => cancelAnimationFrame(id) }, [])
  return <div className="trk" style={{ marginTop: 14, background: 'rgba(255,255,255,.25)' }}><i style={{ background: '#fff', width: `${w}%`, transition: 'width 3.6s linear' }} /></div>
}
