import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ic } from '../ic'
import { FWD, MON, MO, dOff, fd, rel, vAm } from './dates'
import { weeks, type Job } from './data'
import { useProApp } from './proCtx'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const CAR = (
  <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
    <path d="M3 15v-3l2-5h14l2 5v3a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1z" /><path d="M6.5 11h11" fill="none" />
  </svg>
)
const PIN = (
  <svg viewBox="0 0 24 30">
    <path d="M12 29S2 18.5 2 11.5a10 10 0 0 1 20 0C22 18.5 12 29 12 29z" fill="var(--pop)" stroke="var(--ink)" strokeWidth="2" />
    <circle cx="12" cy="11.5" r="3.6" fill="var(--ink)" />
  </svg>
)

/** Number that counts up on first show and whenever it changes. */
function useCount(to: number, delay = 0) {
  const [shown, setShown] = useState(reduced() ? to : 0)
  const [bump, setBump] = useState(0)
  const from = useRef(reduced() ? to : 0)
  useEffect(() => {
    const a = from.current
    if (a === to) { setShown(to); return }
    let raf = 0
    const t0 = performance.now() + delay
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / 900))
      setShown(Math.round(a + (to - a) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else { from.current = to; if (a !== 0) setBump((b) => b + 1) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, delay])
  return { shown, bump }
}

function Tile({ cls, icon, n, label, delay }: { cls: string; icon: 'sun' | 'clock' | 'search'; n: number; label: string; delay: number }) {
  const { shown, bump } = useCount(n, delay)
  return (
    <div className={`pj-tl3 pj-${cls}`}>
      <span className="pj-ti"><Ic n={icon} size={16} /></span>
      <b key={bump} className={`pj-num${bump ? ' pj-vbump' : ''}`}>{shown}</b>
      <span className="pj-l">{label}</span>
    </div>
  )
}

/** Booked, On site, Fix check, Fixed: the line fills as the visit moves along. */
function JourneyBar({ stage, f = 0, car, pin }: { stage: number; f?: number; car?: boolean; pin?: boolean }) {
  const { L } = useProApp()
  const names = [L('Booked', 'तय'), L('On site', 'साइट पर'), L('Fix check', 'जाँच'), L('Fixed', 'ठीक')]
  return (
    <>
      <div className="pj-jbar">
        {names.map((_, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span className="pj-jmb"><i style={{ '--f': stage > i - 1 ? 1 : stage === i - 1 ? f : 0 } as CSSProperties} /></span>}
            <span key={`${i}${stage}`} className={`pj-jms${i < stage ? ' pj-d' : i === stage ? ' pj-c pj-pop' : ''}`} />
          </span>
        ))}
        <span key={`r${pin ? 1 : 0}`} className={`pj-vrip${pin ? ' pj-go' : ''}`} />
        <span key={`r2${pin ? 1 : 0}`} className={`pj-vrip pj-b${pin ? ' pj-go' : ''}`} />
        <span className={`pj-vcar${car ? ' pj-on' : ''}`} style={{ '--i': stage, '--f': f } as CSSProperties}>{CAR}</span>
        <span className={`pj-vpin${pin ? ' pj-on' : ''}`}>{PIN}</span>
      </div>
      <div className="pj-jminil">{names.map((n) => <span key={n}>{n}</span>)}</div>
    </>
  )
}

function Steps({ c, dots, bars }: { c: number; dots?: number; bars?: number }) {
  const { L } = useProApp()
  const names = [L('Booked', 'तय'), L('On site', 'साइट पर'), L('Fix check', 'जाँच'), L('Fixed', 'ठीक')]
  const anim = dots !== undefined
  return (
    <div className="pj-jsteps">
      {names.map((t, i) => {
        const cl = anim ? (i < dots ? 'pj-d' : i === dots ? 'pj-c' : '') : i < c ? 'pj-d' : i === c ? 'pj-c' : ''
        const done = anim ? i < dots : i < c
        const fill = anim ? (i > 0 && i - 1 < (bars ?? 0) ? 1 : 0) : i > 0 && i <= c ? 1 : 0
        return (
          <span key={t} style={{ display: 'contents' }}>
            {i > 0 && <span className="pj-jsb"><i style={{ '--f': fill } as CSSProperties} /></span>}
            <div className={`pj-jst ${cl}${anim && i === dots ? ' pj-pop' : ''}`}><i>{done && <Ic n="check" size={13} />}</i>{t}</div>
          </span>
        )
      })}
    </div>
  )
}

const Boxes = ({ n }: { n: number }) => <div className="pj-jbox">{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < n ? 'pj-f' : ''} />)}</div>
const drive = (a: Job, b: Job) => { let n = 0; for (const ch of a.city + b.city) n += ch.charCodeAt(0); return 25 + (n % 25) }

export function VisitsTab() {
  const { L, lang, jobs, tripOf, tripNext, doneProg, say } = useProApp()
  const nav = useNavigate()
  const journeyRef = useRef<HTMLDivElement>(null)

  const visits = jobs.filter((j) => j.state === 'visit' && j.visit).sort((a, b) => a.visit!.o - b.visit!.o || a.visit!.t.localeCompare(b.visit!.t))
  const chk = jobs.filter((j) => j.state === 'check'), fixed = jobs.filter((j) => j.state === 'fixed')
  const groups = new Map<number, Job[]>()
  visits.forEach((j) => groups.set(j.visit!.o, [...(groups.get(j.visit!.o) ?? []), j]))
  const keys = [...groups.keys()].sort((a, b) => a - b)
  const d = dOff(0)
  const nToday = groups.get(0)?.length ?? 0, nTom = groups.get(1)?.length ?? 0

  const animating = doneProg?.id
  useEffect(() => {
    if (animating) journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [animating])

  const card = (j: Job, first: boolean) => {
    const today = j.visit!.o === 0
    const tr = tripOf(j.id)
    const pillText = today ? (tr.s === 0 ? L('Up next', 'अगला') : tr.s === 1 ? (tr.driving ? L(`On the way · ${tr.mins} min`, `रास्ते में · ${tr.mins} मिनट`) : L('On the way', 'रास्ते में')) : L('On site', 'साइट पर')) : L('Booked', 'तय')
    const btn = tr.s === 0 ? { icon: 'car' as const, text: L('On my way', 'मैं निकल गया'), dk: true }
      : tr.s === 1 ? (tr.driving ? { icon: 'car' as const, text: L('Driving…', 'चल रहा है…'), dk: true } : { icon: 'nav' as const, text: L('I\'m here', 'मैं पहुँच गया'), dk: true })
      : tr.driving ? { icon: 'nav' as const, text: L('I\'m here', 'मैं पहुँच गया'), dk: true } : { icon: 'check' as const, text: L('Mark visit done', 'विज़िट पूरी हुई'), dk: false }
    return (
      <div className={`pj-vstop${today && first ? ' pj-next' : ''}`}>
        <div className="pj-vtm pj-num">{j.visit!.t}<small>{vAm(j.visit!.t)}</small></div>
        <div className="pj-vdot" />
        <div className="pj-vc">
          <button className="pj-vhead" onClick={() => nav(`/pro/jobs/${j.id}`)}>
            <div className="pj-sp"><div className="pj-t1">{j.name}</div><div className="pj-t2">{j.kw} kW · {j.city}</div></div>
            <span className={`pj-pill${today && tr.s === 1 ? ' pj-live' : ''}`}>{pillText}</span>
          </button>
          <div className="pj-ln">{L(`${j.pct}% less for ${weeks(j)} ${weeks(j) === 1 ? 'week' : 'weeks'} · `, `${j.pct}% कम, ${weeks(j)} ${weeks(j) === 1 ? 'हफ़्ता' : 'हफ़्ते'} से · `)}<b>{L(`${j.units} units lost`, `${j.units} यूनिट गए`)}</b></div>
          <JourneyBar stage={today && tr.s === 2 ? 1 : 0} f={today && tr.s === 1 ? tr.f : 0} car={today && tr.s === 1} pin={today && tr.s === 2} />
          {today && (
            <div className="pj-vacts">
              <button className="pj-vgo pj-gh" aria-label={L('Call', 'कॉल')} onClick={() => say(L(`Calling ${j.name}…`, `${j.name} को कॉल हो रहा है…`))}><Ic n="phone" size={17} /></button>
              <button key={`${tr.s}${tr.driving}`} className={`pj-vgo${btn.dk ? ' pj-dk' : ''} pj-vswap`} disabled={tr.driving} onClick={() => tripNext(j.id)}><Ic n={btn.icon} size={18} />{btn.text}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const journey = (j: Job) => {
    const anim = doneProg?.id === j.id
    const isChk = j.state === 'check'
    return (
      <div className={`pj-vjr${anim ? ' pj-vfx' : ''}`} key={j.id} ref={anim ? journeyRef : undefined}>
        <button className="pj-vhead" onClick={() => nav(`/pro/jobs/${j.id}`)}>
          <div className="pj-sp"><div className="pj-t1">{j.name}</div><div className="pj-t2">{j.kw} kW · {j.city}</div></div>
          <span className="pj-pill pj-ok">{isChk ? L(`Day ${j.day} of 7`, `दिन ${j.day} / 7`) : L('Fixed', 'ठीक हुआ')}</span>
        </button>
        {isChk ? <><Steps c={2} dots={anim ? doneProg!.dots : undefined} bars={anim ? doneProg!.bars : undefined} /><Boxes n={j.day} /></> : <Steps c={4} />}
        {!isChk && <div className="pj-t2" style={{ marginTop: 6 }}><b style={{ color: 'var(--ink)' }}>{L(`${j.rec} units recovered`, `${j.rec} यूनिट वापस`)}</b> · {L('output back in range', 'उत्पादन सामान्य')}</div>}
      </div>
    )
  }

  return (
    <div className="pj-root">
      <div className="pj-vttl">
        <h1 className="pj-h1" style={{ margin: 0 }}>{L('Visits', 'विज़िट')}</h1>
        <div className="pj-dchip">
          <div className="pj-dleaf"><i>{MO[lang][d.getMonth()].toUpperCase()}</i><b>{d.getDate()}</b></div>
          <div className="pj-dtxt">{FWD[lang][d.getDay()]}<small>{d.getDate()} {MON[lang][d.getMonth()]} {d.getFullYear()}</small></div>
        </div>
      </div>
      <div className="pj-tiles3">
        <Tile cls="t-today" icon="sun" n={nToday} label={L('today', 'आज')} delay={150} />
        <Tile cls="t-tom" icon="clock" n={nTom} label={L('tomorrow', 'कल')} delay={310} />
        <Tile cls="t-fix" icon="search" n={chk.length} label={L('fix checks', 'जाँच जारी')} delay={470} />
      </div>
      {keys.map((k) => {
        const arr = groups.get(k)!
        return (
          <div key={k}>
            <div className="pj-vdayh"><span className="pj-k">{rel(k, lang)}{k > 1 ? '' : ` · ${fd(k, lang)}`}</span>{k === 0 && <span className="pj-pill">{L(`${arr.length} left`, `${arr.length} बाकी`)}</span>}</div>
            <div className="pj-vtl">
              {arr.map((j, i) => (
                <div key={j.id}>
                  {i > 0 && <div className="pj-vdrive"><Ic n="car" size={14} />{L(`about ${drive(arr[i - 1], j)} min drive`, `लगभग ${drive(arr[i - 1], j)} मिनट का सफ़र`)}</div>}
                  {card(j, i === 0)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {!keys.length && (
        <>
          <div className="pj-vdayh"><span className="pj-k">{L('Today', 'आज')}</span><span className="pj-pill pj-ok">{L('All done', 'सब हो गया')}</span></div>
          <div className="pj-vempty">{L('No visits booked. Reply to a job with “Book a visit” and it shows up here.', 'कोई विज़िट तय नहीं। किसी काम पर “विज़िट तय करें” दबाएँ, वह यहाँ दिखेगा।')}</div>
        </>
      )}
      <div className="pj-vdayh"><span className="pj-k">{L('After the visit · SunProof is checking', 'विज़िट के बाद · SunProof जाँच रहा है')}</span></div>
      {chk.length ? chk.map(journey) : <div className="pj-vempty">{L('Visits you finish appear here for the 7-day fix check.', 'पूरी की गई विज़िट यहाँ 7 दिन की जाँच के लिए दिखेंगी।')}</div>}
      {fixed.length > 0 && <><div className="pj-vdayh"><span className="pj-k">{L('Done', 'पूरा')}</span></div>{fixed.map(journey)}</>}
    </div>
  )
}
