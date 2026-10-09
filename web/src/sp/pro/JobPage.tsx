import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Ic } from '../ic'
import { fd, rel } from './dates'
import { probStart, st, weeks, type Ev, type Job } from './data'
import { evsOf } from './live'
import { useStLabel } from './labels'
import { JobChart, Ring } from './parts'
import { useProApp } from './proCtx'

const TIMES = ['09:00', '11:00', '14:00', '16:00']

function evText(L: (a: string, b: string) => string, lang: 'en' | 'hi', e: Ev) {
  switch (e.k) {
    case 'sent': return L('Evidence pack sent to you', 'सबूत का पैकेट आपको भेजा गया')
    case 'rem': return L('Reminder sent to you', 'आपको याद दिलाया गया')
    case 'book': return L(`You booked a visit for ${fd(e.v ?? 0, lang)}, ${e.t}`, `आपने विज़िट तय की: ${fd(e.v ?? 0, lang)}, ${e.t}`)
    case 'remote': return L('You replied: fixed remotely', 'आपका जवाब: दूर से ठीक किया')
    case 'vdone': return L('Visit marked done', 'विज़िट पूरी हुई')
    case 'closed': return L('You replied: not a system issue', 'आपका जवाब: सिस्टम की समस्या नहीं')
    case 'check': return L('SunProof is checking 7 days of output', 'SunProof 7 दिन का उत्पादन जाँच रहा है')
    case 'fixed': return L('Fixed: output back in range', 'ठीक: उत्पादन सामान्य')
    case 'cleaned': return L('Fixed: the home owner cleaned the panels', 'ठीक: घर के मालिक ने पैनल साफ़ किए')
  }
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="pj-veil pj-root" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pj-sheet" role="dialog" aria-modal="true"><div className="pj-grab" />{children}</div>
    </div>
  )
}

function BookSheet({ j, onClose }: { j: Job; onClose: () => void }) {
  const { L, lang, startFx } = useProApp()
  const [date, setDate] = useState(1)
  const [time, setTime] = useState('11:00')
  return (
    <Sheet onClose={onClose}>
      <h2 className="pj-h2">{L(`Book a visit to ${j.name}`, `${j.name} के यहाँ विज़िट तय करें`)}</h2>
      <p className="pj-p pj-sm pj-mut" style={{ marginTop: 2 }}>{L('They see the date in their app.', 'उन्हें तारीख उनके ऐप में दिखेगी।')}</p>
      <div className="pj-k" style={{ marginTop: 14 }}>{L('Day', 'दिन')}</div>
      <div className="pj-chips">{[0, 1, 2, 3].map((o) => <button key={o} className={`pj-ch${date === o ? ' pj-on' : ''}`} aria-pressed={date === o} onClick={() => setDate(o)}>{rel(o, lang)}</button>)}</div>
      <div className="pj-k">{L('Time', 'समय')}</div>
      <div className="pj-chips">{TIMES.map((t) => <button key={t} className={`pj-ch pj-num${time === t ? ' pj-on' : ''}`} aria-pressed={time === t} onClick={() => setTime(t)}>{t}</button>)}</div>
      <button className="pj-btn" onClick={() => { onClose(); startFx('book', j.id, { o: date, t: time }) }}>{L(`Confirm visit · ${rel(date, lang)}, ${time}`, `विज़िट पक्की · ${rel(date, lang)}, ${time}`)}</button>
    </Sheet>
  )
}

function NoteSheet({ j, onClose }: { j: Job; onClose: () => void }) {
  const { L, startFx } = useProApp()
  const [reason, setReason] = useState('dust')
  const [note, setNote] = useState('')
  const rs: [string, string][] = [['dust', L('Dust or shade', 'धूल या छाँव')], ['weather', L('Normal weather dip', 'मौसम का सामान्य असर')], ['meter', L('Meter or billing', 'मीटर या बिल')], ['other', L('Something else', 'कुछ और')]]
  return (
    <Sheet onClose={onClose}>
      <h2 className="pj-h2">{L('Not a system issue', 'सिस्टम की समस्या नहीं')}</h2>
      <p className="pj-p pj-sm pj-mut" style={{ marginTop: 2 }}>{L(`${j.name} is pointed to the Cleaning tab.`, `${j.name} को सफ़ाई टैब पर भेजा जाएगा।`)}</p>
      <div className="pj-k" style={{ marginTop: 14 }}>{L('What do you think it is?', 'आपको क्या लगता है?')}</div>
      <div className="pj-chips">{rs.map(([k, l]) => <button key={k} className={`pj-ch${reason === k ? ' pj-on' : ''}`} aria-pressed={reason === k} onClick={() => setReason(k)}>{l}</button>)}</div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={L('Add a short note (optional)', 'छोटा नोट जोड़ें (वैकल्पिक)')} />
      <button className="pj-btn" onClick={() => { onClose(); startFx('notsys', j.id, { note: [rs.find(([k]) => k === reason)?.[1], note].filter(Boolean).join(': ') }) }}>{L('Send reply', 'जवाब भेजें')}</button>
    </Sheet>
  )
}

export function JobPage() {
  const { id } = useParams()
  const { L, lang, jobs, live, details, loadDetail, startFx, fastForward } = useProApp()
  const label = useStLabel()
  const nav = useNavigate()
  const loc = useLocation()
  const [sheet, setSheet] = useState<'book' | 'note' | null>(null)
  const j = jobs.find((x) => x.id === id)
  const detail = j?.real ? details[j.id] : undefined
  const jState = j?.state
  const jDay = j?.day
  const focusReply = !!(loc.state as { reply?: boolean } | null)?.reply

  useEffect(() => { if (id && jState && details && jobs.find((x) => x.id === id)?.real) loadDetail(id) }, [id, jState, jDay]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (!focusReply) return
    const t = window.setTimeout(() => {
      const rc = document.getElementById('pj-replycard')
      if (rc) { rc.scrollIntoView({ behavior: 'smooth', block: 'center' }); rc.classList.add('pj-pulse') }
    }, 380)
    return () => clearTimeout(t)
  }, [id, focusReply])

  // A job that is not in the list yet: wait for the backend (it may be slow or briefly unreachable) before giving up on the link.
  if (!j) return live === true ? <Navigate to="/pro/jobs" replace /> : <div className="pj-root pj-sm pj-mut" style={{ padding: 24 }}>{L('Loading…', 'लोड हो रहा है…')}</div>
  const s = st(j), can = s === 'reply' || s === 'overdue'
  const wk = `${weeks(j)} ${weeks(j) === 1 ? L('week', 'हफ़्ता') : L('weeks', 'हफ़्ते')}`

  const top = () => {
    if (can) {
      const od = s === 'overdue'
      return (
        <div className={`pj-hero${od ? ' pj-bad' : ''}`}>
          <div className="pj-row"><Ring d={j.due} bad={od} /><div className="pj-sp"><div className="pj-big pj-num">{od ? L('Overdue', 'देर हो गई') : L(`${j.due} days left`, `${j.due} दिन बाकी`)}</div><div className="pj-sm pj-mut">{od ? L(`Was due ${fd(j.due, lang)}`, `${fd(j.due, lang)} तक थी`) : L(`Reply by ${fd(j.due, lang)}`, `${fd(j.due, lang)} तक जवाब दें`)}</div></div></div>
          <p className="pj-p pj-sm" style={{ marginTop: 10 }}>{od ? L('The home owner can now file a complaint. A reply still gets recorded.', 'अब घर के मालिक शिकायत कर सकते हैं। फिर भी आपका जवाब दर्ज होगा।') : L(`If there is no reply by then, ${j.name} gets a complaint draft to file.`, `तब तक जवाब न मिला तो ${j.name} को शिकायत का मसौदा मिलेगा।`)}</p>
        </div>
      )
    }
    if (s === 'visit') return (
      <div className="pj-hero pj-visit">
        <div className="pj-row"><div className="pj-ico pj-visit" style={{ background: 'var(--card)' }}><Ic n="calendar" size={22} /></div><div className="pj-sp"><div className="pj-big">{rel(j.visit!.o, lang)}, {j.visit!.t}</div><div className="pj-sm pj-mut">{L('Visit booked', 'विज़िट तय')}</div></div></div>
        <div style={{ marginTop: 12 }}><button className="pj-btn" onClick={() => startFx('done', j.id)}><Ic n="check" size={18} />{L('Mark visit done', 'विज़िट पूरी हुई')}</button></div>
        <p className="pj-p pj-sm pj-mut" style={{ marginTop: 8 }}>{L('This starts the 7-day fix check.', 'इससे 7 दिन की जाँच शुरू होती है।')}</p>
      </div>
    )
    if (s === 'check') return (
      <div className="pj-hero pj-check">
        <div className="pj-big">{j.failed ? L("The fix didn't hold", 'सुधार टिका नहीं') : L(`Checking the fix · day ${j.day} of 7`, `जाँच जारी · दिन ${j.day} / 7`)}</div>
        {!j.failed && <div className="pj-boxes pj-big" style={{ marginTop: 12 }}>{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < j.day ? 'pj-f' : ''}>{i < j.day && <Ic n="check" size={15} />}</i>)}</div>}
        <p className="pj-p pj-sm" style={{ marginTop: 10 }}>{L('SunProof compares each day with the expected range. If all 7 are back in range, the job closes as fixed.', 'SunProof हर दिन को अपेक्षित सीमा से मिलाता है। 7 दिन सामान्य रहे तो काम ठीक हो जाता है।')}</p>
        {j.failed
          ? <p className="pj-p pj-sm" style={{ marginTop: 10 }}>{L('Output fell again, so the check stopped. The home owner has been told what to try, and may ask you to come back.', 'उत्पादन फिर गिरा, इसलिए जाँच रुक गई। घर के मालिक को आज़माने के सुझाव मिले हैं, वे आपको दोबारा बुला सकते हैं।')}</p>
          : <button className="pj-demo" onClick={() => fastForward(j.id)}>{j.real ? L('Demo: next day', 'डेमो: अगला दिन') : L('Demo: fast-forward to day 7', 'डेमो: सीधे दिन 7 पर जाएँ')}</button>}
      </div>
    )
    if (s === 'fixed') return (
      <div className="pj-hero pj-ok">
        <div className="pj-row"><div className="pj-ico pj-fixed" style={{ background: 'var(--card)' }}><Ic n="check" size={24} /></div><div className="pj-sp"><div className="pj-big">{L('Fixed', 'ठीक हुआ')}</div><div className="pj-sm">{j.cleaned ? L('The home owner cleaned the panels and output is back. Dust was the cause.', 'घर के मालिक ने पैनल साफ़ किए और उत्पादन लौट आया। कारण धूल थी।') : L('Output has been back in range for 7 days.', 'उत्पादन 7 दिन से सामान्य है।')}</div></div></div>
        <div className="pj-facts">
          <div className="pj-fact"><b className="pj-num" style={{ color: 'var(--ok)' }}>{j.rec}</b><span>{L('units recovered', 'यूनिट वापस')}</span></div>
          <div className="pj-fact"><b className="pj-num" style={{ color: 'var(--ok)' }}>₹{j.recRs ?? Math.round(j.rec * 8)}</b><span>{L('saved', 'बचे')}</span></div>
          <div className="pj-fact"><b className="pj-num" style={{ color: 'var(--ok)' }}>{Math.round(j.rec * 0.705 * 10) / 10}</b><span>kg CO₂</span></div>
        </div>
      </div>
    )
    return (
      <div className="pj-hero"><div className="pj-big">{L('Closed', 'बंद')}</div><p className="pj-p pj-sm pj-mut" style={{ marginTop: 4 }}>{L(`You said this is not a system issue. ${j.name} is pointed to the Cleaning tab.`, `आपने कहा सिस्टम की समस्या नहीं है। ${j.name} को सफ़ाई टैब पर भेजा गया।`)}</p></div>
    )
  }

  const rows: [string, string][] = [
    [L('System', 'सिस्टम'), `${j.kw} kW ${L('rooftop', 'रूफटॉप')}`], [L('Location', 'जगह'), j.city], [L('Problem started', 'समस्या शुरू'), probStart(j, lang)],
    [L('Lost so far', 'अब तक का नुकसान'), `${j.units} ${L('units', 'यूनिट')}`], [L('Likely cause', 'संभावित कारण'), L('System issue: inverter, wiring or panels', 'सिस्टम की समस्या: इन्वर्टर, वायरिंग या पैनल')],
  ]
  if (s === 'visit') rows.push([L('Visit', 'विज़िट'), `${rel(j.visit!.o, lang)}, ${j.visit!.t}`])
  if (s === 'fixed') rows.push([L('Recovered', 'वापस मिला'), `${j.rec} ${L('units', 'यूनिट')}`])

  return (
    <div className="pj-root pj-jpage pj-jin">
      <button className="pj-back" onClick={() => nav('/pro/jobs')}><Ic n="chevron-left" size={18} />{L('Jobs', 'काम')}</button>
      <div className="pj-row" style={{ margin: '8px 0 12px' }}>
        <div className="pj-sp"><h1 className="pj-h1" style={{ margin: 0 }}>{j.name}</h1><div className="pj-sub">{j.kw} kW · {j.city}</div></div>
        <span className={`pj-pill pj-${s}`}>{label(s)}</span>
      </div>
      {top()}
      <div className="pj-card">
        <h2 className="pj-h2">{L('What SunProof saw', 'SunProof ने क्या देखा')}</h2>
        <p className="pj-p pj-sm" style={{ marginTop: 6 }}>{detail ? `${detail.summary} ${detail.likelyCause}` : L(`Output has been about ${j.pct}% below the expected range for ${wk}. It looks like something at the system (inverter, wiring or panels), worth checking on site.`, `उत्पादन ${wk} से अपेक्षित सीमा से करीब ${j.pct}% कम है। सिस्टम में कुछ गड़बड़ लगती है (इन्वर्टर, वायरिंग या पैनल), मौके पर जाँचने लायक।`)}</p>
        <JobChart j={j} detail={detail} />
        <div className="pj-facts">
          <div className="pj-fact"><b className="pj-num">{j.pct}%</b><span>{L('less', 'कम')}</span></div>
          <div className="pj-fact"><b className="pj-num">{weeks(j)}</b><span>{L('weeks', 'हफ़्ते')}</span></div>
          <div className="pj-fact"><b className="pj-num">{j.units}</b><span>{L('units lost', 'यूनिट गए')}</span></div>
        </div>
      </div>
      <div className="pj-card"><h2 className="pj-h2">{L('Details', 'विवरण')}</h2><dl className="pj-dls">{rows.map(([a, b]) => <><dt key={`t${a}`}>{a}</dt><dd key={`d${a}`}>{b}</dd></>)}</dl></div>
      {can && (
        <div className="pj-card" id="pj-replycard">
          <h2 className="pj-h2">{L('How do you want to reply?', 'आप कैसे जवाब देंगे?')}</h2>
          <div className="pj-reply">
            <button className="pj-btn" onClick={() => setSheet('book')}><Ic n="calendar" size={18} />{L('Book a visit', 'विज़िट तय करें')}</button>
            <button className="pj-btn pj-ghost" onClick={() => startFx('remote', j.id)}><Ic n="tool" size={18} />{L('Fixed it remotely', 'दूर से ठीक किया')}</button>
            <button className="pj-btn pj-ghost" onClick={() => setSheet('note')}><Ic n="x" size={18} />{L('Not a system issue', 'सिस्टम की समस्या नहीं')}</button>
          </div>
          <p className="pj-p pj-sm pj-mut" style={{ marginTop: 10, textAlign: 'center' }}>{L('One tap. No signup.', 'एक टैप। साइन-अप नहीं।')}</p>
        </div>
      )}
      <div className="pj-card">
        <h2 className="pj-h2">{L('Progress', 'प्रगति')}</h2>
        <ul className="pj-tl">
          {(detail ? evsOf(detail.timeline, j) : j.ev).map((e, i) => <li key={i} className={e.k === 'fixed' ? 'pj-good' : ''}>{evText(L, lang, e)}<small>{fd(e.o, lang)}</small></li>)}
          {s === 'reply' && <li className="pj-next">{L('Waiting for your reply', 'आपके जवाब का इंतज़ार')}<small>{L(`by ${fd(j.due, lang)}`, `${fd(j.due, lang)} तक`)}</small></li>}
          {s === 'overdue' && <li className="pj-next">{L('Reply window closed. The home owner can file a complaint.', 'जवाब की समय सीमा खत्म। घर के मालिक शिकायत कर सकते हैं।')}<small>{fd(j.due, lang)}</small></li>}
          {s === 'visit' && <li className="pj-next">{L('Visit, then mark it done', 'विज़िट करें, फिर पूरी करें')}<small>{rel(j.visit!.o, lang)}, {j.visit!.t}</small></li>}
          {s === 'check' && <li className="pj-next">{L('Fixed, if output stays in range for 7 days', '7 दिन उत्पादन सामान्य रहा तो ठीक')}<small>{L(`Day ${j.day} of 7`, `दिन ${j.day} / 7`)}</small></li>}
        </ul>
      </div>
      <div className="pj-lock"><Ic n="lock" size={18} /><span>{L('Not shared with you: the home owner’s bill and phone number. You see generation data only.', 'आपके साथ साझा नहीं: घर के मालिक का बिल और फ़ोन नंबर। आप सिर्फ़ उत्पादन का डेटा देखते हैं।')}</span></div>
      {sheet === 'book' && <BookSheet j={j} onClose={() => setSheet(null)} />}
      {sheet === 'note' && <NoteSheet j={j} onClose={() => setSheet(null)} />}
    </div>
  )
}
