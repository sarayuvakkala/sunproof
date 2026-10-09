import { createContext, useContext } from 'react'
import type { Lang } from '../../hi'
import type { ProJobDetail } from '../../api'
import type { Job } from './data'

export type FxType = 'done' | 'remote' | 'notsys' | 'book'
export interface Fx { type: FxType; id: string; name: string; o?: number; t?: string; note?: string; fromVisits?: boolean; real?: boolean }

export interface Trip { s: 0 | 1 | 2; driving: boolean; mins: number; f: number }
export interface Arrival { id: string; name: string; kw: number; city: string; pct: number; units: number; due: number; reopened: boolean }
export interface DoneProg { id: string; dots: number; bars: number }

export interface Ctx {
  lang: Lang
  L: (en: string, hi: string) => string
  jobs: Job[]
  fx: Fx | null
  toast: string
  say: (m: string) => void
  /** true: jobs come from the backend; false: backend not reachable, sample homes only; null: still checking */
  live: boolean | null
  details: Record<string, ProJobDetail>
  loadDetail: (id: string) => void
  startFx: (type: FxType, id: string, extra?: { o?: number; t?: string; note?: string }) => void
  /** Progress of today's visit: what the installer has done so far. Backend jobs resume from what the backend says. */
  tripOf: (id: string) => Trip
  tripNext: (id: string) => void
  doneProg: DoneProg | null
  /** A request that just came in from a home owner: plays the plane-and-envelope arrival, then the job glows in the list. */
  arrival: Arrival | null
  closeArrival: () => void
  glow: string | null
  skipFx: () => void
  fastForward: (id: string) => void
}

export const ProCtx = createContext<Ctx | null>(null)
export const useProApp = () => {
  const c = useContext(ProCtx)
  if (!c) throw new Error('useProApp outside ProProvider')
  return c
}

