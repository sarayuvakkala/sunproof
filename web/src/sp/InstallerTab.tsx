import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InstallerAction, Issue, Verdict } from '../api'
import { cleanResult, fmtTime } from './calc'
import { Ic } from './ic'
import { SendButton } from './SendFly'
import { useApp } from './state'
import { Ticker } from './Ticker'
import { Card } from './ui'

type Step = ['done' | 'cur' | 'todo' | 'cur amb', string, string, string?]

function Timeline({ steps, title = 'Progress' }: { steps: Step[]; title?: string }) {
  const { t } = useApp()
  return (
    <Card delay={0.1}>
      <div className="h" style={{ marginBottom: 12 }}>{t(title)}</div>
      <div className="vt">
        {steps.map((s, i) => (
          <div key={i} className={`vs ${s[0]}`}>
            <div className="vd">{s[0] === 'done' ? '✓' : s[3] ?? ''}</div>
            <div><div className="vt1">{t(s[1])}</div><div className="vt2">{t(s[2])}</div></div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function InstallerBubble({ children, when }: { children: React.ReactNode; when: string }) {
  const { t } = useApp()
  return (
    <div className="up" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1e293b', color: '#fde68a', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>TI</div>
      <div className="ibub"><div className="sm mut" style={{ fontWeight: 600, marginBottom: 2 }}>{t('Installer')}{when ? ` · ${when}` : ''}</div>{children}</div>
    </div>
  )
}

function Days({ n, pattern }: { n?: number; pattern?: number[] }) {
  return (
    <div className="days">
      {[...Array(7)].map((_, i) => {
        const g = pattern ? pattern[i] === 1 : i < (n ?? 0)
        return <div key={i} className={`day ${g ? 'g' : ''}`}><i style={{ height: g ? 18 + ((i * 7) % 9) : 6, background: pattern && !g ? '#f59e0b' : undefined }} />D{i + 1}</div>
      })}
    </div>
  )
}

/** The 7 tiles of the fix check: a day lands every few seconds, ok (green) or low (amber), the rest still waiting. */
function DayTiles({ days }: { days: { day: number; ok: boolean }[] }) {
  return (
    <div className="days">
      {[...Array(7)].map((_, i) => {
        const d = days[i]
        return (
          <div key={i} className={`day ${d?.ok ? 'g' : ''}`}>
            <i style={{ height: d ? (d.ok ? 18 + ((i * 7) % 9) : 8) : 6, background: d && !d.ok ? '#f59e0b' : undefined, transition: 'height .6s cubic-bezier(.2,.9,.3,1), background .4s' }} />D{i + 1}
          </div>
        )
      })}
    </div>
  )
}

function Countdown({ to }: { to: number }) {
  const { t } = useApp()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id) }, [])
  const s = Math.max(0, Math.ceil((to - now) / 1000))
  return <>{t(`Next day in ${s} s`)}</>
}

function Checking() {
  const { t, issue, v, nextAt, advanceDay, busy } = useApp()
  const days = issue?.checkDays ?? []
  return (
    <div className="card up">
      <div className="h">{t('Checking the fix')}</div>
      <div className="sm mut">{t('We watch 7 days of output before calling it fixed.')}</div>
      <DayTiles days={days} />
      <div className="sm" style={{ marginTop: 10, fontWeight: 600 }}>
        {days.length ? t(`Day ${days.length} of 7`) : t('Waiting for the first day of output')}
      </div>
      {v?.isDemo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
          <span className="sm mut">{nextAt ? <Countdown to={nextAt} /> : null}</span>
          <span className="ghost" role="button" tabIndex={0} aria-disabled={busy} onClick={() => void advanceDay(true)}>{t('Next day ▸')}</span>
        </div>
      )}
    </div>
  )
}

function Evidence({ v }: { v: Verdict }) {
  const { t } = useApp()
  const rows = v.daily.slice(-30)
  const lo = Math.min(...rows.map((r) => r.actual)) - 0.5, hi = Math.max(...rows.map((r) => r.p90)) + 0.5
  const y = (val: number) => 62 - ((val - lo) / (hi - lo || 1)) * 56
  const x = (k: number) => (k * 280) / (rows.length - 1)
  const first = rows.findIndex((r) => r.flag !== null)
  const flagged = rows.filter((r) => r.flag !== null).length
  const pct = v.pct_below ?? Math.max(0, Math.round((1 - v.actual_kwh / (v.expected_kwh || 1)) * 100))
  const home = (v.name ?? 'Sharma ji').replace(/\s*\(demo\)\s*$/i, '')
  const dur = flagged >= 7 ? t(`${Math.max(1, Math.round(flagged / 7))} wks`) : t(`${Math.max(1, flagged)} days`)
  return (
    <Card style={{ padding: 16 }} delay={0.1}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{t('Your evidence pack')}</div>
      <div className="sm mut" style={{ marginTop: 2 }}>{t('This is what your installer sees.')}</div>
      <div className="route" style={{ margin: '14px 0' }}>
        <div className="dotA" style={{ background: '#f5b300', color: '#1a1200' }}>☀</div><span className="sm" style={{ fontWeight: 600 }}>SunProof</span>
        <div className="path"><i /></div>
        <span className="sm" style={{ fontWeight: 600 }}>{t('Installer')}</span><div className="dotA" style={{ background: '#1e293b', color: '#fde68a' }}>TI</div>
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div className="sm mut">{t('Subject')}</div>
        <div style={{ fontWeight: 700, marginTop: 1 }}>{t(`${home}'s ${v.kw ?? 3} kW system: worth checking`)}</div>
      </div>
      <div style={{ marginTop: 12, background: 'var(--soft)', borderRadius: 12, padding: '10px 10px 6px' }}>
        <svg viewBox="0 0 280 66" width="100%">
          <path d={`M0 ${y(rows[0].p90)}${rows.map((r, k) => ` L${x(k)} ${y(r.p90)}`).join('')}${[...rows].reverse().map((r, k) => ` L${x(rows.length - 1 - k)} ${y(r.p10)}`).join('')}Z`} fill="rgba(245,179,0,.28)" />
          {first >= 0 && <line x1={x(first)} y1="6" x2={x(first)} y2="60" stroke="#ea580c" strokeDasharray="2 3" />}
          <path className="draw" pathLength="1" d={`M${rows.map((r, k) => `${x(k)} ${y(r.actual)}`).join(' L')}`} fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="facts" style={{ marginTop: 10 }}>
        <div className="fact"><b style={{ color: '#ea580c' }}>{pct}%</b><span>{t('below expected')}</span></div>
        <div className="fact"><b>{dur}</b><span>{t('so far')}</span></div>
        <div className="fact"><b>{Math.round(v.units_lost)}</b><span>{t('units lost')}</span></div>
      </div>
      <div className="sm" style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}><Ic n="circle-check" size={16} color="#16a34a" />{t('They reply in one tap, no signup needed.')}</div>
    </Card>
  )
}

const when = (iso: string, lang: 'en' | 'hi') => fmtTime(iso, lang)
const slot = (v: { date: string; time: string } | null | undefined) =>
  v?.date ? `${new Date(`${v.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${v.time}` : ''

/**
 * "Your journey": only what has happened so far, plus what is happening now. Built from the issue's own timeline, so a
 * step shows up once the decision behind it was made (you sent it, the installer replied, the check ran...).
 */
function journeyOf(issue: Issue | null, lang: 'en' | 'hi'): Step[] {
  if (!issue) return [['cur', 'Ready to send', 'Nothing is sent until you press the button']]
  type Row = { w: boolean; a: string; b: string }
  const rows: Row[] = []
  const add = (a: string, b = '', w = false) => rows.push({ w, a, b })
  for (const e of issue.timeline) {
    const at = when(e.at, lang)
    switch (e.event) {
      case 'created': add('Sent to installer', `${at} · delivered`); break
      case 'reminder': add('Reminder sent', 'No reply yet'); break
      case 'book_visit': add('Installer replied', 'Booked a visit'); add('Visit booked', slot(issue.visit)); break
      case 'on_the_way': add('Installer is on the way', at); break
      case 'arrived': add('Installer is at your place', at); break
      case 'visit_done': add('Visit done', 'Installer marked it done'); break
      case 'fixed_remotely': add('Installer replied', 'Fixed remotely, no visit needed'); break
      case 'not_system_issue': add('Installer replied', 'Not a system issue'); break
      case 'fix_failed': add("The fix didn't hold", `Output fell on day ${issue.failedDay ?? ''}`.trim(), true); break
      case 'reopened':
        if (issue.failedDay) add('Revisit requested', 'Sent with the new readings')
        else add('Still below expected', 'Reopened with your installer', true)
        break
      case 'cleaned': add('Panels cleaned', 'Dust was the cause'); add('Fixed by cleaning', `${at} · installer sees it as fixed too`); break
      case 'fixed': add('Fixed, proven by data', at); break
      case 'escalation_draft': add('No reply in 7 days', 'Complaint draft is ready', true); break
    }
  }
  const tail: Step[] = []
  switch (issue.status) {
    case 'sent': case 'reopened': case 'no_data':
      tail.push(['cur', 'Waiting for installer', `${issue.status === 'reopened' && issue.failedDay ? 'Revisit requested · ' : ''}reply due ${issue.deadlineText}`])
      break
    case 'visit_booked': if (issue.visitDone) tail.push(['cur', 'Checking the fix', issue.checkDays?.length ? `Day ${issue.checkDays.length} of 7` : 'Waiting for the first day of output']); break
    case 'fixed_remotely': tail.push(['cur', 'Checking the fix', issue.checkDays?.length ? `Day ${issue.checkDays.length} of 7` : 'Waiting for the first day of output']); break
    case 'disputed': tail.push(['cur', 'Check cleaning', 'Dust is a common cause']); break
  }
  const live = tail.length === 0 && !['fixed'].includes(issue.status)  // the last step is what is happening now
  return [
    ...rows.map((r, i): Step => {
      const last = live && i === rows.length - 1
      return r.w && last ? ['cur amb', r.a, r.b, '!'] : last ? ['cur', r.a, r.b] : ['done', r.a, r.b]
    }),
    ...tail,
  ]
}

export function InstallerTab() {
  const { v, issue, view, t, lang, instReply, busy, visitPhase, revisit, clean, cl } = useApp()
  const nav = useNavigate()
  const [sheet, setSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  if (!v) return <Card style={{ color: 'var(--mut)' }}>{t('Loading…')}</Card>
  const at = (e: string) => issue?.timeline.find((x) => x.event === e)
  /** Dates in the installer's note come as 2026-10-09 11:00; show them as Fri 9 Oct, 11:00. */
  const nice = (s?: string) => (s ?? '').replace(/(\d{4})-(\d{2})-(\d{2})(?: (\d{2}:\d{2}))?/g, (_m, y, mo, d, tm) =>
    new Date(+y, +mo - 1, +d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + (tm ? `, ${tm}` : ''))
  const when = (e: string) => { const x = at(e); return x ? fmtTime(x.at, lang) : '' }
  const sentAt = when('sent_to_app') || when('created')
  const repliedEv = ['book_visit', 'fixed_remotely', 'not_system_issue'].map(at).find(Boolean)
  const viaRemote = !!at('fixed_remotely')
  const res = cleanResult(cl, clean, v)
  const cleaned = res?.g === 1 ? res : null  // panels cleaned (or washed by rain): shown like a repair
  const repliedAt = repliedEv ? fmtTime(repliedEv.at, lang) : ''
  const canSend = v.status === 'shortfall' || v.status === 'trip'
  const fresh = !!issue && Date.now() - Date.parse(issue.timeline[0]?.at ?? '') < 20000

  const reply = async (a: InstallerAction) => { setSheet(false); await instReply(a) }

  return (
    <>
      <Card style={{ padding: 0 }}>
        <div className="ban" />
        <div className="av" ref={avatarRef}><b>TI</b><span className="vf">✓</span></div>
        <div style={{ padding: '32px 16px 14px' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('Installer')}</div>
          <div className="sm mut" style={{ margin: '2px 0 10px' }}>{t(`Your installer · fitted your ${v.kw ?? 3} kW system in 2025`)}</div>
          <span className="tag"><Ic n="tool" size={14} />{t('On the SunProof app')}</span>
          <span className="tag"><Ic n="clock" size={14} />{t('7-day reply window')}</span>
        </div>
      </Card>

      <Timeline title="Your journey" steps={[...journeyOf(issue, lang), ...(cleaned && issue?.recovered?.by !== 'cleaning' && issue ? [['done', cl === 'rain' ? 'Washed by rain' : 'Panels cleaned', 'Dust has stopped costing you'] as Step] : [])]} />

      {view === 'idle' && (canSend ? (
        <>
          <div ref={cardRef}><Evidence v={v} /></div>
          <Card style={{ padding: 16 }} delay={0.2}>
            <div className="h">{t('Ready when you are')}</div>
            <div className="sm mut" style={{ margin: '3px 0 14px' }}>{t('Nothing is sent until you press the button.')}</div>
            <SendButton cardRef={cardRef} avatarRef={avatarRef} />
          </Card>
        </>
      ) : (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <Ic n="circle-check" size={32} color="#16a34a" />
          <div className="h" style={{ marginTop: 8 }}>{t('Nothing to send')}</div>
          <div className="sm mut" style={{ marginTop: 4 }}>{t('Your system is within its expected range.')}</div>
        </Card>
      ))}

      {(view === 'sent' || view === 'rem') && issue && (
        <>
          {fresh && view === 'sent' && (
            <Card style={{ borderColor: '#86efac' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <svg width="44" height="44" viewBox="0 0 72 72" style={{ flex: '0 0 auto' }}><circle cx="36" cy="36" r="33" fill="#dcfce7" /><path d="M22 37 L32 47 L51 27" fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div><div className="h">{t('Sent to your installer')}</div><div className="sm mut">{sentAt ? `${sentAt} · delivered` : ''}</div></div>
              </div>
            </Card>
          )}
          <Card style={{ borderColor: view === 'rem' ? '#f59e0b' : undefined }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: view === 'rem' ? '#fef3c7' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <Ic n="clock" size={28} color={view === 'rem' ? '#92400e' : '#1e40af'} />
              </div>
              <div>
                <div className="h">{view === 'rem' ? t('Reminder sent') : t('Waiting for a reply')}</div>
                <div className="sm mut">{t(`Reply due ${issue.deadlineText}`)}</div>
              </div>
            </div>
          </Card>
          
          <div style={{ display: 'flex', marginBottom: 12 }}><span className="ghost" role="button" tabIndex={0} onClick={() => setSheet(true)}>{t('See what the installer sees ↗')}</span></div>
        </>
      )}

      {view === 'esc' && issue && (
        <>
          <Card style={{ borderColor: '#dc2626' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Ic n="alert-triangle" size={22} color="#dc2626" />
              <div><div className="h">{t('No reply in 7 days')}</div><div className="sm mut">{t("Your complaint is ready. You file it, SunProof doesn't.")}</div></div>
            </div>
          </Card>
          <div className="letter up" style={{ whiteSpace: 'pre-wrap' }}>{issue.escalationDraft}</div>
          <div style={{ display: 'flex', gap: 8, margin: '16px 0 12px' }}>
            <span className="ghost" role="button" tabIndex={0} onClick={() => { void navigator.clipboard?.writeText(issue.escalationDraft ?? ''); setCopied(true) }}>
              <Ic n={copied ? 'check' : 'copy'} size={16} />{t(copied ? 'Copied' : 'Copy')}
            </span>
            <span className="ghost" role="button" tabIndex={0} onClick={() => { void navigator.share?.({ text: issue.escalationDraft ?? '' }).catch(() => {}) }}><Ic n="share" size={16} />{t('Share')}</span>
          </div>
        </>
      )}

      {view === 'visit' && issue && (
        <>
          <InstallerBubble when={repliedAt}>📅 <b>{t('Visit booked.')}</b> {nice(at('book_visit')?.note)}</InstallerBubble>
          {visitPhase && (
            <Card>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="vd" style={{ background: visitPhase === 'done' ? '#22c55e' : '#2563eb', color: '#fff' }}>{visitPhase === 'done' ? '✓' : visitPhase === 'enroute' ? '🚗' : '🛠'}</span>
                <div className="sm" style={{ fontWeight: 600 }}>{visitPhase === 'done' ? <span style={{ color: '#16a34a' }}>{t('✓ Visit done, fix applied')}</span> : visitPhase === 'enroute' ? t('Installer is on the way') : t('Installer is at your place…')}</div>
              </div>
            </Card>
          )}
          
        </>
      )}

      {view === 'ver' && (
        <>
          {viaRemote && <InstallerBubble when={repliedAt}>🛠 <b>{t('Fixed remotely.')}</b> {t('No visit needed. We are now checking your output.')}</InstallerBubble>}
          <Checking />
          
        </>
      )}

      {view === 'fix' && issue && <FixedView issue={issue} onImpact={() => nav('/app/impact')} />}

      {view === 'fail' && issue && (
        <>
          {cleaned && <CleanedCard res={cleaned} rain={cl === 'rain'} />}
          <Card style={{ borderColor: '#f59e0b' }}>
            <div className="h">{t("The fix didn't hold")}</div>
            <div className="sm mut" style={{ marginTop: 2 }}>
              {t(`Output was back for ${(issue.failedDay ?? 1) - 1} days, then fell again on day ${issue.failedDay}, about ${issue.failedPct}% under expected.`)}
            </div>
            <DayTiles days={issue.checkDays ?? []} />
          </Card>
          <Card>
            <div className="h">{t('What could be behind it')}</div>
            <div style={{ display: 'flex', gap: 10, padding: '10px 0 4px' }}>
              <span className="vd" style={{ flex: '0 0 22px' }}>1</span>
              <div><div style={{ fontWeight: 600 }}>{t('Dust on the panels')}</div><div className="sm mut">{t('Dust builds up fast when output drops a few days after a repair.')}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '10px 0 4px' }}>
              <span className="vd" style={{ flex: '0 0 22px' }}>2</span>
              <div><div style={{ fontWeight: 600 }}>{t('The repair needs a second look')}</div><div className="sm mut">{t('Your installer can come back and check it again.')}</div></div>
            </div>
            <span className="act" role="button" tabIndex={0} style={{ marginTop: 12 }} onClick={() => nav('/app/cleaning')}>{t('Check cleaning')}</span>
            <span className="act ghost" role="button" tabIndex={0} aria-disabled={busy} style={{ marginTop: 8 }} onClick={() => { if (!busy) void revisit() }}>{t('Ask installer to revisit')}</span>
          </Card>
          
        </>
      )}

      {view === 'reo' && (
        <>
          {cleaned && <CleanedCard res={cleaned} rain={cl === 'rain'} />}
          <Card style={{ borderColor: '#f59e0b' }}>
            <div className="h">{t(issue?.failedDay ? 'Revisit requested' : viaRemote ? 'Still below expected after the remote fix' : 'Still below expected after the visit')}</div>
            <div className="sm mut" style={{ marginTop: 2 }}>{t(issue?.failedDay ? 'Your installer has the new readings. 7 more days to reply.' : 'New data sent to your installer. 7 more days to reply.')}</div>
            {issue?.failedDay ? <DayTiles days={issue.checkDays ?? []} /> : <Days pattern={[1, 1, 0, 0, 1, 0, 0]} />}
          </Card>
          <Card>
            <div className="h">{t('What you can do')}</div>
            <div className="sm" style={{ margin: '4px 0 12px', lineHeight: 1.55 }}>{t('The fix did not bring output back. Dust is a common cause. See whether a cleaning pays off.')}</div>
            <span className="act" role="button" tabIndex={0} onClick={() => nav('/app/cleaning')}>{t('Open Cleaning tab')}</span>
          </Card>
          
        </>
      )}

      {view === 'dis' && (
        <>
          {cleaned && <CleanedCard res={cleaned} rain={cl === 'rain'} />}
          <InstallerBubble when={repliedAt}>🙅 <b>{t('Not a system issue.')}</b> {nice(at('not_system_issue')?.note)}</InstallerBubble>
          {!cleaned && <Card>
            <div className="h">{t('What you can do')}</div>
            <div className="sm" style={{ margin: '4px 0 12px', lineHeight: 1.55 }}>{t('Dust is a common cause. See whether a cleaning pays off.')}</div>
            <span className="act" role="button" tabIndex={0} onClick={() => nav('/app/cleaning')}>{t('Open Cleaning tab')}</span>
          </Card>}
          
        </>
      )}

      {sheet && (
        <div className="ov" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="sm mut">{t("Installer's view · no signup")}</span>
              <span style={{ cursor: 'pointer', fontSize: 22 }} onClick={() => setSheet(false)} role="button" aria-label="Close">×</span>
            </div>
            <div className="h" style={{ margin: '6px 0 2px' }}>{t(`${(v.name ?? 'Sharma ji').replace(/\s*\(demo\)\s*$/i, '')}'s ${v.kw ?? 3} kW system`)}</div>
            <div className="sm mut">{issue?.summary}</div>
            <span className="opt" role="button" tabIndex={0} onClick={() => reply('book_visit')}><Ic n="calendar" size={20} color="#2563eb" />{t('Book a visit')}</span>
            <span className="opt" role="button" tabIndex={0} onClick={() => reply('fixed_remotely')}><Ic n="tool" size={20} color="#16a34a" />{t('Fixed remotely')}</span>
            <span className="opt" role="button" tabIndex={0} onClick={() => reply('not_system_issue')}><Ic n="message-circle" size={20} />{t('Not a system issue')}</span>
          </div>
        </div>
      )}
    </>
  )
}

function CleanedCard({ res, rain }: { res: { u: number; r: number; c: number }; rain: boolean }) {
  const { t } = useApp()
  const nav = useNavigate()
  return (
    <Card style={{ borderColor: '#22c55e' }}>
      <div className="h">{t(rain ? 'Washed by rain' : 'Panels cleaned')}</div>
      <div className="sm mut">{t('Dust has stopped costing you')} <span className="rtag">{t('Estimated')}</span></div>
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat"><div className="big"><Ticker value={res.u} decimals={1} delay={250} /></div><div className="lab">{t('units back')}</div></div>
        <div className="stat"><div className="big">₹<Ticker value={res.r} delay={390} /></div><div className="lab">{t('saved')}</div></div>
        <div className="stat"><div className="big"><Ticker value={res.c} decimals={1} delay={530} /><span style={{ fontSize: 12 }}> {t('kg')}</span></div><div className="lab">{t('CO₂ avoided')}</div></div>
      </div>
      <span className="stamp in">{t(rain ? 'WASHED ✓' : 'CLEANED ✓')}</span>
      <div style={{ display: 'flex', marginTop: 12 }}><span className="ghost" role="button" tabIndex={0} onClick={() => nav('/app/impact')}>{t('See your impact →')}</span></div>
    </Card>
  )
}

function FixedView({ issue, onImpact }: { issue: Issue; onImpact: () => void }) {
  const { t } = useApp()
  const r = issue.recovered
  const byCleaning = r?.by === 'cleaning'
  return (
    <>
      <Card style={{ borderColor: '#22c55e' }}>
        <div className="h">{t(byCleaning ? 'Fixed by cleaning' : 'Fixed, proven by data')}</div>
        {byCleaning
          ? <div className="sm mut" style={{ paddingRight: 130 }}>{t('Dust was the cause. Your installer sees this as fixed too.')} <span className="rtag">{t('Estimated')}</span></div>
          : <><div className="sm mut">{t('7 of 7 days back in range')} <span className="rtag">{t('REPLAY')}</span></div><Days n={7} /></>}
        {r && (
          <div className="stats" style={{ marginTop: 12 }}>
            <div className="stat"><div className="big"><Ticker value={r.kwh} decimals={1} delay={250} /></div><div className="lab">{t('units')}</div></div>
            <div className="stat"><div className="big">₹<Ticker value={r.rupees} delay={390} /></div><div className="lab">{t('saved')}</div></div>
            <div className="stat"><div className="big"><Ticker value={r.co2_kg} decimals={1} delay={530} /><span style={{ fontSize: 12 }}> {t('kg')}</span></div><div className="lab">{t('CO₂ avoided')}</div></div>
          </div>
        )}
        <span className="stamp in">{t('FIXED ✓')}</span>
        <div style={{ display: 'flex', marginTop: 12 }}><span className="ghost" role="button" tabIndex={0} onClick={onImpact}>{t('See your impact →')}</span></div>
      </Card>
      
    </>
  )
}
