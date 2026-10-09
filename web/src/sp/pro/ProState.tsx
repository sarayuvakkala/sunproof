import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { demoAdvanceDay, proJob, proJobs, proRespond, proTrip, proVisitDone, type ProJobDetail } from '../../api'
import { useApp } from '../state'
import { SEED_JOBS, type Job } from './data'
import { isoOf } from './dates'
import { fromApi } from './live'
import { ProCtx, type Arrival, type Ctx, type DoneProg, type Fx, type FxType, type Trip } from './proCtx'

const NEW_TRIP: Trip = { s: 0, driving: false, mins: 25, f: 0 }
const FX_MS: Record<FxType, number> = { done: 2700, remote: 3100, notsys: 2900, book: 2700 }
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The installer's jobs. When the backend answers, its jobs come first and the sample homes (except Sharma ji, who is
 * the real demo home) follow. When it does not, the five sample homes are shown and replies stay in the browser.
 */
export function ProProvider({ children }: { children: ReactNode }) {
  const { lang } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const fromVisits = loc.pathname.startsWith('/pro/visits')
  const [samples, setSamples] = useState<Job[]>(SEED_JOBS)
  const [real, setReal] = useState<Job[]>([])
  const [live, setLive] = useState<boolean | null>(null)
  const [details, setDetails] = useState<Record<string, ProJobDetail>>({})
  const lastList = useRef('')
  const api = useRef<Promise<unknown> | null>(null)
  const jobs = useMemo(() => (live ? [...real, ...samples.filter((j) => j.id !== 'sharma')] : samples), [live, real, samples])
  const [fx, setFx] = useState<Fx | null>(null)
  const [toast, setToast] = useState('')
  const [trip, setTrip] = useState<Record<string, Trip>>({})
  const [doneProg, setDoneProg] = useState<DoneProg | null>(null)
  const [arrival, setArrival] = useState<Arrival | null>(null)
  const [glow, setGlow] = useState<string | null>(null)
  const seen = useRef<Set<string> | null>(null)
  const glowTimer = useRef<number>(0)
  const timers = useRef<number[]>([])
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout) }, [])
  const later = useCallback((f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)) }, [])
  const fxRef = useRef<Fx | null>(null)
  const timer = useRef<number>(0)
  const toastTimer = useRef<number>(0)
  const L = useCallback((en: string, hi: string) => (lang === 'hi' ? hi : en), [lang])

  const say = useCallback((m: string) => {
    setToast(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const edit = useCallback((id: string, f: (j: Job) => Job) => setSamples((js) => js.map((j) => (j.id === id ? f(j) : j))), [])

  const load = useCallback(async () => {
    try {
      const r = await proJobs()
      const mapped = r.jobs.map(fromApi)
      // A request counts as "just arrived" the first time it is seen while the app is open (or if it is under 25 s old on first load).
      const first = seen.current === null
      if (first) seen.current = new Set()
      const fresh = r.jobs.find((a) => {
        if (a.state !== 'new') return false
        const k = `${a.issueId}:${a.reopened ? 1 : 0}`
        if (seen.current!.has(k)) return false
        seen.current!.add(k)
        return !first || Date.now() - Date.parse(a.created) < 25000
      })
      if (fresh) {
        const j = mapped.find((m) => m.id === fresh.issueId)!
        setArrival({ id: j.id, name: j.name, kw: j.kw, city: j.city, pct: j.pct, units: j.units, due: j.due, reopened: fresh.reopened })
      }
      const key = JSON.stringify(mapped)
      if (key !== lastList.current) { lastList.current = key; setReal(mapped) }
      setLive(true)
    } catch { setLive((l) => l ?? false) }
  }, [])
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0)
    const t = window.setInterval(() => void load(), 3000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [load])

  const closeArrival = useCallback(() => {
    setArrival((a) => {
      if (a) {
        setGlow(a.id)
        clearTimeout(glowTimer.current)
        glowTimer.current = window.setTimeout(() => setGlow(null), 5200)
      }
      return null
    })
  }, [])

  const loadDetail = useCallback((id: string) => { proJob(id).then((d) => setDetails((m) => ({ ...m, [id]: d }))).catch(() => {}) }, [])

  const finish = useCallback(() => {
    const f = fxRef.current
    if (!f) return
    clearTimeout(timer.current)
    fxRef.current = null
    setFx(null)
    const hi = lang === 'hi'
    if (f.real) {
      void api.current?.catch(() => say(hi ? 'जवाब दर्ज नहीं हो पाया। फिर कोशिश करें।' : 'Could not record the reply. Try again.')).finally(() => { void load(); loadDetail(f.id) })
    }
    if (f.type === 'done') {
      if (!f.real) edit(f.id, (j) => ({ ...j, state: 'check', day: 1, ev: [...j.ev, { o: 0, k: 'vdone' }, { o: 0, k: 'check' }] }))
      setTrip((t) => { const n = { ...t }; delete n[f.id]; return n })
      if (f.fromVisits) {
        setDoneProg({ id: f.id, dots: -1, bars: 0 })
        later(() => setDoneProg({ id: f.id, dots: 0, bars: 0 }), 900)
        later(() => setDoneProg({ id: f.id, dots: 0, bars: 1 }), 1950)
        later(() => setDoneProg({ id: f.id, dots: 1, bars: 1 }), 2650)
        later(() => setDoneProg({ id: f.id, dots: 1, bars: 2 }), 3000)
        later(() => setDoneProg({ id: f.id, dots: 2, bars: 2 }), 3700)
        later(() => setDoneProg(null), 4500)
      } else nav('/pro/jobs')
      say(hi ? 'विज़िट पूरी। SunProof अगले 7 दिन जाँच रहा है।' : 'Visit done. SunProof is checking the next 7 days.')
    } else if (f.type === 'remote') {
      if (!f.real) edit(f.id, (j) => ({ ...j, state: 'check', day: 1, replyDays: 7 - j.due, ev: [...j.ev, { o: 0, k: 'remote' }, { o: 0, k: 'check' }] }))
      say(hi ? 'धन्यवाद। SunProof अगले 7 दिन जाँच रहा है।' : 'Thanks. SunProof is checking the next 7 days.')
    } else if (f.type === 'notsys') {
      if (!f.real) edit(f.id, (j) => ({ ...j, state: 'closed', replyDays: 7 - j.due, ev: [...j.ev, { o: 0, k: 'closed' }] }))
      say(hi ? `बंद किया। ${f.name} को सफ़ाई टैब पर भेजा गया।` : `Closed. ${f.name} is pointed to the Cleaning tab.`)
    } else {
      if (!f.real) edit(f.id, (j) => ({ ...j, state: 'visit', visit: { o: f.o ?? 1, t: f.t ?? '11:00' }, replyDays: 7 - j.due, ev: [...j.ev, { o: 0, k: 'book', v: f.o, t: f.t }] }))
      nav('/pro/visits')
      say(hi ? `तय हो गया। ${f.name} अपने ऐप में देख सकते हैं।` : `Booked. ${f.name} can see it in their app.`)
    }
  }, [edit, lang, nav, say, later, load, loadDetail])

  const startFx = useCallback((type: FxType, id: string, extra?: { o?: number; t?: string; note?: string }) => {
    if (fxRef.current) return
    const j = jobs.find((x) => x.id === id)
    if (!j) return
    const f: Fx = { type, id, name: j.name, fromVisits, real: !!j.real, ...extra }
    if (j.real) {
      api.current = type === 'done' ? proVisitDone(id)
        : type === 'remote' ? proRespond(id, { action: 'fixed_remotely' })
        : type === 'notsys' ? proRespond(id, { action: 'not_system_issue', note: extra?.note })
        : proRespond(id, { action: 'book_visit', visit_date: isoOf(extra?.o ?? 1), visit_time: extra?.t })
    }
    fxRef.current = f
    setFx(f)
    timer.current = window.setTimeout(finish, reduced() ? 900 : FX_MS[type])
  }, [jobs, finish, fromVisits])

  const patchTrip = useCallback((id: string, d: Partial<Trip>) => setTrip((t) => ({ ...t, [id]: { ...NEW_TRIP, ...t[id], ...d } })), [])
  const tripOf = useCallback((id: string): Trip => {
    if (trip[id]) return trip[id]
    const r = jobs.find((j) => j.id === id)?.trip  // a visit already under way (page reloaded, or another device)
    return r ? { ...NEW_TRIP, s: r === 'arrived' ? 2 : 1, f: r === 'arrived' ? 0 : 0.9 } : NEW_TRIP
  }, [trip, jobs])
  const tripNext = useCallback((id: string) => {
    const cur = tripOf(id)
    if (cur.driving) return
    const real = !!jobs.find((j) => j.id === id)?.real
    const report = (step: 'on_the_way' | 'arrived') => { if (real) proTrip(id, step).then(() => load()).catch(() => say(lang === 'hi' ? 'अपडेट नहीं भेजा जा सका।' : 'Could not send the update.')) }
    if (cur.s === 0) {
      report('on_the_way')
      patchTrip(id, { s: 1, driving: true, mins: 25, f: 0.04 })
      later(() => patchTrip(id, { f: 0.9 }), 60)
      ;([[400, 18], [900, 9], [1400, 3]] as const).forEach(([ms, m]) => later(() => patchTrip(id, { mins: m }), ms))
      later(() => patchTrip(id, { driving: false }), 1900)
    } else if (cur.s === 1) {
      report('arrived')
      patchTrip(id, { s: 2, driving: true, f: 0 })
      later(() => patchTrip(id, { driving: false }), 1300)
    } else startFx('done', id)
  }, [tripOf, jobs, patchTrip, later, startFx, load, say, lang])

  const fastForward = useCallback((id: string) => {
    if (jobs.find((j) => j.id === id)?.real) {
      demoAdvanceDay(id, true).then(() => { void load(); loadDetail(id) })
        .catch(() => say(lang === 'hi' ? 'डेमो आगे नहीं बढ़ा।' : 'Could not move the demo on.'))
      return
    }
    edit(id, (j) => ({ ...j, state: 'fixed', day: 7, ev: [...j.ev.filter((e) => e.k !== 'check'), { o: 0, k: 'fixed' }] }))
    say(lang === 'hi' ? 'ठीक हुआ। 7 दिन उत्पादन सामान्य रहा।' : 'Fixed. Output back in range for 7 days.')
  }, [edit, jobs, lang, say, load, loadDetail])

  const value = useMemo<Ctx>(() => ({ lang, L, jobs, live, details, loadDetail, fx, toast, say, startFx, tripOf, tripNext, doneProg, arrival, closeArrival, glow, skipFx: finish, fastForward }), [lang, L, jobs, live, details, loadDetail, fx, toast, say, startFx, tripOf, tripNext, doneProg, arrival, closeArrival, glow, finish, fastForward])
  return <ProCtx.Provider value={value}>{children}</ProCtx.Provider>
}
