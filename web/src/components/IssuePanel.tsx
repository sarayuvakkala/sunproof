import { useEffect, useRef, useState } from 'react'
import { ApiError, demoReplayFix, demoReset, getIssue, sendIssue, type Issue, type Verdict } from '../api'
import { EVENT_LABEL, ISSUE_STATUS, type Lang, T } from '../i18n'

const TERMINAL = new Set(['fixed', 'disputed', 'escalation_draft', 'no_data'])

function fmtTime(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

function Steps({ issue, lang }: { issue: Issue; lang: Lang }) {
  const t = T[lang].steps
  const ev = new Set(issue.timeline.map((e) => e.event))
  const steps = [
    { label: t.sent, done: true },
    { label: t.replied, done: ['book_visit', 'fixed_remotely', 'not_system_issue'].some((e) => ev.has(e)) },
    { label: t.visit, done: ev.has('book_visit') || ev.has('fixed_remotely') },
    { label: t.fixed, done: issue.status === 'fixed' },
  ]
  return (
    <ol className="mb-4 grid grid-cols-4 gap-1 text-center text-[11px] sm:text-xs" aria-label="progress">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col items-center gap-1">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
            style={{
              background: s.done ? 'var(--good)' : 'var(--grid)',
              color: s.done ? '#0b0b0b' : 'var(--text-muted)',
            }}
          >
            {s.done ? '✓' : i + 1}
          </span>
          <span style={{ color: s.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

export function IssuePanel({ v, lang, issueId, onIssue, onChange }: {
  v: Verdict
  lang: Lang
  issueId: string | null
  onIssue: (id: string | null) => void
  onChange: () => void
}) {
  const t = T[lang]
  const [issue, setIssue] = useState<Issue | null>(null)
  const [approved, setApproved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const lastStatus = useRef<string | null>(null)

  useEffect(() => {
    if (!issueId) { setIssue(null); return }
    let stop = false
    const load = () =>
      getIssue(issueId, v.homeId)
        .then((i) => {
          if (stop) return
          setIssue(i)
          if (lastStatus.current !== i.status) { lastStatus.current = i.status; onChange() }
        })
        .catch((e) => { if (!stop && e instanceof ApiError && (e.status === 404 || e.status === 403)) onIssue(null) })
    load()
    const id = setInterval(() => { if (!issue || !TERMINAL.has(issue.status)) load() }, 3000)
    return () => { stop = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, v.homeId, issue?.status])

  async function send() {
    setBusy(true); setErr(null)
    try {
      const r = await sendIssue(v.homeId, approved)
      onIssue(r.issueId)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.sendFail)
    } finally { setBusy(false) }
  }

  async function replay(outcome: 'fixed' | 'still_low') {
    if (!issueId) return
    setBusy(true)
    try { await demoReplayFix(issueId, outcome) } finally { setBusy(false); onChange() }
  }

  async function reset() {
    setBusy(true)
    try { await demoReset() } finally { setBusy(false); onIssue(null); setApproved(false); onChange() }
  }

  const canSend = (v.status === 'shortfall' || v.status === 'trip') && !issueId
  const demoWaiting = issue && v.isDemo && ['visit_booked', 'fixed_remotely'].includes(issue.status)

  if (!issue && !canSend && !v.isDemo) return null

  return (
    <section className="card mb-4 p-5 sm:p-6">
      {canSend && (
        <>
          <h2 className="mb-1 text-lg font-semibold">{t.sendTitle}</h2>
          <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t.sendBody(v.installerName ?? 'installer')}
          </p>
          <label className="mb-3 flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5" checked={approved}
              onChange={(e) => setApproved(e.target.checked)} />
            <span>{t.approve}</span>
          </label>
          <button
            onClick={send}
            disabled={!approved || busy}
            className="rounded-xl px-5 py-3 text-base font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {busy ? t.sending : t.sendBtn}
          </button>
          {err && <p className="mt-2 text-sm" style={{ color: 'var(--critical)' }}>{err}</p>}
        </>
      )}

      {issue && (
        <>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t.issueTitle}</h2>
            <span className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: `var(--${ISSUE_STATUS[issue.status].tone})`, color: '#0b0b0b' }}>
              {ISSUE_STATUS[issue.status][lang]}
            </span>
          </div>
          {!TERMINAL.has(issue.status) && (
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>{t.replyBy(issue.deadlineText)}</p>
          )}
          <Steps issue={issue} lang={lang} />
          <ul className="space-y-2 text-sm">
            {issue.timeline.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-24 shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(e.at, lang)}</span>
                <span>
                  {EVENT_LABEL[e.event]?.[lang] ?? e.event}
                  {e.event === 'replay' && (
                    <b className="ml-2 rounded px-1.5 text-[10px]" style={{ background: 'var(--demo-bg)', color: 'var(--demo-ink)' }}>
                      {t.replayTag}
                    </b>
                  )}
                  {e.note && !['created', 'sent_to_app', 'reminder', 'verifying', 'replay'].includes(e.event) && (
                    <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>{e.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {issue.status === 'fixed' && issue.recovered && (
            <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--surface-0)', border: '1px solid var(--good)' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t.recoveredNow}</div>
              <div className="text-2xl font-bold">
                {issue.recovered.kwh} {t.kwh} · ₹{issue.recovered.rupees} · {issue.recovered.co2_kg} kg CO₂
              </div>
            </div>
          )}

          {issue.status === 'escalation_draft' && issue.escalationDraft && (
            <div className="mt-4">
              <h3 className="text-base font-semibold">{t.escalationTitle}</h3>
              <p className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{t.escalationHelp}</p>
              <textarea readOnly value={issue.escalationDraft} rows={10}
                className="w-full rounded-lg p-3 text-xs leading-relaxed"
                style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              <button
                onClick={() => { navigator.clipboard?.writeText(issue.escalationDraft!); setCopied(true) }}
                className="mt-2 rounded-lg px-4 py-2 text-sm font-medium"
                style={{ background: 'var(--surface-0)', border: '1px solid var(--border)' }}>
                {copied ? t.copied : t.copy}
              </button>
            </div>
          )}
        </>
      )}

      {v.isDemo && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t.demoTitle}:</span>
          {demoWaiting && (
            <>
              <button onClick={() => replay('fixed')} disabled={busy} className="rounded-md px-2.5 py-1.5 font-medium"
                style={{ background: 'var(--demo-bg)', color: 'var(--demo-ink)' }}>{t.replayFixed}</button>
              <button onClick={() => replay('still_low')} disabled={busy} className="rounded-md px-2.5 py-1.5 font-medium"
                style={{ background: 'var(--demo-bg)', color: 'var(--demo-ink)' }}>{t.replayLow}</button>
            </>
          )}
          <button onClick={reset} disabled={busy} className="rounded-md px-2.5 py-1.5 font-medium"
            style={{ background: 'var(--surface-0)', border: '1px solid var(--border)' }}>{t.resetDemo}</button>
        </div>
      )}
    </section>
  )
}
