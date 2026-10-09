import { Ic, type IconName } from '../ic'
import type { ProJobDetail } from '../../api'
import { dm, fmtIso } from './dates'
import { p50, val, type Job, type Shown } from './data'
import { useProApp } from './proCtx'

export function Ring({ d, bad }: { d: number; bad?: boolean }) {
  const c = 2 * Math.PI * 19, f = bad ? 1 : Math.max(0.08, d / 7), col = bad ? 'var(--bad)' : 'var(--pop)'
  return (
    <div className="pj-ring">
      <svg viewBox="0 0 46 46" width="46" height="46" aria-hidden>
        <circle cx="23" cy="23" r="19" fill="none" stroke="var(--soft)" strokeWidth="4" />
        <circle cx="23" cy="23" r="19" fill="none" stroke={col} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 23 23)" />
      </svg>
      <b className="pj-num" style={{ color: col }}>{bad ? '!' : d}</b>
    </div>
  )
}

const ICO: Record<string, IconName> = { visit: 'calendar', check: 'search', fixed: 'check', closed: 'x' }
export function Ico({ s }: { s: Shown }) {
  return <div className={`pj-ico pj-${s}`}><Ic n={ICO[s] ?? 'x'} size={22} /></div>
}

/** The same chart drawn from real daily readings: expected range, the actual line, and the gap where output was flagged. */
function LiveChart({ j, d }: { j: Job; d: ProJobDetail }) {
  const { L, lang } = useProApp()
  const days = d.daily, n = days.length
  const W = 340, H = 158, l = 30, r = 8, t = 16, b = 22
  if (n < 2) return null
  const x = (k: number) => l + (k * (W - l - r)) / (n - 1)
  let lo = 1e9, hi = -1e9
  days.forEach((p) => { lo = Math.min(lo, p.actual, p.p10); hi = Math.max(hi, p.actual, p.p90) })
  lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5)
  const y = (v: number) => t + ((hi - v) * (H - t - b)) / (hi - lo)
  const fixEv = [...d.timeline].reverse().find((e) => ['visit_done', 'fixed_remotely', 'fixed'].includes(e.event))
  const fixIdx = fixEv ? days.findIndex((p) => p.date > fixEv.at.slice(0, 10)) : -1
  const firstFlag = days.findIndex((p) => p.flag)
  const pts = (f: (p: (typeof days)[number]) => number, from = 0, to = n) => days.slice(from, to).map((p, i) => `${x(i + from)},${y(f(p))}`)
  const flagged = days.map((p, i) => ({ p, i })).filter(({ p, i }) => p.flag && (fixIdx < 0 || i < fixIdx))
  const up = pts((p) => p.p90), dn = pts((p) => p.p10).reverse()
  const cut = fixIdx < 0 ? n : fixIdx
  return (
    <>
      <svg className="pj-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('Daily output against the expected range', 'रोज़ का उत्पादन और अपेक्षित सीमा')}>
        {[lo, Math.round((lo + hi) / 2), hi].map((v) => <g key={v}><line className="pj-grid" x1={l} x2={W - r} y1={y(v)} y2={y(v)} /><text x={l - 5} y={y(v) + 3} textAnchor="end">{v}</text></g>)}
        <polygon className="pj-band" points={`${up.join(' ')} ${dn.join(' ')}`} />
        {flagged.length > 1 && <polygon className="pj-gap" points={`${flagged.map(({ p, i }) => `${x(i)},${y(p.p50)}`).join(' ')} ${[...flagged].reverse().map(({ p, i }) => `${x(i)},${y(p.actual)}`).join(' ')}`} />}
        <polyline className="pj-p50" points={pts((p) => p.p50).join(' ')} />
        <polyline className="pj-act" points={pts((p) => p.actual, 0, Math.min(n, cut + 1)).join(' ')} />
        {fixIdx > 0 && <polyline className="pj-post" points={pts((p) => p.actual, fixIdx - 1).join(' ')} />}
        {firstFlag >= 0 && <g><line className="pj-mark" x1={x(firstFlag)} x2={x(firstFlag)} y1={t - 4} y2={H - b} /><text className="pj-lbl-bad" x={x(firstFlag) + 4} y={t + 2}>{L('drop started', 'गिरावट शुरू')}</text></g>}
        {fixIdx > 0 && <g><line className="pj-markok" x1={x(fixIdx)} x2={x(fixIdx)} y1={t - 4} y2={H - b} /><text className="pj-lbl-ok" x={x(fixIdx) - 4} y={t + 2} textAnchor="end">{j.state === 'fixed' ? L('FIXED', 'ठीक') : fixEv?.event === 'fixed_remotely' ? L('fixed remotely', 'दूर से ठीक') : L('visit done', 'विज़िट पूरी')}</text></g>}
        <text x={l} y={H - 6}>{fmtIso(days[0].date, lang)}</text>
        <text x={W - r} y={H - 6} textAnchor="end">{L('today', 'आज')}</text>
        <text x={2} y={9}>kWh</text>
      </svg>
      <div className="pj-legend">
        <span><i />{L('Actual', 'असली')}</span><span><i className="pj-b" />{L('Expected range', 'अपेक्षित सीमा')}</span><span><i className="pj-d" />{L('Typical day', 'सामान्य दिन')}</span>
      </div>
    </>
  )
}

export function JobChart({ j, detail }: { j: Job; detail?: ProJobDetail }) {
  const { L, lang } = useProApp()
  if (detail?.daily?.length) return <LiveChart j={j} d={detail} />
  const post = j.state === 'check' ? j.day : j.state === 'fixed' ? 7 : 0, n = 7 + j.drop + post
  const W = 340, H = 158, l = 30, r = 8, t = 16, b = 22
  const x = (k: number) => l + (k * (W - l - r)) / (n - 1)
  let lo = 1e9, hi = -1e9
  for (let i = 0; i < n; i++) { const a = val(j, i), q = p50(j, i); lo = Math.min(lo, a, q * 0.89); hi = Math.max(hi, a, q * 1.08) }
  lo = Math.floor(lo - 0.5); hi = Math.ceil(hi + 0.5)
  const y = (v: number) => t + ((hi - v) * (H - t - b)) / (hi - lo)
  const up: string[] = [], dn: string[] = [], mid: string[] = [], act: string[] = [], gap: string[] = [], gapB: string[] = [], pst: string[] = []
  for (let i = 0; i < n; i++) {
    const p = p50(j, i), av = val(j, i)
    up.push(`${x(i)},${y(p * 1.08)}`); dn.unshift(`${x(i)},${y(p * 0.89)}`); mid.push(`${x(i)},${y(p)}`)
    if (i < 7 + j.drop + (post ? 1 : 0)) act.push(`${x(i)},${y(av)}`)
    if (i >= 7 && i < 7 + j.drop) { gap.push(`${x(i)},${y(p)}`); gapB.unshift(`${x(i)},${y(av)}`) }
    if (post && i >= 6 + j.drop) pst.push(`${x(i)},${y(av)}`)
  }
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  const fxx = x(7 + j.drop)
  return (
    <>
      <svg className="pj-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('Daily output against the expected range', 'रोज़ का उत्पादन और अपेक्षित सीमा')}>
        {ticks.map((v) => (
          <g key={v}><line className="pj-grid" x1={l} x2={W - r} y1={y(v)} y2={y(v)} /><text x={l - 5} y={y(v) + 3} textAnchor="end">{v}</text></g>
        ))}
        <polygon className="pj-band" points={`${up.join(' ')} ${dn.join(' ')}`} />
        <polygon className="pj-gap" points={`${gap.join(' ')} ${gapB.join(' ')}`} />
        <polyline className="pj-p50" points={mid.join(' ')} />
        <polyline className="pj-act" points={act.join(' ')} />
        {post > 0 && <polyline className="pj-post" points={pst.join(' ')} />}
        <line className="pj-mark" x1={x(7)} x2={x(7)} y1={t - 4} y2={H - b} />
        <text className="pj-lbl-bad" x={x(7) + 4} y={t + 2}>{L('drop started', 'गिरावट शुरू')}</text>
        {post > 0 && (
          <g>
            <line className="pj-markok" x1={fxx} x2={fxx} y1={t - 4} y2={H - b} />
            <text className="pj-lbl-ok" x={fxx - 4} y={t + 2} textAnchor="end">{j.state === 'fixed' ? L('FIXED', 'ठीक') : L('visit done', 'विज़िट पूरी')}</text>
          </g>
        )}
        <text x={l} y={H - 6}>{dm(-(n - 1), lang)}</text>
        <text x={W - r} y={H - 6} textAnchor="end">{L('today', 'आज')}</text>
        <text x={2} y={9}>kWh</text>
      </svg>
      <div className="pj-legend">
        <span><i />{L('Actual', 'असली')}</span><span><i className="pj-b" />{L('Expected range', 'अपेक्षित सीमा')}</span><span><i className="pj-d" />{L('Typical day', 'सामान्य दिन')}</span>
      </div>
    </>
  )
}
