import type { Job } from './data'

export interface Row { n: string; c: string; ago: number; u: number; r: number; f: boolean; cl?: boolean }

/** Past closed jobs for the sample record. `ago` is how many months back the job closed. */
const PAST: Row[] = [
  { n: 'Mehta ji', c: 'Delhi', ago: 3, u: 42, r: 1, f: true },
  { n: 'Bose home', c: 'Noida', ago: 2, u: 35, r: 2.5, f: true },
  { n: 'Reddy home', c: 'Gurugram', ago: 2, u: 18, r: 0.5, f: true },
  { n: 'Kapoor ji', c: 'Faridabad', ago: 1, u: 0, r: 4, f: false },
  { n: 'Nair family', c: 'Delhi', ago: 1, u: 27, r: 1.5, f: true },
  { n: 'Joshi ji', c: 'Noida', ago: 5, u: 80, r: 1.5, f: true },
  { n: 'Das family', c: 'Gurugram', ago: 6, u: 0, r: 5, f: false },
  { n: 'Patel home', c: 'Delhi', ago: 7, u: 29, r: 1, f: true },
  { n: 'Singh ji', c: 'Ghaziabad', ago: 7, u: 38, r: 2, f: true },
]

/** Past sample jobs plus every job closed this session (fixed or not a system issue). Newest first. */
export function recordRows(jobs: Job[]): Row[] {
  const rows: Row[] = jobs.filter((j) => j.state === 'fixed' || j.state === 'closed')
    .map((j) => ({ n: j.name, c: j.city, ago: 0, u: j.state === 'fixed' ? j.rec : 0, r: j.replyDays ?? 1, f: j.state === 'fixed', cl: j.cleaned }))
  return [...rows, ...PAST].sort((a, b) => a.ago - b.ago)
}

export function recordStats(rows: Row[]) {
  const n = rows.length, f = rows.filter((x) => x.f).length, u = rows.reduce((a, x) => a + x.u, 0)
  const co2 = Math.round(u * 0.705)
  return {
    n, f, u, co2,
    avg: n ? rows.reduce((a, x) => a + x.r, 0) / n : 0,
    fast: n ? Math.round((rows.filter((x) => x.r <= 2).length / n) * 100) : 0,
    trees: Math.round(co2 / 22), rs: Math.round(u * 8),
  }
}
