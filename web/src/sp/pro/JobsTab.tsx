import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ic } from '../ic'
import { MON, WD, dOff, fd, rel } from './dates'
import { order, st, sur, weeks, type Job } from './data'
import { Ico, Ring } from './parts'
import { useProApp } from './proCtx'

type Ev = { k: 'od' | 'due' | 'visit' | 'chk'; j: Job; w: number; t?: string; later?: boolean }
type Filter = 'reply' | 'visit' | 'check' | 'fixed' | null

const wkText = (j: Job, L: (a: string, b: string) => string) => {
  const n = weeks(j)
  return `${n} ${n === 1 ? L('week', 'हफ़्ता') : L('weeks', 'हफ़्ते')}`
}

export function JobsTab() {
  const { L, lang, glow, jobs, startFx } = useProApp()
  const nav = useNavigate()
  const [cal, setCal] = useState(0)
  const [filter, setFilter] = useState<Filter>(null)
  const strip = useRef<HTMLDivElement>(null)

  const isRep = (j: Job) => { const s = st(j); return s === 'overdue' || s === 'reply' }
  const evs = (o: number): Ev[] => {
    const a: Ev[] = []
    jobs.forEach((j) => {
      const s = st(j)
      if (s === 'overdue' && o === 0) a.push({ k: 'od', j, w: 0 })
      else if (s === 'reply' && j.due === o) a.push({ k: 'due', j, w: 2 })
      else if (s === 'visit' && j.visit?.o === o) a.push({ k: 'visit', j, w: 1, t: j.visit.t })
      else if (s === 'check' && 7 - j.day === o) a.push({ k: 'chk', j, w: 3 })
    })
    return a.sort((x, y) => x.w - y.w || (x.t ?? '').localeCompare(y.t ?? ''))
  }
  const later: Ev[] = jobs.filter((j) => j.state === 'visit' && j.visit && j.visit.o > 0)
    .sort((a, b) => a.visit!.o - b.visit!.o || a.visit!.t.localeCompare(b.visit!.t))
    .map((j) => ({ k: 'visit' as const, j, w: 1, t: j.visit!.t, later: true }))

  const counts = { reply: 0, visit: 0, check: 0, fixed: 0 }
  jobs.forEach((j) => { let s = st(j); if (s === 'overdue') s = 'reply'; if (s in counts) counts[s as keyof typeof counts]++ })
  const list = [...jobs].sort((a, b) => order(a) - order(b))

  const chip = (e: Ev) => {
    const n = sur(e.j)
    if (e.k === 'visit') return ['cv', `${n} ${e.t}`]
    if (e.k === 'due') return ['cd', L(`Reply · ${n}`, `जवाब · ${n}`)]
    if (e.k === 'od') return ['co', L(`Overdue · ${n}`, `देर · ${n}`)]
    return ['cc', L(`Fix result · ${n}`, `जाँच नतीजा · ${n}`)]
  }

  const dayTile = (o: number) => {
    const d = dOff(o), es = evs(o), sel = cal === o, wkend = d.getDay() === 0 || d.getDay() === 6
    const chips = es.slice(0, 2)
    return (
      <button key={o} className={`pj-dt${sel ? ' pj-sel' : ''}${o === 0 ? ' pj-today' : ''}${wkend ? ' pj-wk' : ''}`} aria-pressed={sel}
        aria-label={`${fd(o, lang)}, ${es.length} ${L('items', 'काम')}`} onClick={() => setCal(o)}>
        <span className="pj-dw">{o === 0 ? L('TODAY', 'आज') : WD[lang][d.getDay()].toUpperCase()}</span>
        <span className="pj-dn pj-num">{d.getDate()}</span>
        <span className="pj-dc">
          {chips.length ? chips.map((e, i) => { const [c, t] = chip(e); return <span key={i} className={`pj-evc pj-${c}`}>{t}</span> }) : <span className="pj-evn">·</span>}
          {es.length > 2 && <span className="pj-evm">+{es.length - 2} {L('more', 'और')}</span>}
          {o === 0 && later.length > 0 && <span className="pj-evm">+{later.length} {L('visit later', 'विज़िट आगे')}</span>}
        </span>
      </button>
    )
  }

  const agendaItem = (e: Ev, key: string) => {
    const j = e.j
    let ico, title, sub, btn
    if (e.k === 'visit') {
      ico = <Ico s="visit" />
      title = L(`Visit · ${j.name}`, `विज़िट · ${j.name}`)
      sub = `${e.later ? `${rel(j.visit!.o, lang)}, ${e.t} · ` : ''}${j.kw} kW · ${j.city}${e.later ? '' : ` · ${e.t}`}`
      btn = j.visit!.o === 0
        ? <button className="pj-btn pj-mini" onClick={() => startFx('done', j.id)}>{L('Mark done', 'पूरी हुई')}</button>
        : <button className="pj-btn pj-ghost pj-mini" onClick={() => nav(`/pro/jobs/${j.id}`)}>{L('Open', 'खोलें')}</button>
    } else if (e.k === 'due' || e.k === 'od') {
      ico = <Ring d={Math.max(0, j.due)} bad={e.k === 'od'} />
      title = L(`Reply to ${j.name}`, `${j.name} को जवाब दें`)
      sub = e.k === 'od' ? L(`Overdue by ${-j.due} day · ${j.pct}% less`, `देरी ${-j.due} दिन · ${j.pct}% कम`) : L(`Reply by ${fd(j.due, lang)} · ${j.pct}% less`, `${fd(j.due, lang)} तक जवाब · ${j.pct}% कम`)
      btn = <button className="pj-btn pj-mini" onClick={() => nav(`/pro/jobs/${j.id}`, { state: { reply: true } })}>{L('Reply', 'जवाब दें')}</button>
    } else {
      ico = <Ico s="check" />
      title = L(`Fix result · ${j.name}`, `जाँच नतीजा · ${j.name}`)
      sub = L('Closes as fixed if output stays in range', 'सामान्य रहा तो ठीक मान लिया जाएगा')
      btn = <button className="pj-btn pj-ghost pj-mini" onClick={() => nav(`/pro/jobs/${j.id}`)}>{L('Open', 'खोलें')}</button>
    }
    return <div className="pj-ai" key={key}>{ico}<div className="pj-sp"><div className="pj-t1" style={{ fontWeight: 700 }}>{title}</div><div className="pj-t2 pj-mut">{sub}</div></div>{btn}</div>
  }

  const agenda = () => {
    const es = evs(cal).filter((e) => e.k !== 'od'), lv = cal === 0 ? later : []
    return (
      <div className="pj-agenda" key={cal}>
        <div className="pj-ah"><b>{(cal < 2 ? `${rel(cal, lang)} · ` : '') + fd(cal, lang)}</b></div>
        {!es.length
          ? <div className="pj-ag0"><Ic n="sun" size={22} /><span>{cal === 0 ? L('No visits left today.', 'आज कोई विज़िट बाकी नहीं।') : L('Nothing scheduled. A free day.', 'कुछ तय नहीं। आज छुट्टी।')}</span></div>
          : es.map((e, i) => agendaItem(e, `a${i}`))}
        {lv.length > 0 && (
          <>
            <div className="pj-ah" style={{ marginTop: 12 }}><b>{L('Coming up', 'आगे')}</b><span>{L(`${lv.length} ${lv.length === 1 ? 'visit' : 'visits'}`, `${lv.length} विज़िट`)}</span></div>
            {lv.map((e, i) => agendaItem(e, `l${i}`))}
          </>
        )}
      </div>
    )
  }

  const replyCard = (j: Job) => {
    const od = st(j) === 'overdue'
    return (
      <div className={`pj-rcard${od ? ' pj-od' : ''}${glow === j.id ? ' pj-new' : ''}`} key={j.id}>
        <button className="pj-rmain" onClick={() => nav(`/pro/jobs/${j.id}`)}>
          <div className="pj-row">
            <Ring d={Math.max(0, j.due)} bad={od} />
            <div className="pj-sp">
              <div className="pj-t1">{j.name}<span className="pj-t2"> · {j.kw} kW · {j.city}</span></div>
              <div className="pj-t2">{od ? <span style={{ color: 'var(--bad)', fontWeight: 700 }}>{L(`Overdue by ${-j.due} day`, `देरी ${-j.due} दिन`)}</span> : L(`Reply by ${fd(j.due, lang)} · ${j.due} days left`, `${fd(j.due, lang)} तक · ${j.due} दिन बाकी`)}</div>
            </div>
          </div>
          <div className="pj-rline">{L(`${j.pct}% less for ${wkText(j, L)} · ${j.units} units lost`, `${j.pct}% कम, ${wkText(j, L)} से · ${j.units} यूनिट गए`)}</div>
        </button>
        <button className="pj-btn pj-mini" onClick={() => nav(`/pro/jobs/${j.id}`, { state: { reply: true } })}>{L('Reply', 'जवाब दें')}</button>
      </div>
    )
  }

  const homeRow = (j: Job) => {
    const s = st(j)
    let w1 = '', w2 = ''
    if (s === 'visit') { w1 = rel(j.visit!.o, lang); w2 = j.visit!.t }
    else if (s === 'check') { w1 = L(`Day ${j.day}`, `दिन ${j.day}`); w2 = L('of 7', '/ 7') }
    else if (s === 'fixed') { w1 = L('Fixed', 'ठीक हुआ'); w2 = L(`${j.rec} units back`, `${j.rec} यूनिट वापस`) }
    else { w1 = L('Closed', 'बंद') }
    return (
      <div className="pj-aitem" key={j.id}>
        <button className="pj-arow" onClick={() => nav(`/pro/jobs/${j.id}`)}>
          <Ico s={s} />
          <div className="pj-sp"><div className="pj-t1">{j.name}</div><div className="pj-t2">{j.kw} kW · {j.city}</div></div>
          <div className="pj-when"><b>{w1}</b>{w2}</div>
          <span className="pj-chv"><Ic n="chevron-right" size={16} /></span>
        </button>
      </div>
    )
  }

  const reps = list.filter(isRep)
  const replySection = (
    <>
      <div className="pj-sech"><span className="pj-k">{L('Needs your reply', 'जवाब चाहिए')}</span><span className={`pj-cnt${reps.length ? ' pj-hot' : ''}`}>{reps.length}</span></div>
      {reps.length ? <>{reps.map(replyCard)}<div style={{ height: 8 }} /></> : <div className="pj-card pj-ag0" style={{ marginBottom: 14 }}><Ic n="check" size={22} /><span>{L('All replies sent. Nice.', 'सभी जवाब भेजे जा चुके हैं।')}</span></div>}
    </>
  )

  const sc = (k: Exclude<Filter, null>, l: string, n: number, hot?: boolean) => (
    <button key={k} className={`pj-sc${hot && n ? ' pj-hot' : ''}${filter === k ? ' pj-on' : ''}`} onClick={() => setFilter(filter === k ? null : k)}><b className="pj-num">{n}</b> {l}</button>
  )

  const month = dOff(cal)
  const scroll = (dx: number) => strip.current?.scrollBy({ left: dx, behavior: 'smooth' })

  let body
  if (filter) {
    const rows = list.filter((j) => { let s = st(j); if (s === 'overdue') s = 'reply'; return s === filter })
    body = (
      <>
        <div className="pj-sech"><span className="pj-k">{L('Filtered', 'फ़िल्टर')}</span><button className="pj-sm" style={{ fontWeight: 700 }} onClick={() => setFilter(null)}>{L('Show all', 'सब दिखाएँ')}</button></div>
        {rows.map((j) => (isRep(j) ? replyCard(j) : homeRow(j)))}
      </>
    )
  } else {
    body = (
      <>
        {replySection}
        {agenda()}
        <div className="pj-sech"><span className="pj-k">{L('Other homes', 'बाकी घर')}</span><span className="pj-sm pj-mut">{L('Tap a home for details', 'विवरण के लिए घर दबाएँ')}</span></div>
        {list.filter((j) => !isRep(j)).map(homeRow)}
      </>
    )
  }

  return (
    <div className="pj-root">
      <h1 className="pj-h1">{L('Namaste, Installer 👋', 'नमस्ते, इंस्टॉलर 👋')}</h1>
      <div className="pj-cal">
        <div className="pj-calh">
          <div><span className="pj-k">{L('Schedule', 'कार्यक्रम')}</span><b>{MON[lang][month.getMonth()]} {month.getFullYear()}</b></div>
          <div className="pj-calnav">
            <button aria-label={L('Earlier days', 'पहले के दिन')} onClick={() => scroll(-222)}><Ic n="chevron-left" size={15} /></button>
            <button onClick={() => { setCal(0); strip.current?.scrollTo({ left: 0, behavior: 'smooth' }) }}>{L('Today', 'आज')}</button>
            <button aria-label={L('Later days', 'आगे के दिन')} onClick={() => scroll(222)}><Ic n="chevron-right" size={15} /></button>
          </div>
        </div>
        <div className="pj-calstrip" ref={strip}>{Array.from({ length: 14 }, (_, o) => dayTile(o))}</div>
      </div>
      <div className="pj-strip">
        {sc('reply', L('need reply', 'जवाब चाहिए'), counts.reply, true)}{sc('visit', L('visits', 'विज़िट'), counts.visit)}
        {sc('check', L('checking', 'जाँच'), counts.check)}{sc('fixed', L('fixed', 'ठीक'), counts.fixed)}
      </div>
      {body}
    </div>
  )
}
