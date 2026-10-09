import { useState } from 'react'
import type { DailyPoint } from '../api'
import { fmtDate } from './calc'
import { useApp } from './state'

/** Daily output vs the expected band. 7d/30d swaps only this chart. */
export function ChartCard({ daily, replayFrom, unitsLost, fixed }: {
  daily: DailyPoint[]
  replayFrom: string | null
  unitsLost: number
  fixed: boolean
}) {
  const { t, lang } = useApp()
  const [range, setRange] = useState<7 | 30>(30)
  const rows = range === 7 ? daily.slice(-7) : daily
  const n = rows.length
  const W = 300, H = 130, pad = 8
  const lo = Math.min(...rows.map((r) => Math.min(r.p10, r.actual))) - 0.4
  const hi = Math.max(...rows.map((r) => Math.max(r.p90, r.actual))) + 0.4
  const x = (k: number) => pad + (n > 1 ? (k * (W - 2 * pad)) / (n - 1) : 0)
  const y = (val: number) => H - 14 - ((val - lo) / (hi - lo || 1)) * (H - 30)
  const rk = replayFrom ? rows.findIndex((r) => r.date >= replayFrom) : -1
  const inReplay = (k: number) => rk >= 0 && k >= rk
  const split = rk > 0 ? rk : n
  const pts = (a: number, b: number) => rows.slice(a, b).map((r, i) => `${x(a + i)},${y(r.actual)}`)
  const lineAll = 'M' + pts(0, n).join(' L')
  const linePre = 'M' + pts(0, Math.min(n, split + 1)).join(' L')
  const lineRep = rk >= 0 ? 'M' + pts(Math.max(0, rk - 1), n).join(' L') : ''
  const area = `${lineAll} L${x(n - 1)},${H} L${x(0)},${H} Z`
  const bt = rows.map((r, k) => `${x(k)},${y(r.p90)}`)
  const bb = rows.map((r, k) => `${x(k)},${y(r.p10)}`).reverse()
  const gi = rows.map((r, k) => [r, k] as const).filter(([r, k]) => r.flag !== null && !inReplay(k))
  const first = rows.findIndex((r) => r.flag !== null && !inReplay(rows.indexOf(r)))
  const mid = gi.length > 1 ? gi[Math.floor(gi.length / 2)] : null
  const lc = fixed ? '#16a34a' : '#f5b300'
  const dt = (i: number) => fmtDate(rows[i].date, lang)
  const labels = [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="h">{t('Daily output')}</div>
        <div className="rng">
          {([7, 30] as const).map((r) => (
            <span key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setRange(r) }}>{r}d</span>
          ))}
        </div>
      </div>
      <svg key={range} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily output against the expected range">
        <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={lc} stopOpacity=".35" /><stop offset="1" stopColor={lc} stopOpacity="0" /></linearGradient></defs>
        <line x1={pad} y1={H - 14} x2={W - pad} y2={H - 14} stroke="var(--line)" />
        <path d={`M${bt.join(' L')} L${bb.join(' L')} Z`} fill="#f5b300" opacity=".18" />
        <polyline points={rows.map((r, k) => `${x(k)},${y(r.p50)}`).join(' ')} fill="none" stroke="#f5b300" strokeWidth="1.2" strokeDasharray="3 3" />
        {gi.length > 1 && (
          <>
            <path d={`M${gi.map(([r, k]) => `${x(k)},${y(r.p50)}`).join(' L')} L${gi.map(([r, k]) => `${x(k)},${y(r.actual)}`).reverse().join(' L')} Z`} fill="#ef4444" opacity=".16" />
            {mid && (
              <g className="fadein">
                <rect x={x(mid[1]) - 34} y={y((mid[0].p50 + mid[0].actual) / 2) - 9} width="68" height="17" rx="8.5" fill="#ef4444" />
                <text x={x(mid[1])} y={y((mid[0].p50 + mid[0].actual) / 2) + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
                  {range === 30 ? t(`${Math.round(unitsLost)} units lost`) : t('gap this week')}
                </text>
              </g>
            )}
          </>
        )}
        {rk >= 0 && (
          <>
            <rect x={x(rk)} y="0" width={W - x(rk)} height={H - 14} fill="#22c55e" opacity=".08" />
            <g transform={`translate(${x(rk)},22)`}><path d="M0 0h30l-5 5 5 5H0z" fill="#16a34a" /><text x="3" y="8" fontSize="7.5" fontWeight="700" fill="#fff">{t('FIXED')}</text></g>
          </>
        )}
        <path d={area} fill="url(#ar)" className="fadein" style={{ animationDelay: '.8s' }} />
        <path d={rk >= 0 ? linePre : lineAll} fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="draw" />
        {rk >= 0 && <path d={lineRep} fill="none" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="draw" style={{ animationDelay: '1s' }} />}
        <circle cx={x(n - 1)} cy={y(rows[n - 1].actual)} r="4" fill={rk >= 0 ? '#16a34a' : '#ea580c'} stroke="var(--card)" strokeWidth="2" className="fadein" />
        {first >= 0 && (
          <>
            <line x1={x(first)} y1="10" x2={x(first)} y2={H - 14} stroke="#ea580c" strokeDasharray="2 3" />
            <text x={x(first) + 4} y="16" fontSize="8.5" fill="#ea580c">{t(`drop started ${dt(first)}`)}</text>
          </>
        )}
        {labels.map((i, j) => (
          <text key={j} x={[pad, W / 2, W - pad][j]} y={H - 2} fontSize="8.5" fill="var(--mut)" textAnchor={(['start', 'middle', 'end'] as const)[j]}>{dt(i)}</text>
        ))}
      </svg>
      <div className="sm mut" style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        <span>{t('▬ Expected range')}</span><span>{t('— Actual')}</span>
        {rk >= 0 && <span style={{ color: '#16a34a' }}>{t('● Replay after fix')}</span>}
      </div>
    </div>
  )
}
