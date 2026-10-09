import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAccuracy, type Accuracy } from '../api'
import { cleanResult, r1 } from './calc'
import { Ic, type IconName } from './ic'
import { useApp } from './state'
import { Ticker } from './Ticker'
import { Card } from './ui'

export function useAccuracy() {
  const [a, setA] = useState<Accuracy | null>(null)
  useEffect(() => { getAccuracy().then((x) => setA('by_kind' in x ? x : null)).catch(() => {}) }, [])
  return a
}

export const accNums = (a: Accuracy) => {
  const k = a.by_kind
  const caught = k.trip.caught + k.step.caught + k.dust.caught
  const inj = k.trip.injected + k.step.injected + k.dust.injected
  return {
    caught, inj, pct: Math.round((caught / inj) * 100),
    hardCaught: k.step.caught + k.dust.caught, hardInj: k.step.injected + k.dust.injected,
    fa: a.false_alarms.rate * 100,
  }
}

function AccTiles({ a }: { a: Accuracy | null }) {
  const { t } = useApp()
  const nav = useNavigate()
  if (!a) return null
  const k = a.by_kind
  return (
    <Card delay={0.45}>
      <div className="h">{t('Can you trust the check?')}</div>
      <div className="sm mut" style={{ marginTop: 2 }}>{t('Faults hidden in real Indian plant data, found blind.')}</div>
      <div className="at">
        <div><b>{k.trip.caught}/{k.trip.injected}</b><span>{t('stopped systems')}</span></div>
        <div><b>{k.step.caught}/{k.step.injected}</b><span>{t('sudden 20% drops')}</span></div>
        <div><b>{k.dust.caught}/{k.dust.injected}</b><span>{t('dust build-ups')}</span></div>
        <div><b style={{ color: '#e8a400' }}>{(a.false_alarms.rate * 100).toFixed(2)}%</b><span>{t('false alarms')}</span></div>
      </div>
      <div style={{ marginTop: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => nav('/app/accuracy')}>{t('Full accuracy report →')}</div>
    </Card>
  )
}

function Plant({ grown }: { grown: boolean }) {
  return grown ? (
    <svg viewBox="0 0 300 170" width="100%" style={{ display: 'block' }} aria-hidden>
      <circle cx="246" cy="34" r="16" fill="#fbbf24" opacity=".85" />
      <g className="sway">
        <path className="stem" pathLength="1" d="M150 150 C150 120 146 96 152 64" stroke="#16a34a" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path className="leaf" style={{ animationDelay: '.9s', transformOrigin: '0% 100%' }} d="M150 122 C126 120 112 106 112 92 C130 92 146 104 150 122Z" fill="#22c55e" />
        <path className="leaf" style={{ animationDelay: '1.1s', transformOrigin: '0% 100%' }} d="M151 104 C174 102 190 88 190 72 C170 74 154 86 151 104Z" fill="#16a34a" />
        <path className="leaf" style={{ animationDelay: '1.3s', transformOrigin: '50% 100%' }} d="M152 66 C140 52 142 36 152 28 C162 36 164 52 152 66Z" fill="#4ade80" />
      </g>
      <ellipse cx="150" cy="154" rx="70" ry="12" fill="var(--soil)" /><ellipse cx="150" cy="151" rx="64" ry="8" fill="var(--soil2)" />
    </svg>
  ) : (
    <svg viewBox="0 0 300 150" width="100%" style={{ display: 'block' }} aria-hidden>
      <circle cx="246" cy="34" r="16" fill="#fbbf24" opacity=".5" />
      <path d="M150 128 V88" stroke="#16a34a" strokeWidth="3" strokeDasharray="4 5" opacity=".5" />
      <ellipse cx="150" cy="134" rx="70" ry="12" fill="var(--soil)" /><ellipse cx="150" cy="131" rx="64" ry="8" fill="var(--soil2)" /><ellipse cx="150" cy="128" rx="9" ry="6" fill="#d4a373" />
    </svg>
  )
}

function Eq({ bg, ic, col, v, p, unit, label }: { bg: string; ic: IconName; col: string; v: number; p: number; unit: string; label: string }) {
  const { t } = useApp()
  return (
    <div className="eqr">
      <div className="ico" style={{ background: bg }}><Ic n={ic} size={24} color={col} /></div>
      <div>
        <div className="num"><Ticker value={v} decimals={p} delay={250} /><span className="unit">{t(unit)}</span></div>
        <div className="sm mut" style={{ marginTop: 4 }}>{t(label)}</div>
      </div>
    </div>
  )
}

export function ImpactTab() {
  const { v, issue, view, clean: d, cl, t } = useApp()
  const nav = useNavigate()
  const acc = useAccuracy()
  const [bar, setBar] = useState(false)
  useEffect(() => { const id = setTimeout(() => setBar(true), 250); return () => clearTimeout(id) }, [])
  if (!v) return <Card style={{ color: 'var(--mut)' }}>{t('Loading…')}</Card>

  const fixed = view === 'fix' && issue?.recovered ? issue.recovered : null
  const fx = fixed ? { u: fixed.kwh, r: fixed.rupees, c: fixed.co2_kg } : { u: 0, r: 0, c: 0 }
  const res = cleanResult(cl, d, v)
  const cu = res && res.g === 1 ? res : null
  const U = r1(fx.u + (cu?.u ?? 0)), R = fx.r + (cu?.r ?? 0), C = r1(fx.c + (cu?.c ?? 0))
  const n = (fixed ? 1 : 0) + (cu ? 1 : 0)

  if (!U) {
    const openI = !['fix', 'dis'].includes(view) && (issue !== null || v.status === 'shortfall' || v.status === 'trip')
    const dust = view === 'dis' || d?.decision === 'clean'
    const msg = openI
      ? 'Your output is about 15% low. Fix it with your installer to start recovering clean energy.'
      : view === 'dis' ? 'Your installer says it is not the system. Dust is the likely cause, so clean the panels.' : 'Nothing to recover right now.'
    return (
      <>
        <div className="card heroG up" style={{ textAlign: 'center', paddingBottom: 18 }}>
          <Plant grown={false} />
          <div className="k" style={{ color: '#166534' }}>{t('CLEAN ENERGY RECOVERED')}</div>
          <div style={{ fontSize: 20, fontWeight: 800, margin: '8px 20px 0' }}>{t('Nothing recovered yet')}</div>
          <div className="sm mut" style={{ margin: '6px 24px 14px', lineHeight: 1.5 }}>{t(msg)}</div>
          {openI && <span className="act" role="button" tabIndex={0} style={{ margin: '0 40px' }} onClick={() => nav('/app/installer')}>{t('Go to Installer')}</span>}
          {dust && <span className={openI ? 'ghost' : 'act'} role="button" tabIndex={0} style={{ margin: openI ? '10px 40px 0' : '0 40px' }} onClick={() => nav('/app/cleaning')}>{t('Go to Cleaning')}</span>}
        </div>
        <AccTiles a={acc} />
      </>
    )
  }

  const pU = Number.isInteger(U) ? 0 : 1
  const tog = n > 1 ? (fixed ? 'actions' : 'actions') : fixed ? 'fix' : 'cleaning'
  return (
    <>
      <div className="card heroG up">
        <Plant grown />
        <div className="k" style={{ textAlign: 'center', marginTop: -6, color: '#166534' }}>{t('CLEAN ENERGY RECOVERED')}</div>
        <div className="stats" style={{ border: 'none', padding: '12px 8px 16px' }}>
          <div className="stat"><div className="big" style={{ color: '#15803d' }}><Ticker value={U} decimals={pU} delay={250} /></div><div className="lab">{t('units')}</div></div>
          <div className="stat"><div className="big">₹<Ticker value={R} delay={390} /></div><div className="lab">{t('saved')}</div></div>
          <div className="stat"><div className="big"><Ticker value={C} decimals={1} delay={530} /><span style={{ fontSize: 12, color: 'var(--mut)' }}> {t('kg')}</span></div><div className="lab">{t('CO₂ avoided')}</div></div>
        </div>
      </div>

      {n > 1 && (
        <Card delay={0.1}>
          <div className="h">{t('Where it came from')}</div>
          <div className="bseg">
            <i style={{ width: bar ? `${(fx.u / U) * 100}%` : 0, background: '#16a34a' }} />
            <i style={{ width: bar ? `${((cu?.u ?? 0) / U) * 100}%` : 0, background: '#f5b300' }} />
          </div>
          <div className="sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: '#16a34a' }}>●</span> {t(`Installer fix · ${fx.u} units`)}</span>
            <span><span style={{ color: '#e8a400' }}>●</span> {t(`${cl === 'rain' ? 'Rain' : 'Cleaning'} · ${cu?.u} units`)}</span>
          </div>
        </Card>
      )}

      <Card delay={0.15}>
        <div className="h">{t(`What ${U} units can power`)}</div>
        <div className="sm mut" style={{ margin: '2px 0 6px' }}>{t('The energy your actions brought back')}</div>
        <Eq bg="#e0f2fe" ic="propeller" col="#0369a1" v={Math.round(U / 0.075)} p={0} unit="hours" label="of a ceiling fan (75 W)" />
        <Eq bg="#fef3c7" ic="bulb" col="#b45309" v={Math.round(U / 0.009)} p={0} unit="hours" label="of an LED bulb (9 W)" />
        <Eq bg="#dcfce7" ic="sun" col="#15803d" v={r1(U / 13.9)} p={1} unit="days" label="of your roof's full output" />
      </Card>

      {fixed && (
        <Card delay={0.3}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h">{t('Your fix')}</div>
            <span className="chipS" style={{ background: '#dcfce7', color: '#166534' }}>{t('✓ Fixed')}</span>
          </div>
          <div className="sm" style={{ marginTop: 10, lineHeight: 1.6 }}>
            <Ic n="user" size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('Fixed by Test installer')}<br />
            <Ic n="chart-line" size={14} style={{ verticalAlign: 'text-bottom' }} /> {t('Confirmed by 7 days of data')} <span className="rtag">{t('REPLAY')}</span>
          </div>
        </Card>
      )}

      {cu && (
        <Card delay={0.35}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h">{t(cl === 'rain' ? 'Rain wash' : 'Panel cleaning')}</div>
            <span className="chipS" style={{ background: '#fef3c7', color: '#92400e' }}>{t('Estimated')}</span>
          </div>
          <div className="sm" style={{ marginTop: 8, lineHeight: 1.6 }}>{t(cu.n)}</div>
        </Card>
      )}

      <Card delay={0.4}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="ico" style={{ width: 40, height: 40, background: '#dcfce7' }}><Ic n="users" size={20} color="#166534" /></div>
          <div><div className="sm mut">{t('Across all SunProof homes')}</div><div className="h">{t(`Together: ${U} units from ${n} ${tog}`)}</div></div>
        </div>
      </Card>
      <AccTiles a={acc} />
    </>
  )
}
