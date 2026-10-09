import { useEffect, useState } from 'react'
import { Ic, type IconName } from './ic'
import { accNums, useAccuracy } from './ImpactTab'
import { useApp } from './state'
import { Ticker } from './Ticker'
import { Card } from './ui'

export function AccuracyPage() {
  const { t } = useApp()
  const a = useAccuracy()
  const [on, setOn] = useState(false)
  useEffect(() => { const id = setTimeout(() => setOn(true), 250); return () => clearTimeout(id) }, [a])
  if (!a) return <Card style={{ color: 'var(--mut)' }}>{t('Loading…')}</Card>
  const n = accNums(a)
  const C = 2 * Math.PI * 44
  const k = a.by_kind
  const rows: [string, number, number, string, string][] = [
    ['System stopped', k.trip.caught, k.trip.injected, 'Caught within 2 days', '#22c55e'],
    ['Sudden 20% drop', k.step.caught, k.step.injected, 'Caught within 2 days', '#22c55e'],
    ['Dust build-up', k.dust.caught, k.dust.injected, 'Within 7 days of the loss passing 5%', 'linear-gradient(90deg,#22c55e,#f5b300)'],
  ]
  const steps: [IconName, string, string][] = [
    ['database', 'Took real plant data', '2 Indian plants · 34 days · 22 inverters each'],
    ['eye-off', 'Hid faults in it', 'Stopped systems, 20% drops, slow dust build-up'],
    ['target', 'Ran the check blind', '20 random layouts · tuned on 11 inverters, scored on 11 others'],
  ]
  const under = a.real_underperformers_plant_1
  const lessLo = under.length ? Math.round((1 - Math.max(...under.map((u) => u.median_vs_peers))) * 100) : 0
  const lessHi = under.length ? Math.round((1 - Math.min(...under.map((u) => u.median_vs_peers))) * 100) : 0
  const per = Math.round(1 / a.false_alarms.rate)
  return (
    <>
      <div className="up" style={{ margin: '4px 2px 14px' }}>
        <div className="k" style={{ color: '#b45309' }}>{t('ACCURACY REPORT')}</div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.1, marginTop: 4 }}>{t('How accurate is the check?')}</div>
      </div>
      <div className="card up" style={{ background: 'linear-gradient(160deg,#14110a,#2a2110)', color: '#fff', border: 'none', animationDelay: '.05s' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <svg width="100" height="100" viewBox="0 0 104 104" style={{ flex: '0 0 auto' }} aria-hidden>
            <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
            <circle cx="52" cy="52" r="44" fill="none" stroke="#f5b300" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={on ? C * (1 - n.caught / n.inj) : C} transform="rotate(-90 52 52)" style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }} />
            <text x="52" y="58" textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff"><Ticker value={n.pct} />%</text>
          </svg>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{t('Hidden faults caught')}</div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.05 }}><Ticker value={n.caught} /><span style={{ fontSize: 16, opacity: 0.7 }}> {t(`of ${n.inj}`)}</span></div>
            <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 2 }}>{t(`${n.hardCaught} of ${n.hardInj} on the harder cases`)}</div>
            <div style={{ fontSize: 12, marginTop: 6, color: '#fde68a' }}><Ticker value={n.fa} decimals={2} />{t('% false alarms')}</div>
          </div>
        </div>
      </div>

      <Card delay={0.15}>
        <div className="h">{t('How we tested it')}</div>
        <div className="vt" style={{ marginTop: 12 }}>
          {steps.map((s) => (
            <div className="vs" key={s[1]}>
              <div className="ico" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--soft)' }}><Ic n={s[0]} size={18} color="#b45309" /></div>
              <div><div className="vt1">{t(s[1])}</div><div className="vt2">{t(s[2])}</div></div>
            </div>
          ))}
        </div>
      </Card>

      <Card delay={0.25}>
        <div className="h">{t('Results')}</div>
        {rows.map((r) => (
          <div className="mrow" key={r[0]}>
            <div className="lb"><b>{t(r[0])}</b><span style={{ fontSize: 19, fontWeight: 800 }}><Ticker value={r[1]} /><small className="mut" style={{ fontSize: 12 }}> / {r[2]}</small></span></div>
            <div className="trk"><i style={{ width: on ? `${(r[1] / r[2]) * 100}%` : 0, background: r[4] }} /></div>
            <div className="sm mut" style={{ marginTop: 4 }}>{t(r[3])}</div>
          </div>
        ))}
      </Card>

      <Card delay={0.35}>
        <div className="h">{t('False alarms')}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.03em' }}>{t(`1 in ~${per}`)}</span><span className="sm mut">{t('healthy days')}</span>
        </div>
        <div className="dgrid">
          {[...Array(per)].map((_, i) => <i key={i} className={`${on ? 'on' : ''} ${i === Math.floor(per * 0.67) ? 'bad' : ''}`} style={{ transitionDelay: `${i * 6}ms` }} />)}
        </div>
        <div className="sm mut" style={{ marginTop: 8 }}>{t(`${a.false_alarms.flagged} alarms across ${a.false_alarms.clean_inverter_days.toLocaleString('en-IN')} healthy inverter-days (${(a.false_alarms.rate * 100).toFixed(2)}%)`)}</div>
      </Card>

      {under.length > 0 && (
        <Card delay={0.45} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="ico" style={{ width: 36, height: 36, borderRadius: 11, background: '#fef3c7' }}><Ic n="search" size={18} color="#b45309" /></div>
            <div>
              <div className="h" style={{ color: '#14110a' }}>{t('Bonus: it found real problems')}</div>
              <div className="sm" style={{ color: '#5a4a2a', marginTop: 4, lineHeight: 1.5 }}>
                <b>{t(`${under.length} real inverters`)}</b> {t('make')} <b>{t(`${lessLo === lessHi ? lessLo : `${lessLo}–${lessHi}`}% less`)}</b> {t('than their neighbours under the same sun.')}
              </div>
            </div>
          </div>
        </Card>
      )}

    </>
  )
}
