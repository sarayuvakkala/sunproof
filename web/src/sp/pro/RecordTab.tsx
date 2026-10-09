import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ic } from '../ic'
import { MO, dOff } from './dates'
import { useProApp } from './proCtx'
import { recordRows, recordStats, type Row } from './record'
import { useCountTo, useInView } from './useInView'

type Period = '6' | 'all'
type Filter = 'all' | 'fixed' | 'not'

const STAR = (off: boolean) => (
  <svg viewBox="0 0 24 24" className={off ? 'pj-off' : undefined}><path d="m12 2 3 7 7.5.6-5.7 4.9 1.8 7.3L12 17.8 5.4 21.8l1.8-7.3L1.5 9.6 9 9z" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)
const HOUSE = (
  <svg className="pj-rkhs" viewBox="0 0 36 36" width="36" height="36" aria-hidden>
    <path className="pj-rkh" pathLength="1" d="M4 18 L17 6 L30 18" /><path className="pj-rkh" pathLength="1" d="M8 16 V31 H26 V16" /><path className="pj-rkh" pathLength="1" d="M14 31 V23 H20 V31" />
    <circle className="pj-rkbg" cx="29" cy="9" r="7.5" /><path className="pj-rktk" pathLength="1" d="M25.4 9.2 L28 11.8 L32.6 6.4" />
  </svg>
)

function Bars({ data }: { data: { m: string; u: number }[] }) {
  const { L } = useProApp()
  const [ref, seen] = useInView<HTMLDivElement>(0.5)
  const mx = Math.max(1, ...data.map((d) => d.u))
  return (
    <div className="pj-rkcard">
      <h3>{L('Units recovered per month', 'हर महीने वापस यूनिट')}</h3>
      <div className="pj-rkbars" ref={ref}>
        {data.map((d, k) => <Bar key={d.m + k} d={d} h={Math.max(6, (d.u / mx) * 70)} seen={seen} k={k} />)}
      </div>
    </div>
  )
}
function Bar({ d, h, seen, k }: { d: { m: string; u: number }; h: number; seen: boolean; k: number }) {
  const v = useCountTo(d.u, seen, 1100, 0, k * 160)
  return (
    <div className="pj-rkbc">
      <b className="pj-num">{v}</b>
      <i style={{ height: seen ? h : 6, transitionDelay: `${k * 0.16}s` }} />
      <span>{d.m}</span>
    </div>
  )
}

function LedgerRow({ x, i, lang }: { x: Row; i: number; lang: 'en' | 'hi' }) {
  const { L } = useProApp()
  const [ref, seen] = useInView<HTMLDivElement>(0.4)
  const [open, setOpen] = useState(false)
  const month = MO[lang][(dOff(0).getMonth() - x.ago + 12) % 12]
  return (
    <div ref={ref} className={`pj-rklg${seen ? ' pj-rkseen' : ''}${open ? ' pj-open' : ''}`} style={{ '--d': `${Math.min(i, 8) * 0.15}s` } as React.CSSProperties}>
      <button className="pj-rklgr" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`pj-rkob ${x.f ? 'pj-f' : 'pj-n'}`}>{x.f ? HOUSE : <Ic n="x" size={19} />}</span>
        <span><div className="pj-t1">{x.n}</div><div className="pj-t2">{x.c} · {month}</div></span>
        <span className="pj-r pj-num">{x.f ? `+${x.u}` : '0'}<small>{x.f ? L('units', 'यूनिट') : L('not fixed', 'ठीक नहीं')}</small></span>
      </button>
      <div className="pj-rklgx"><div>
        <dl className="pj-rklgin">
          <dt>{L('Replied in', 'जवाब में लगा')}</dt><dd>{x.r} {x.r === 1 ? L('day', 'दिन') : L('days', 'दिन')}</dd>
          <dt>{L('Outcome', 'नतीजा')}</dt><dd>{x.cl ? L('Fixed: the home owner cleaned the panels', 'ठीक: घर के मालिक ने पैनल साफ़ किए') : x.f ? L('Output back in range for 7 days', '7 दिन उत्पादन सामान्य') : L('Still low after the visit', 'विज़िट के बाद भी कम')}</dd>
          <dt>{L('Units recovered', 'वापस यूनिट')}</dt><dd>{x.u}</dd>
        </dl>
      </div></div>
    </div>
  )
}

export function RecordTab() {
  const { L, lang, jobs } = useProApp()
  const nav = useNavigate()
  const [period, setPeriod] = useState<Period>('6')
  const [filter, setFilter] = useState<Filter>('all')
  const [prevU, setPrevU] = useState(0)

  const all = recordRows(jobs)
  const rows = all.filter((x) => period === 'all' || x.ago <= 5)
  const st = recordStats(rows)
  const shown = rows.filter((x) => filter === 'all' || (filter === 'fixed' ? x.f : !x.f))
  const nf = rows.filter((x) => x.f).length
  const months = Array.from({ length: period === 'all' ? 8 : 6 }, (_, i) => (period === 'all' ? 7 : 5) - i)
  const data = months.map((ago) => ({ m: MO[lang][(dOff(0).getMonth() - ago + 12) % 12], u: rows.filter((x) => x.f && x.ago === ago).reduce((a, x) => a + x.u, 0) }))

  const [bigRef, bigSeen] = useInView<HTMLDivElement>(0.6)
  const bigF = useCountTo(st.f, bigSeen, 1200, 0)
  const [unRef, unSeen] = useInView<HTMLDivElement>(0.6)
  const un = useCountTo(st.u, unSeen, 1800, prevU)

  const pick = (p: Period) => { if (p !== period) { setPrevU(st.u); setPeriod(p); setFilter('all') } }

  return (
    <div className="pj-root">
      <h1 className="pj-h1">{L('Your record', 'आपका रिकॉर्ड')}</h1>
      <p className="pj-p pj-sub">{L('Built from jobs closed through SunProof.', 'SunProof से बंद हुए कामों से बना।')}</p>
      <div className="pj-rkseg" role="group">
        <button className={period === '6' ? 'pj-on' : ''} aria-pressed={period === '6'} onClick={() => pick('6')}>{L('6 months', '6 महीने')}</button>
        <button className={period === 'all' ? 'pj-on' : ''} aria-pressed={period === 'all'} onClick={() => pick('all')}>{L('All time', 'अब तक')}</button>
      </div>

      <div className="pj-rkc" key={`c${period}`}>
        <div className="pj-rknm">Sharma Solar Services</div>
        <div className="pj-rkbig pj-num" ref={bigRef}>{bigF}<small> {L(`of ${st.n} fixes`, `${st.n} में से सुधार`)}</small></div>
        <div className="pj-rkcap">{L('confirmed by real output data: back in range for 7 days', 'असली उत्पादन डेटा से पुष्ट: 7 दिन सामान्य रहा')}</div>
        <div className="pj-rkstars" aria-label={L('4 out of 5 stars', '5 में से 4 स्टार')}>{[0, 0, 0, 0, 1].map((o, i) => <span key={i} style={{ display: 'contents' }}>{STAR(!!o)}</span>)}</div>
        <div className="pj-rkrow">
          <div><b className="pj-num">{st.avg.toFixed(1)} {L('days', 'दिन')}</b><span>{L('avg reply', 'औसत जवाब')}</span></div>
          <div><b className="pj-num">{st.fast}%</b><span>{L('within 2 days', '2 दिन में')}</span></div>
          <div><b className="pj-num">{st.n}</b><span>{L('jobs closed', 'काम बंद')}</span></div>
        </div>
      </div>

      <div className="pj-rksec"><span className="pj-k">{L('What your visits gave back', 'आपकी विज़िट से क्या लौटा')}</span></div>
      <div className="pj-rksun" key={`s${period}`}>
        <span className="pj-rksunb" />
        <div className="pj-k">{L('Units recovered for homes', 'घरों के लिए वापस यूनिट')}</div>
        <div className="pj-rknum pj-num" ref={unRef}>{un}<small>{L('units', 'यूनिट')}</small></div>
        <div className="pj-rkeq">
          <div><b className="pj-num">{st.co2} kg</b><span>{L('CO₂ avoided', 'CO₂ बचा')}</span></div>
          <div><b className="pj-num">{st.trees}</b><span>{L('trees a year', 'पेड़ प्रति वर्ष')}</span></div>
          <div><b className="pj-num">₹{st.rs.toLocaleString('en-IN')}</b><span>{L('saved by homes', 'घरों की बचत')}</span></div>
        </div>
      </div>

      <Bars key={`b${period}`} data={data} />

      <div className="pj-rksec"><span className="pj-k">{L('Job ledger · newest first', 'काम का हिसाब · नए पहले')}</span></div>
      <div className="pj-rkchips">
        {([['all', L('All · ', 'सभी · ') + rows.length], ['fixed', L('Fixed · ', 'ठीक · ') + nf], ['not', L('Not fixed · ', 'ठीक नहीं · ') + (rows.length - nf)]] as [Filter, string][]).map(([k, l]) => (
          <button key={k} className={`pj-rkchp${filter === k ? ' pj-on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div key={`l${period}${filter}`}>
        {shown.length ? shown.map((x, i) => <LedgerRow key={x.n} x={x} i={i} lang={lang} />) : <div className="pj-rkempty">{L('No jobs here yet.', 'यहाँ अभी कोई काम नहीं।')}</div>}
      </div>
      <button className="pj-btn pj-ghost" style={{ marginTop: 6 }} onClick={() => nav('/app/home')}><Ic n="swap" size={18} />{L('Switch to home owner view', 'घर के मालिक के रूप में देखें')}</button>
      <p className="pj-p pj-foot">{L('Demo numbers from sample jobs.', 'डेमो आँकड़े, नमूना कामों से।')}</p>
    </div>
  )
}
