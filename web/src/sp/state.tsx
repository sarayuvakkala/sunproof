import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  demoReplayFix, demoReset, getCleanOrSkip, getIssue, getRecovered, getVerdict, respond, sendIssue,
  type CleanOrSkip, type InstallerAction, type Issue, type Recovered, type Verdict,
} from '../api'
import { tr, type Lang } from '../hi'

export const HOME_ID = 'demo-sharma'

export type View = 'idle' | 'sent' | 'rem' | 'esc' | 'visit' | 'ver' | 'fix' | 'reo' | 'dis'
export type Scn = 'dust' | 'rain'
export type Cl = null | 'clean' | 'raining' | 'rain'
export type ScenarioKey = 'before' | 'waiting' | 'visit' | 'remote' | 'low' | 'dis'

const TERMINAL = new Set(['fixed', 'disputed', 'escalation_draft', 'no_data'])

export const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } },
}

export function viewOf(i: Issue | null, holding: boolean): View {
  if (!i) return 'idle'
  if (holding) return 'ver'
  switch (i.status) {
    case 'sent': return i.timeline.some((e) => e.event === 'reminder') ? 'rem' : 'sent'
    case 'no_data': return 'sent'
    case 'visit_booked': return 'visit'
    case 'fixed_remotely': return 'ver'
    case 'fixed': return 'fix'
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
  visitPhase: 'onsite' | 'done' | null
  remoteFix: boolean
  busy: boolean
  toast: string | null
  send: (hold?: Promise<unknown>) => Promise<boolean>
  instReply: (a: InstallerAction) => Promise<void>
  scenarioGo: (k: ScenarioKey) => Promise<void>
  scenarioNow: ScenarioKey | null
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
  const [visitPhase, setVisitPhase] = useState<'onsite' | 'done' | null>(null)
  const [remoteFix, setRemoteFix] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [recovered, setRecovered] = useState<Recovered | null>(null)
  const [scn, setScnS] = useState<Scn>('dust')
  const [clean, setClean] = useState<CleanOrSkip | null>(null)
  const [cl, setClS] = useState<Cl>(null)
  const [scenarioNow, setScenarioNow] = useState<ScenarioKey | null>(null)
  const plan = useRef<'fixed' | 'still_low'>('fixed')
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

  useEffect(() => {
    if (!issue || !v?.isDemo) return
    const id = issue.issueId
    if (issue.status === 'visit_booked') {
      setVisitPhase('onsite')
      const a = setTimeout(() => setVisitPhase('done'), 3200)
      const b = setTimeout(() => { setVisitPhase(null); replay(id, plan.current) }, 4400)
      return () => { clearTimeout(a); clearTimeout(b) }
    }
    if (issue.status === 'fixed_remotely') {
      setRemoteFix(true)
      const b = setTimeout(() => replay(id, plan.current), 500)
      return () => clearTimeout(b)
    }
    if (issue.status === 'sent' || issue.status === 'disputed') setRemoteFix(false)
  }, [issue?.status, issue?.issueId, v?.isDemo, replay])

  // `hold` lets the send animation finish before the screen switches to "Sent".
  const send = useCallback(async (hold?: Promise<unknown>) => {
    setBusy(true)
    try {
      plan.current = 'fixed'
      setScenarioNow(null)
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
      plan.current = 'fixed'
      if (a === 'fixed_remotely') setRemoteFix(true)
      await respond(tokenOf(issue.installerLink), a)
      await loadIssue(issue.issueId)
    } catch (e) {
      flash((e as Error).message || 'Could not record the reply.')
    } finally { setBusy(false) }
  }, [issue, loadIssue, flash])

  const scenarioGo = useCallback(async (k: ScenarioKey) => {
    setBusy(true)
    try {
      await demoReset()
      setIssueId(null); setIssue(null); store.set(`issue:${HOME_ID}`, null)
      setClS(null); setRemoteFix(false); setVisitPhase(null); setHoldUntil(0)
      setScenarioNow(k)
      plan.current = k === 'low' ? 'still_low' : 'fixed'
      if (k !== 'before') {
        const r = await sendIssue(HOME_ID, true)
        const i = await getIssue(r.issueId, HOME_ID)
        const act: Record<string, InstallerAction | undefined> = {
          visit: 'book_visit', low: 'book_visit', remote: 'fixed_remotely', dis: 'not_system_issue',
        }
        if (act[k]) await respond(tokenOf(i.installerLink), act[k]!)
        setIssueId(r.issueId)
        await loadIssue(r.issueId)
      }
      loadV(); loadR()
    } catch (e) {
      flash((e as Error).message || 'Could not switch scenario.')
    } finally { setBusy(false) }
  }, [loadIssue, loadV, loadR, flash])

  const value: Ctx = useMemo(() => ({
    lang, setLang, t, dark, setDark, v, vErr, issue, view, visitPhase, remoteFix, busy, toast, send, instReply,
    scenarioGo, scenarioNow, recovered, scn, setScn, clean, cl, setCl,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang, t, dark, v, vErr, issue, view, visitPhase, remoteFix, busy, toast, send, instReply, scenarioGo, scenarioNow, recovered, scn, clean, cl])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
