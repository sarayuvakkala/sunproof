import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getInstallerView, respond, type InstallerAction, type InstallerView } from '../api'
import { DailyChart } from '../components/DailyChart'

const ACTIONS: { action: InstallerAction; label: string; hint: string }[] = [
  { action: 'book_visit', label: 'Book visit', hint: "I'll inspect the system on site" },
  { action: 'fixed_remotely', label: 'Fixed remotely', hint: 'I resolved it without a visit' },
  { action: 'not_system_issue', label: 'Not a system issue', hint: 'Dust, shading or billing, not the system' },
]

const DONE_TEXT: Record<InstallerAction, string> = {
  book_visit: 'Visit booked. The household has been told.',
  fixed_remotely: 'Marked as fixed remotely. SunProof will check the next 7 days of generation to confirm.',
  not_system_issue: 'Noted: not a system issue. The household has been told.',
}

export function Installer() {
  const { token = '' } = useParams()
  const [v, setV] = useState<InstallerView | null>(null)
  const [err, setErr] = useState(false)
  const [done, setDone] = useState<InstallerAction | null>(null)
  const [late, setLate] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getInstallerView(token).then(setV).catch(() => setErr(true))
  }, [token])

  async function go(action: InstallerAction) {
    setBusy(true)
    try {
      const r = await respond(token, action, note || undefined)
      setLate(!!r.late)
      setDone(action)
    } catch {
      setErr(true)
    } finally { setBusy(false) }
  }

  if (err) return <Shell><div className="card p-6">This link is not valid, or something went wrong. Please ask the household for a new link.</div></Shell>
  if (!v) return <Shell><div className="card p-6" style={{ color: 'var(--text-secondary)' }}>Loading…</div></Shell>

  const closed = ['fixed', 'disputed', 'escalation_draft', 'no_data'].includes(v.status)

  return (
    <Shell>
      {v.isDemo && (
        <div className="mb-4 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--demo-bg)', color: 'var(--demo-ink)' }}>
          Test installer view. The household is a demo built from public plant data, not a real home.
        </div>
      )}

      <section className="card mb-4 p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold">A system you maintain is worth checking</h2>
        <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {v.system.name} · {v.system.kw} kW · {v.period.start} to {v.period.end}
        </p>
        <p className="mb-2 text-base">{v.summary}</p>
        <p className="mb-3 text-base"><b>Likely cause:</b> {v.likelyCause}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          This is a comparison against a weather-based expected range, so it is a prompt to check, not a finding of fault.
          You see generation data and this evidence only, not the household's bill or contact details.
        </p>
      </section>

      <section className="card mb-4 p-4 sm:p-5">
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Expected vs actual, per day</h2>
        <DailyChart data={v.daily} lang="en" />
        <a href={v.chartUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline"
          style={{ color: 'var(--accent)' }}>Open the evidence chart image</a>
      </section>

      <section className="card p-5 sm:p-6">
        {done ? (
          <div role="status">
            <div className="mb-1 text-lg font-semibold">Thank you ✓</div>
            <p>{late ? 'Your reply was recorded after the response window closed.' : DONE_TEXT[done]}</p>
          </div>
        ) : closed ? (
          <p>This issue is closed.</p>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-semibold">Your response</h2>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>Please respond by {v.deadlineText}. No account needed.</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="Optional note for the household"
              className="mb-3 w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {ACTIONS.map((a) => (
                <button key={a.action} disabled={busy} onClick={() => go(a.action)}
                  className="rounded-xl px-4 py-4 text-left disabled:opacity-60"
                  style={a.action === 'book_visit'
                    ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
                    : { background: 'var(--surface-0)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <div className="text-base font-semibold">{a.label}</div>
                  <div className="text-xs opacity-80">{a.hint}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">SunProof</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Evidence for the installer · no signup</p>
      </header>
      {children}
    </div>
  )
}
