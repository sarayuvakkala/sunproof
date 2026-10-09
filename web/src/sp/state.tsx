import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  demoAdvanceDay, demoReplayFix, getCleanOrSkip, getIssue, getRecovered, getVerdict, respond, revisit as revisitApi, cleanedApi, sendIssue,
  type CleanOrSkip, type InstallerAction, type Issue, type Recovered, type Verdict,
} from '../api'
import { tr, type Lang } from '../hi'

export type View = 'idle' | 'sent' | 'rem' | 'esc' | 'visit' | 'ver' | 'fix' | 'fail' | 'reo' | 'dis'
export type Scn = 'dust' | 'rain'
export type Cl = null | 'clean' | 'raining' | 'rain'

const TERMINAL = new Set(['fixed', 'disputed', 'escalation_draft', 'no_data'])

export const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } },
}

/** The demo house on screen: Sharma ji (the repair holds) or Mehta ji (it fails after a few days). Chosen in the house picker. */
export const DEMO_HOUSES: [string, string][] = [['demo-sharma', 'Sharma ji'], ['demo-mehta', 'Mehta ji']]
export const HOME_ID = DEMO_HOUSES.some(([id]) => id === store.get('sp:home')) ? (store.get('sp:home') as string) : 'demo-sharma'
/** One day of the 7-day check takes this long in the demo, unless the presenter taps "next day". */
export const DAY_MS = 10000

export function viewOf(i: Issue | null, holding: boolean): View {
  if (!i) return 'idle'
  if (holding) return 'ver'
  switch (i.status) {
    case 'sent': return i.timeline.some((e) => e.event === 'reminder') ? 'rem' : 'sent'
    case 'no_data': return 'sent'
    case 'visit_booked': return i.visitDone ? 'ver' : 'visit'  // a finished visit means the 7-day check is running
    case 'fixed_remotely': return 'ver'
    case 'fixed': return 'fix'
    case 'fix_failed': return 'fail'
    case 'reopened': return 'reo'
    case 'escalation_draft': return 'esc'
    case 'disputed': return 'dis'
  }
}

export const tokenOf = (link: string) => link.split('/').filter(Boolean).pop() ?? ''

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (en: string) => string
  dark: boolean
  setDark: (d: boolean) => void
  v: Verdict | null
  vErr: boolean
  issue: Issue | null
  view: View
  visitPhase: 'enroute' | 'onsite' | 'done' | null
  /** When the next day of the 7-day check lands (ms since epoch), and a way to land it now. */
  nextAt: number
  advanceDay: (manual?: boolean) => Promise<void>
  revisit: () => Promise<void>
  /** The home owner cleaned the panels. If that is what the open issue needed, it is fixed for the installer too. */
  markCleaned: () => Promise<void>
  remoteFix: boolean
  busy: boolean
  toast: string | null
  send: (hold?: Promise<unknown>) => Promise<boolean>
  instReply: (a: InstallerAction) => Promise<void>
  recovered: Recovered | null
  scn: Scn
  setScn: (s: Scn) => void
  clean: CleanOrSkip | null
  cl: Cl
  setCl: (c: Cl) => void
}

const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside AppProvider')
  return c
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>(() => (store.get('sp:lang') === 'hi' ? 'hi' : 'en'))
  const [dark, setDarkS] = useState<boolean>(() => {
    const s = store.get('sp:dark')
    if (s !== null) return s === '1'
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [v, setV] = useState<Verdict | null>(null)
  const [vErr, setVErr] = useState(false)
  const [issueId, setIssueId] = useState<string | null>(() => store.get(`issue:${HOME_ID}`))
  const [issue, setIssue] = useState<Issue | null>(null)
  const [holdUntil, setHoldUntil] = useState(0)
  const [, tickNow] = useState(0)
  const [simPhase, setSimPhase] = useState<'onsite' | 'done' | null>(null)
  const [remoteFix, setRemoteFix] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [recovered, setRecovered] = useState<Recovered | null>(null)
  const [scn, setScnS] = useState<Scn>('dust')
  const [clean, setClean] = useState<CleanOrSkip | null>(null)
  const [cl, setClS] = useState<Cl>(null)
  const plan = useRef<'fixed' | 'still_low'>('fixed')
  const [nextAt, setNextAt] = useState(0)
  const nextAtRef = useRef(0)
  const advancing = useRef(false)
  const issueRef = useRef<Issue | null>(null)
  issueRef.current = issue

  const setLang = (l: Lang) => { setLangS(l); store.set('sp:lang', l) }
  const setDark = (d: boolean) => { setDarkS(d); store.set('sp:dark', d ? '1' : '0') }
  const setCl = (c: Cl) => setClS(c)
  const setScn = (s: Scn) => { setScnS(s); setClS(null) }
  const t = useCallback((en: string) => tr(en, lang), [lang])

  const flash = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast((cur) => (cur === m ? null : cur)), 3500)
  }, [])

  const loadV = useCallback(() => {
    getVerdict(HOME_ID).then((x) => {
      setV(x)
      setVErr(false)
      setIssueId((cur) => cur ?? x.activeIssue)
    }).catch(() => setVErr(true))
  }, [])
  const loadR = useCallback(() => { getRecovered().then(setRecovered).catch(() => {}) }, [])
  const loadIssue = useCallback(async (id: string) => {
    try {
      const i = await getIssue(id, HOME_ID)
      setIssue(i)
      return i
    } catch (e) {
      const st = (e as { status?: number }).status
      if (st === 404 || st === 403) { setIssueId(null); setIssue(null); store.set(`issue:${HOME_ID}`, null) }
      return null
    }
  }, [])

  useEffect(() => { loadV(); loadR() }, [loadV, loadR])

  useEffect(() => {
    if (!issueId) { setIssue(null); return }
    store.set(`issue:${HOME_ID}`, issueId)
    let stop = false
    const run = () => { if (!stop) loadIssue(issueId) }
    run()
    const id = setInterval(() => {
      const cur = issueRef.current
      if (!cur || !TERMINAL.has(cur.status)) run()
    }, 3000)
    return () => { stop = true; clearInterval(id) }
  }, [issueId, loadIssue])

  const status = issue?.status
  useEffect(() => { loadV(); loadR() }, [status, loadV, loadR])

  useEffect(() => {
    getCleanOrSkip(HOME_ID, v?.isDemo === false ? 'live' : scn).then(setClean).catch(() => {})
  }, [scn, v?.isDemo, status])

  // A visit booked in the installer app reports its own progress (on the way, arrived, done). Only a visit booked
  // through the old link, which has no installer app, still plays a timed pretend visit.
  const reported = issue?.status === 'visit_booked' && typeof issue.visitDone === 'boolean'
  const visitPhase: 'enroute' | 'onsite' | 'done' | null = reported
    ? (issue.trip?.stage === 'arrived' ? 'onsite' : issue.trip?.stage === 'on_the_way' ? 'enroute' : null)
    : simPhase
  const holding = holdUntil > Date.now()
  const view = viewOf(issue, holding)

  const replay = useCallback(async (id: string, outcome: 'fixed' | 'still_low') => {
    const until = Date.now() + 4200
    setHoldUntil(until)
    setTimeout(() => tickNow((n) => n + 1), 4250)
    try { await demoReplayFix(id, outcome) } catch { flash('Replay failed. Try again.') }
    await loadIssue(id)
    loadV(); loadR()
  }, [loadIssue, loadV, loadR, flash])

  // Visits and fixes reported from the installer app run the 7-day check one day at a time: a day lands every DAY_MS, or
  // sooner when the presenter taps "next day". The legacy link has no installer app, so it keeps the instant replay below.
  const checking = !!issue && typeof issue.visitDone === 'boolean' && ((issue.status === 'visit_booked' && issue.visitDone) || issue.status === 'fixed_remotely')
  const loadAll = useCallback(async (id: string) => { await loadIssue(id); loadV(); loadR() }, [loadIssue, loadV, loadR])
  const advanceDay = useCallback(async (manual = false) => {
    const id = issueRef.current?.issueId
    if (!id || advancing.current) return
    advancing.current = true
    try { await demoAdvanceDay(id, manual) } catch { /* the check may just have finished */ }
    await loadAll(id)
    advancing.current = false
    nextAtRef.current = Date.now() + DAY_MS
    setNextAt(nextAtRef.current)
  }, [loadAll])
  useEffect(() => {
    if (!checking || !v?.isDemo) return
    if (nextAtRef.current < Date.now()) { nextAtRef.current = Date.now() + DAY_MS; setNextAt(nextAtRef.current) }
    const id = setInterval(() => { if (Date.now() >= nextAtRef.current) void advanceDay(false) }, 400)
    return () => clearInterval(id)
  }, [checking, v?.isDemo, advanceDay])

  const revisit = useCallback(async () => {
    if (!issue) return
    setBusy(true)
    try { await revisitApi(issue.issueId, HOME_ID); await loadAll(issue.issueId) } catch (e) { flash((e as Error).message || 'Could not send. Try again.') } finally { setBusy(false) }
  }, [issue, loadAll, flash])

  const markCleaned = useCallback(async () => {
    const i = issueRef.current
    if (i && (i.status === 'fix_failed' || i.status === 'disputed')) {
      setBusy(true)
      try { await cleanedApi(i.issueId, HOME_ID); await loadAll(i.issueId) } catch (e) { flash((e as Error).message || 'Could not send. Try again.') } finally { setBusy(false) }
    }
    setClS('clean')
  }, [loadAll, flash])

  useEffect(() => {
    if (!issue || !v?.isDemo) return
    const id = issue.issueId
    if (typeof issue.visitDone === 'boolean') return
    if (issue.status === 'visit_booked') {
      setSimPhase('onsite')
      const a = setTimeout(() => setSimPhase('done'), 3200)
      const b = setTimeout(() => { setSimPhase(null); replay(id, plan.current) }, 4400)
      return () => { clearTimeout(a); clearTimeout(b) }
    }
    if (issue.status === 'fixed_remotely') {
      setRemoteFix(true)
      const b = setTimeout(() => replay(id, plan.current), 500)
      return () => clearTimeout(b)
    }
    if (issue.status === 'sent' || issue.status === 'disputed') setRemoteFix(false)
  }, [issue?.status, issue?.issueId, issue?.visitDone, v?.isDemo, replay])

  // `hold` lets the send animation finish before the screen switches to "Sent".
  const send = useCallback(async (hold?: Promise<unknown>) => {
    setBusy(true)
    try {
      const r = await sendIssue(HOME_ID, true)
      if (hold) await hold
      setIssueId(r.issueId)
      await loadIssue(r.issueId)
      return true
    } catch (e) {
      flash((e as Error).message || 'Could not send. Try again.')
      return false
    } finally { setBusy(false) }
  }, [loadIssue, flash])

  const instReply = useCallback(async (a: InstallerAction) => {
    if (!issue) return
    setBusy(true)
    try {
      if (a === 'fixed_remotely') setRemoteFix(true)
      await respond(tokenOf(issue.installerLink), a)
      await loadIssue(issue.issueId)
    } catch (e) {
      flash((e as Error).message || 'Could not record the reply.')
    } finally { setBusy(false) }
  }, [issue, loadIssue, flash])

  const value: Ctx = useMemo(() => ({
    lang, setLang, t, dark, setDark, v, vErr, issue, view, visitPhase, nextAt, advanceDay, revisit, markCleaned, remoteFix, busy, toast, send, instReply,
    recovered, scn, setScn, clean, cl, setCl,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang, t, dark, v, vErr, issue, view, visitPhase, nextAt, advanceDay, markCleaned, remoteFix, busy, toast, send, instReply, recovered, scn, clean, cl])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
