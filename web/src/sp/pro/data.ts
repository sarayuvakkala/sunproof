import { dm } from './dates'
import type { Lang } from '../../hi'

export type JState = 'new' | 'visit' | 'check' | 'fixed' | 'closed'
export type EvKind = 'sent' | 'rem' | 'book' | 'remote' | 'vdone' | 'closed' | 'check' | 'fixed' | 'cleaned'
export interface Ev { o: number; k: EvKind; v?: number; t?: string }
export interface Job {
  id: string; name: string; kw: number; city: string; state: JState
  due: number; pct: number; drop: number; seed: number
  replyDays?: number; visit?: { o: number; t: string }; day: number
  ev: Ev[]; noise: number[]; units: number; rs: number; rec: number
  real?: boolean  // comes from the backend (otherwise a sample home)
  trip?: 'on_the_way' | 'arrived'  // visit progress reported by the installer (backend jobs only)
  cleaned?: boolean  // fixed because the home owner cleaned the panels
  failed?: boolean  // the fix check ended early: output fell again, and the home owner is deciding what to do
}
export type Shown = 'reply' | 'overdue' | 'visit' | 'check' | 'fixed' | 'closed'

function rng(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const p50 = (j: Job, i: number) => j.kw * 4.65 * (1 + 0.07 * Math.sin(i / 3.1 + j.seed))
export function val(j: Job, i: number) {
  const n = j.noise[i] - 0.5, b = p50(j, i)
  if (i < 7) return b * (1 + n * 0.08)
  if (i < 7 + j.drop) return b * (1 - j.pct / 100) * (1 + n * 0.05)
  return b * (1 + n * 0.06)
}
function mk(o: Omit<Job, 'noise' | 'units' | 'rs' | 'rec' | 'day'> & { day?: number }): Job {
  const r = rng(o.seed * 97 + 11), noise: number[] = []
  for (let i = 0; i < 80; i++) noise.push(r())
  const j: Job = { ...o, day: o.day ?? 0, noise, units: 0, rs: 0, rec: 0 }
  let u = 0, i
  for (i = 7; i < 7 + j.drop; i++) u += p50(j, i) - val(j, i)
  j.units = Math.round(u); j.rs = Math.round(u * 8)
  let rc = 0
  for (i = 7 + j.drop; i < 14 + j.drop; i++) rc += val(j, i) - p50(j, i) * (1 - j.pct / 100)
  j.rec = Math.round(rc)
  return j
}

/** Five sample homes. Real jobs replace these when the backend is connected. */
export const SEED_JOBS = (): Job[] => [
  mk({ id: 'sharma', name: 'Sharma ji', kw: 3, city: 'Delhi', state: 'new', due: 4, pct: 15, drop: 23, seed: 2, ev: [{ o: -3, k: 'sent' }] }),
  mk({ id: 'gupta', name: 'Gupta ji', kw: 5, city: 'Noida', state: 'new', due: -1, pct: 22, drop: 16, seed: 5, ev: [{ o: -8, k: 'sent' }, { o: -5, k: 'rem' }] }),
  mk({ id: 'iyer', name: 'Iyer family', kw: 2, city: 'Gurugram', state: 'visit', due: 0, pct: 12, drop: 20, seed: 7, replyDays: 1, visit: { o: 1, t: '11:00' }, ev: [{ o: -4, k: 'sent' }, { o: -3, k: 'book', v: 1, t: '11:00' }] }),
  mk({ id: 'khan', name: 'Khan home', kw: 4, city: 'Faridabad', state: 'visit', due: 0, pct: 18, drop: 14, seed: 9, replyDays: 2, visit: { o: 0, t: '15:00' }, ev: [{ o: -10, k: 'sent' }, { o: -8, k: 'book', v: 0, t: '15:00' }] }),
  mk({ id: 'verma', name: 'Verma ji', kw: 3, city: 'Ghaziabad', state: 'fixed', due: 0, pct: 19, drop: 18, seed: 12, replyDays: 1, ev: [{ o: -18, k: 'sent' }, { o: -17, k: 'book', v: -14, t: '10:00' }, { o: -14, k: 'vdone' }, { o: -7, k: 'fixed' }] }),
]

export const st = (j: Job): Shown => (j.state === 'new' ? (j.due < 0 ? 'overdue' : 'reply') : j.state)
export const weeks = (j: Job) => Math.max(1, Math.round(j.drop / 7))
export function order(j: Job) {
  const s = st(j)
  const base = { overdue: 0, reply: 1, visit: 2, check: 3, fixed: 4, closed: 5 }[s] * 100
  return base + (s === 'reply' ? j.due : s === 'visit' && j.visit ? j.visit.o * 4 + parseInt(j.visit.t, 10) / 10 : 0)
}
export const sur = (j: Job) => j.name.split(' ')[0]
export const probStart = (j: Job, lang: Lang) => dm(-(j.drop + (j.state === 'check' ? j.day : j.state === 'fixed' ? 7 : 0)), lang)
