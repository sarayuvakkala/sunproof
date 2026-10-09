import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InstallerAction, Issue, Verdict } from '../api'
import { fmtTime } from './calc'
import { Ic } from './ic'
import { SendButton } from './SendFly'
import { useApp, type ScenarioKey, type View } from './state'
import { Ticker } from './Ticker'
import { Card } from './ui'

const SCN: [ScenarioKey, string][] = [
  ['before', 'Before sending'], ['waiting', 'Waiting'], ['visit', 'Visit booked'],
  ['remote', 'Fixed remotely'], ['low', 'Still low'], ['dis', 'Not the system'],
]
const SCN_OF: Partial<Record<View, ScenarioKey>> = { idle: 'before', sent: 'waiting', rem: 'waiting', esc: 'waiting', visit: 'visit', ver: 'remote', fix: 'remote', reo: 'low', dis: 'dis' }

type Step = ['done' | 'cur' | 'todo' | 'cur amb', string, string, string?]

function Timeline({ steps }: { steps: Step[] }) {
  const { t } = useApp()
  return (
    <Card delay={0.1}>
      <div className="h" style={{ marginBottom: 12 }}>{t('Progress')}</div>
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
      <div className="ibub"><div className="sm mut" style={{ fontWeight: 600, marginBottom: 2 }}>{t('Test installer')}{when ? ` · ${when}` : ''}</div>{children}</div>
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

function Verifying() {
  const { t } = useApp()
  const [f, setF] = useState(3)
  const [stamp, setStamp] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = setInterval(() => setF((x) => {
      if (x >= 7) { clearInterval(id); return x }
      if (x + 1 >= 7) {
        setStamp(true)
        const c = box.current
        if (c && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const cols = ['#f5b300', '#22c55e', '#2563eb', '#ef4444', '#a855f7']
          for (let i = 0; i < 26; i++) {
            const p = document.createElement('span')
            p.className = 'cf'
            p.style.left = `${Math.random() * 100}%`
            p.style.background = cols[i % 5]
            p.style.animationDelay = `${Math.random() * 0.4}s`
            c.appendChild(p)
          }
        }
      }
      return x + 1
    }), 550)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="card up" ref={box}>
      <div className="h">{t('Checking the fix')}</div>
      <div className="sm mut">{t('We watch 7 days of output before calling it fixed.')}</div>
      <Days n={f} />
      <div className="sm" style={{ marginTop: 10, fontWeight: 600 }}>{t(`${f} of 7 days back in range`)}</div>
      <span className={`stamp ${stamp ? 'in' : ''}`}>{t('FIXED ✓')}</span>
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
  const pct = Math.max(0, Math.round((1 - v.actual_kwh / (v.expected_kwh || 1)) * 100))
  const home = (v.name ?? 'Sharma ji').replace(/\s*\(demo\)\s*$/i, '')
  const dur = flagged >= 7 ? t(`${Math.max(1, Math.round(flagged / 7))} wks`) : t(`${Math.max(1, flagged)} days`)
  return (
    <Card style={{ padding: 16 }} delay={0.1}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{t('Your evidence pack')}</div>
      <div className="sm mut" style={{ marginTop: 2 }}>{t('This is the email your installer gets.')}</div>
      <div className="route" style={{ margin: '14px 0' }}>
        <div className="dotA" style={{ background: '#f5b300', color: '#1a1200' }}>☀</div><span className="sm" style={{ fontWeight: 600 }}>SunProof</span>
        <div className="path"><i /></div>
        <span className="sm" style={{ fontWeight: 600 }}>{t('Installer')}</span><div className="dotA" style={{ background: '#1e293b', color: '#fde68a' }}>TI</div>
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <div className="sm mut">{t('Subject')}</div>
        <div style={{ fontWeight: 700, marginTop: 1 }}>{t(`${home}'s 3 kW system: worth checking`)}</div>
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

export function InstallerTab() {
  const { v, issue, view, t, lang, instReply, scenarioGo, scenarioNow, busy, remoteFix, visitPhase } = useApp()
  const nav = useNavigate()
  const [sheet, setSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  if (!v) return <Card style={{ color: 'var(--mut)' }}>{t('Loading…')}</Card>
  const at = (e: string) => issue?.timeline.find((x) => x.event === e)
  const when = (e: string) => { const x = at(e); return x ? fmtTime(x.at, lang) : '' }
  const sentAt = when('email_sent') || when('created')
  const repliedEv = ['book_visit', 'fixed_remotely', 'not_system_issue'].map(at).find(Boolean)
  const repliedAt = repliedEv ? fmtTime(repliedEv.at, lang) : ''
  const S1: Step = ['done', 'Sent to installer', sentAt ? `${sentAt} · email delivered` : 'Email delivered']
  const canSend = v.status === 'shortfall' || v.status === 'trip'
  const fresh = !!issue && Date.now() - Date.parse(issue.timeline[0]?.at ?? '') < 20000
  const cur = scenarioNow ?? SCN_OF[view] ?? null

  const reply = async (a: InstallerAction) => { setSheet(false); await instReply(a) }

  return (
    <>
      <Card style={{ padding: 0 }}>
        <div className="ban" />
        <div className="av" ref={avatarRef}><b>TI</b><span className="vf">✓</span></div>
        <div style={{ padding: '32px 16px 14px' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('Test installer')}</div>
          <div className="sm mut" style={{ margin: '2px 0 10px' }}>{t('Your installer · fitted your 3 kW system in 2025')}</div>
          <span className="tag"><Ic n="mail" size={14} />{t('Email on file')}</span>
          <span className="tag"><Ic n="clock" size={14} />{t('7-day reply window')}</span>
        </div>
      </Card>

      {v.isDemo && (
        <div className="scn">
          {SCN.map(([k, label]) => (
            <span key={k} className={cur === k ? 'on' : ''} role="button" tabIndex={0} aria-disabled={busy}
              onClick={() => { if (!busy) void scenarioGo(k) }}>{t(label)}</span>
          ))}
        </div>
      )}

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
                <div><div className="h">{t('Sent to your installer')}</div><div className="sm mut">{sentAt ? `${sentAt} · email delivered`.replace(/^/, '') : ''}</div></div>
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
          <Timeline steps={[S1, [view === 'rem' ? 'cur amb' : 'cur', 'Installer replies', view === 'rem' ? 'No reply yet. Reminder sent.' : 'Book a visit, fixed remotely, or not the system', '2'], ['todo', 'Visit or fix', '', '3'], ['todo', 'Fixed, proven by data', 'We check 7 days of output', '4']]} />
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
          <InstallerBubble when={repliedAt}>📅 <b>{t('Visit booked.')}</b> {at('book_visit')?.note}</InstallerBubble>
          {visitPhase && (
            <Card>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="vd" style={{ background: visitPhase === 'done' ? '#22c55e' : '#2563eb', color: '#fff' }}>{visitPhase === 'done' ? '✓' : '🛠'}</span>
                <div className="sm" style={{ fontWeight: 600 }}>{visitPhase === 'done' ? <span style={{ color: '#16a34a' }}>{t('✓ Visit done, fix applied')}</span> : t('Installer is at your place…')}</div>
              </div>
            </Card>
          )}
          <Timeline steps={[S1, ['done', 'Installer replied', repliedAt], ['cur', 'Visit booked', 'Then we watch 7 days of output', '3'], ['todo', 'Fixed, proven by data', '', '4']]} />
        </>
      )}

      {view === 'ver' && (
        <>
          {remoteFix && <InstallerBubble when={repliedAt}>🛠 <b>{t('Fixed remotely.')}</b> {t('No visit needed. We are now checking your output.')}</InstallerBubble>}
          <Verifying />
          <Timeline steps={remoteFix
            ? [S1, ['done', 'Installer replied', `${repliedAt ? `${repliedAt} · ` : ''}fixed remotely`], ['done', 'Fixed remotely', 'No visit needed'], ['cur', 'Fixed, proven by data', 'Checking day by day', '4']]
            : [S1, ['done', 'Installer replied', repliedAt], ['done', 'Visit done', ''], ['cur', 'Fixed, proven by data', 'Checking day by day', '4']]} />
        </>
      )}

      {view === 'fix' && issue && <FixedView issue={issue} steps={[S1, ['done', 'Installer replied', repliedAt], ['done', remoteFix ? 'Fixed remotely' : 'Visit done', ''], ['done', 'Fixed, proven by data', when('fixed')]]} onImpact={() => nav('/app/impact')} />}

      {view === 'reo' && (
        <>
          <Card style={{ borderColor: '#f59e0b' }}>
            <div className="h">{t('Still below expected after the visit')}</div>
            <div className="sm mut" style={{ marginTop: 2 }}>{t('New data sent to your installer. 7 more days to reply.')}</div>
            <Days pattern={[1, 1, 0, 0, 1, 0, 0]} />
          </Card>
          <Timeline steps={[S1, ['done', 'Installer replied', repliedAt], ['done', 'Visit done', ''], ['cur amb', 'Reopened', 'Only 3 of 7 days in range', '!']]} />
        </>
      )}

      {view === 'dis' && (
        <>
          <InstallerBubble when={repliedAt}>🙅 <b>{t('Not a system issue.')}</b> {at('not_system_issue')?.note}</InstallerBubble>
          <Card>
            <div className="h">{t('What you can do')}</div>
            <div className="sm" style={{ margin: '4px 0 12px', lineHeight: 1.55 }}>{t('Dust is a common cause. See whether a cleaning pays off.')}</div>
            <span className="act" role="button" tabIndex={0} onClick={() => nav('/app/cleaning')}>{t('Open Cleaning tab')}</span>
          </Card>
          <Timeline steps={[S1, ['done', 'Installer replied', `${repliedAt ? `${repliedAt} · ` : ''}not the system`], ['todo', 'Check cleaning', '', '3']]} />
        </>
      )}

      {sheet && (
        <div className="ov" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="sm mut">{t("Installer's view · no signup")}</span>
              <span style={{ cursor: 'pointer', fontSize: 22 }} onClick={() => setSheet(false)} role="button" aria-label="Close">×</span>
            </div>
            <div className="h" style={{ margin: '6px 0 2px' }}>{t(`${(v.name ?? 'Sharma ji').replace(/\s*\(demo\)\s*$/i, '')}'s 3 kW system`)}</div>
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

function FixedView({ issue, steps, onImpact }: { issue: Issue; steps: Step[]; onImpact: () => void }) {
  const { t } = useApp()
  const r = issue.recovered
  return (
    <>
      <Card style={{ borderColor: '#22c55e' }}>
        <div className="h">{t('Fixed, proven by data')}</div>
        <div className="sm mut">{t('7 of 7 days back in range')} <span className="rtag">{t('REPLAY')}</span></div>
        <Days n={7} />
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
      <Timeline steps={steps} />
    </>
  )
}
