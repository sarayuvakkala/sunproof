import { useProApp } from './proCtx'
import { dOff } from './dates'
import { rel } from './dates'

const HOUSE = (
  <>
    <path className="pj-hfill" d="M30 56 L60 30 L90 56 V94 a4 4 0 0 1-4 4 H34 a4 4 0 0 1-4-4Z" />
    <path className="pj-hl" pathLength="1" d="M20 62 L60 28 L100 62" />
    <path className="pj-hl" pathLength="1" d="M30 56 V94 a4 4 0 0 0 4 4 H86 a4 4 0 0 0 4-4 V56" />
    <path className="pj-hl" pathLength="1" d="M52 98 V76 H68 V98" />
  </>
)
const arc = (r: number) => {
  const p = (d: number) => `${(60 + r * Math.cos((d * Math.PI) / 180)).toFixed(1)} ${(26 + r * Math.sin((d * Math.PI) / 180)).toFixed(1)}`
  return `M${p(228)} A${r} ${r} 0 0 1 ${p(312)}`
}
const Star = ({ x, y, d }: { x: number; y: number; d: number }) => (
  <path className="pj-spk2" style={{ animationDelay: `${d}s` }} transform={`translate(${x} ${y})`} d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6Z" />
)
const TICK = <path className="pj-tick" pathLength="1" d="M89 36 L96 43 L108 29" />

/** The full-screen "it's done" card for each reply: a house with a badge in its corner. */
export function FxOverlay() {
  const { fx, skipFx, L, lang } = useProApp()
  if (!fx) return null
  const { type: ty, name: n } = fx
  let art, title, sub, burst = true
  if (ty === 'done') {
    art = <>{HOUSE}<circle className="pj-ring" cx="98" cy="36" r="18" /><circle className="pj-badge" cx="98" cy="36" r="18" />{TICK}</>
    title = L('Visit done', 'विज़िट पूरी हुई'); sub = L(`${n} · SunProof will check the next 7 days`, `SunProof अगले 7 दिन जाँचेगा · ${n}`)
  } else if (ty === 'remote') {
    art = (
      <>
        {HOUSE}
        {[14, 24, 34].map((r, i) => <path key={r} className="pj-arc" style={{ animationDelay: `${0.55 + i * 0.2}s` }} d={arc(r)} />)}
        <circle className="pj-ring" style={{ animationDelay: '1.45s' }} cx="98" cy="36" r="18" /><circle className="pj-rbadge" cx="98" cy="36" r="18" />
        <g className="pj-wr"><g transform="translate(89.5 27.5) scale(.75)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></g></g>
        <path className="pj-tick" style={{ animationDelay: '1.55s' }} pathLength="1" d="M89 36 L96 43 L108 29" />
      </>
    )
    title = L('Fixed remotely', 'दूर से ठीक किया'); sub = L(`${n} · SunProof will check the next 7 days`, `SunProof अगले 7 दिन जाँचेगा · ${n}`)
  } else if (ty === 'notsys') {
    burst = false
    art = (
      <>
        <defs>
          <clipPath id="pjhc"><path d="M30 56 L60 30 L90 56 V94 a4 4 0 0 1-4 4 H34 a4 4 0 0 1-4-4Z" /></clipPath>
          <linearGradient id="pjsh" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        </defs>
        {HOUSE}
        <g className="pj-dust">{[[47, 45, 2.6], [63, 36, 2.2], [76, 47, 2.8], [55, 60, 2.2], [71, 68, 2.6], [43, 75, 2]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} />)}</g>
        <g clipPath="url(#pjhc)"><rect className="pj-shine" x="10" y="20" width="26" height="90" fill="url(#pjsh)" transform="skewX(-18)" /></g>
        <Star x={34} y={40} d={1.35} /><Star x={88} y={30} d={1.5} /><Star x={96} y={70} d={1.65} /><Star x={24} y={78} d={1.8} />
        <circle className="pj-nbadge" cx="98" cy="36" r="18" /><g className="pj-nstar"><path d="M98 25 L100.6 33.4 L109 36 L100.6 38.6 L98 47 L95.4 38.6 L87 36 L95.4 33.4Z" /></g>
      </>
    )
    title = L('Not a system issue', 'सिस्टम की समस्या नहीं'); sub = L(`${n} is pointed to the Cleaning tab`, `Cleaning टैब पर भेजा गया · ${n}`)
  } else {
    burst = false
    art = (
      <>
        {HOUSE}
        <circle className="pj-calring2" cx="99" cy="42" r="20" />
        <g className="pj-cal">
          <rect className="pj-calbody" x="80" y="22" width="38" height="40" rx="8" />
          <path className="pj-calhead" d="M80 30 a8 8 0 0 1 8-8 H110 a8 8 0 0 1 8 8 V36 H80Z" />
          <path className="pj-calring" d="M91 18 V26 M107 18 V26" />
          <text className="pj-caln" x="99" y="55">{dOff(fx.o ?? 1).getDate()}</text>
          <circle className="pj-calok" cx="116" cy="62" r="9" />
          <path className="pj-caltick" pathLength="1" d="M111.5 62 L114.8 65.2 L120.5 58.8" />
        </g>
      </>
    )
    title = L('Visit booked', 'विज़िट तय हुई'); sub = `${n} · ${rel(fx.o ?? 1, lang)}, ${fx.t}`
  }
  const rem = ty === 'remote'
  return (
    <div className="pj-fxveil pj-root" onClick={skipFx} role="status" aria-live="polite">
      <div className="pj-fxcard">
        <div className="pj-fxhouse">
          <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden>{art}</svg>
          {burst && <span className="pj-burst">{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <i key={i} style={{ '--dx': `${Math.round(Math.cos(a) * 34)}px`, '--dy': `${Math.round(Math.sin(a) * 34)}px`, animationDelay: `${rem ? 1.5 : 1}s` } as React.CSSProperties} /> })}</span>}
        </div>
        <b className="pj-fxt" style={{ animationDelay: `${rem ? 1.7 : 1.2}s` }}>{title}</b>
        <span className="pj-fxs" style={{ animationDelay: `${rem ? 1.8 : 1.3}s` }}>{sub}</span>
      </div>
    </div>
  )
}
