import type { ProJob, TimelineEvent } from '../../api'
import { offOf } from './dates'
import type { Ev, EvKind, Job } from './data'

/** A backend job in the shape the screens use. The list has no chart data; the job page loads that separately. */
export function fromApi(a: ProJob): Job {
  const due = a.overdue ? Math.min(a.daysLeft ?? -1, -1) : (a.daysLeft ?? 0)
  const units = Math.round(a.unitsLost)
  return {
    id: a.issueId, name: a.name, kw: a.kw ?? 3, city: a.city, state: a.state, due, pct: a.pctBelow, drop: a.weeks * 7, seed: 0,
    replyDays: a.replyDays ?? undefined,
    visit: a.visit?.date ? { o: offOf(a.visit.date), t: a.visit.time || '11:00' } : undefined,
    day: a.state === 'check' ? Math.max(1, a.day) : a.day,
    ev: [], noise: [], units, rs: units * 8, rec: Math.round(a.recovered?.kwh ?? 0), real: true, trip: a.trip ?? undefined, failed: a.fixFailed, cleaned: a.recovered?.by === 'cleaning',
  }
}

const KIND: Record<string, EvKind | undefined> = {
  created: 'sent', reminder: 'rem', book_visit: 'book', fixed_remotely: 'remote', visit_done: 'vdone', not_system_issue: 'closed', fixed: 'fixed', cleaned: 'cleaned',
}

/** The progress list: the backend timeline in the events the job page knows how to word. */
export function evsOf(tl: TimelineEvent[], job: Job): Ev[] {
  const out: Ev[] = []
  for (const e of tl) {
    const k = KIND[e.event]
    if (!k) continue
    out.push({ o: offOf(e.at), k, ...(k === 'book' && job.visit ? { v: job.visit.o, t: job.visit.t } : {}) })
    if ((k === 'vdone' || k === 'remote') && job.state === 'check') out.push({ o: offOf(e.at), k: 'check' })
  }
  return out
}
