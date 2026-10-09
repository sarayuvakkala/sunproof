import { useEffect, useRef } from 'react'
import { useApp } from './state'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Slide-to-send. The sun on the knob brightens as you drag; the screen fills with light on release. */
export function Slide({ onSend }: { onSend: () => Promise<void> }) {
  const { t } = useApp()
  const slide = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const core = useRef<SVGCircleElement>(null)
  const rays = useRef<SVGGElement>(null)
  const kg = useRef<HTMLSpanElement>(null)
  const st = useRef({ drag: false, sx: 0, tx: 0, dx: 0, busy: false, k: 0.4, raf: 0, fin: false })
  const send = useRef(onSend)
  send.current = onSend

  useEffect(() => {
    const sl = slide.current!, kn = knob.current!, fl = fill.current!
    const go = document.getElementById('glowO'), gf = document.getElementById('glowF')
    const s = st.current
    const max = () => sl.clientWidth - 58
    if (go) go.style.transition = 'none'
    const bright = (p: number) => {
      core.current?.setAttribute('fill', `rgb(${Math.round(150 + 105 * p)},${Math.round(110 + 114 * p)},${Math.round(30 + 72 * p)})`)
      rays.current?.setAttribute('opacity', (0.35 + 0.65 * p).toFixed(2))
      rays.current?.setAttribute('transform', `scale(${(0.75 + 0.55 * p).toFixed(3)}) rotate(${(p * 90).toFixed(1)})`)
      if (kg.current) kg.current.style.opacity = (p * 0.9).toFixed(3)
      if (go) go.style.opacity = Math.pow(p, 1.4).toFixed(3)
      if (gf) gf.style.opacity = (0.9 * p).toFixed(3)
    }
    const draw = () => {
      const m = max()
      kn.style.transform = `translate3d(${s.dx.toFixed(2)}px,0,0)`
      fl.style.transform = `translate3d(${(s.dx - m).toFixed(2)}px,0,0)`
      const p = m ? s.dx / m : 0
      kn.setAttribute('aria-valuenow', String(Math.round(p * 100)))
      bright(p)
    }
    const finish = async () => {
      s.busy = true
      if (go && !reduced()) { go.style.transition = 'opacity .7s ease'; go.style.opacity = '1' }
      if (gf) gf.style.opacity = '1'
      await Promise.all([send.current(), new Promise((r) => setTimeout(r, 800))])
      const g = document.getElementById('glowO')
      if (g) { g.style.transition = 'opacity 1s ease'; g.style.opacity = '0' }
    }
    const loop = () => {
      s.dx += (s.tx - s.dx) * s.k
      if (Math.abs(s.tx - s.dx) < 0.15) s.dx = s.tx
      draw()
      if (s.dx !== s.tx || s.drag) s.raf = requestAnimationFrame(loop)
      else { s.raf = 0; if (s.fin) { s.fin = false; void finish() } }
    }
    const kick = () => { if (!s.raf) s.raf = requestAnimationFrame(loop) }
    draw()
    kn.onpointerdown = (e) => { if (s.busy) return; s.drag = true; s.k = 0.45; s.sx = e.clientX - s.tx; kn.setPointerCapture(e.pointerId); kick() }
    kn.onpointermove = (e) => { if (s.drag) s.tx = Math.max(0, Math.min(max(), e.clientX - s.sx)) }
    kn.onpointerup = () => {
      if (!s.drag) return
      s.drag = false
      if (s.tx > max() * 0.85) { s.tx = max(); s.k = 0.13; s.fin = true } else { s.tx = 0; s.k = 0.14 }
      kick()
    }
    kn.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !s.busy) { e.preventDefault(); s.busy = true; s.tx = max(); s.k = 0.06; s.fin = true; kick() } }
    return () => { cancelAnimationFrame(s.raf); kn.onpointerdown = kn.onpointermove = kn.onpointerup = kn.onkeydown = null }
  }, [])

  return (
    <div className="slide" ref={slide}>
      <div className="sfill" ref={fill} style={{ transform: 'translate3d(-9999px,0,0)' }} />
      <div className="stext">{t('Slide to approve and send')}</div>
      <div className="knob" ref={knob} role="slider" tabIndex={0} aria-label="Slide to approve and send" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
        <span className="kg" ref={kg} />
        <svg width="40" height="40" viewBox="-20 -20 40 40" aria-hidden>
          <g ref={rays} stroke="#f5b300" strokeWidth="2.6" strokeLinecap="round" opacity=".45" transform="scale(.75)">
            <line y1="-17.8" y2="-13.9" /><line y1="17.8" y2="13.9" /><line x1="-17.8" x2="-13.9" /><line x1="17.8" x2="13.9" />
            <line x1="-12.6" y1="-12.6" x2="-9.8" y2="-9.8" /><line x1="12.6" y1="12.6" x2="9.8" y2="9.8" /><line x1="-12.6" y1="12.6" x2="-9.8" y2="9.8" /><line x1="12.6" y1="-12.6" x2="9.8" y2="-9.8" />
          </g>
          <circle ref={core} r="8" fill="#f5b300" />
        </svg>
      </div>
    </div>
  )
}
