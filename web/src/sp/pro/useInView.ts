import { useEffect, useRef, useState } from 'react'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** True once the element has scrolled into view. With reduced motion it is true straight away. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(reduced())
  useEffect(() => {
    if (seen) return
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) { setSeen(true); return }
    const o = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); o.disconnect() } }, { threshold })
    o.observe(el)
    return () => o.disconnect()
  }, [seen, threshold])
  return [ref, seen] as const
}

/** Counts from `from` to `to` once `run` turns true. */
export function useCountTo(to: number, run: boolean, ms = 1200, from = 0, delay = 0) {
  const [v, setV] = useState(reduced() ? to : from)
  useEffect(() => {
    if (!run) return
    let raf = 0
    const t0 = performance.now() + delay
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / ms))
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, to, ms, from, delay])
  return v
}
