import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Spring count-up that starts when scrolled into view. en-IN number format. */
export function Ticker({ value, decimals = 0, delay = 0 }: { value: number; decimals?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(reduced() ? value : 0)
  const from = useRef(reduced() ? value : 0)
  const seen = useRef(false)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect() } })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    if (reduced()) { setShown(value); from.current = value; return }
    let x = from.current
    let v = 0
    let raf = 0
    const wait = seen.current ? 0 : delay
    seen.current = true
    const tm = setTimeout(() => {
      const step = () => {
        v += (100 * (value - x) - 21 * v) / 60
        x += v / 60
        setShown(x)
        if (Math.abs(value - x) > Math.max(0.004, Math.abs(value) / 1000) || Math.abs(v) > 0.02) raf = requestAnimationFrame(step)
        else { setShown(value); from.current = value }
      }
      raf = requestAnimationFrame(step)
    }, wait)
    return () => { clearTimeout(tm); cancelAnimationFrame(raf); from.current = value }
  }, [value, inView, delay])

  const f = new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return <span ref={ref}>{f.format(shown)}</span>
}
