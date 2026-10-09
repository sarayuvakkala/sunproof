import { useState, type RefObject } from 'react'
import { useApp } from './state'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const EASE_FLY = 'cubic-bezier(.45,.05,.4,1)'
const NS = 'http://www.w3.org/2000/svg'

type Fx = { done: Promise<void>; finish: () => void; cancel: () => void }

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4
  return `<line x1="${95 + Math.cos(a) * 10}" y1="${74 + Math.sin(a) * 10}" x2="${95 + Math.cos(a) * 15}" y2="${74 + Math.sin(a) * 15}"/>`
}).join('')

function svg(cls: string, w: number, h: number, inner: string) {
  const s = document.createElementNS(NS, 'svg')
  s.setAttribute('class', cls)
  s.setAttribute('viewBox', `0 0 ${w} ${h}`)
  s.setAttribute('width', String(w))
  s.setAttribute('height', String(h))
  s.setAttribute('aria-hidden', 'true')
  s.innerHTML = inner
  return s
}

/** Copy each element's settled look onto the clone so entrance animations don't replay on it. */
function freeze(src: Element, dst: Element) {
  const a = [src, ...src.querySelectorAll('*')], b = [dst, ...dst.querySelectorAll('*')]
  a.forEach((el, i) => {
    const cs = getComputedStyle(el), d = b[i] as HTMLElement
    d.style.animation = 'none'
    d.style.opacity = cs.opacity
    d.style.transform = cs.transform === 'none' ? 'none' : cs.transform
    if (el instanceof SVGElement) d.style.strokeDashoffset = cs.strokeDashoffset
  })
}

/**
 * Evidence card folds into an envelope, a sun seal stamps on, the envelope becomes a paper plane
 * that flies to the installer's avatar on a trail of sunlight.
 */
function startSendFx(card: HTMLElement, avatar: HTMLElement | null, root: HTMLElement): Fx {
  if (reduced()) return { done: Promise.resolve(), finish: () => {}, cancel: () => {} }
  const vw = window.innerWidth, vh = window.innerHeight
  const r = card.getBoundingClientRect()
  const ex = r.left + r.width / 2
  const ey = Math.min(Math.max(r.top + r.height / 2, 170), vh - 190)

  let ax = vw - 60, ay = 40
  if (avatar) {
    const a = avatar.getBoundingClientRect()
    ax = a.left + a.width / 2
    ay = a.top >= 0 && a.bottom <= vh ? a.top + a.height / 2 : 40
  }
  const dx = ax - ex, dy = Math.min(ay - ey, -160)
  const kx = (Math.sign(dx) || 1) * (Math.max(Math.abs(dx), 110) / 128), ky = dy / -192
  const k = Math.min(150 / r.width, 100 / r.height)
  const p = (rx: number, ry: number) => `${(ex + rx * kx).toFixed(1)} ${(ey - ry * ky).toFixed(1)}`
  const d = `M${ex.toFixed(1)} ${ey.toFixed(1)} C${p(-98, 30)} ${p(-110, 172)} ${p(6, 156)} C${p(70, 146)} ${p(100, 176)} ${ax.toFixed(1)} ${(ey + dy).toFixed(1)}`

  const ov = document.createElement('div')
  ov.className = 'sfx'
  const env = document.createElement('div')
  env.className = 'sfx-env'
  env.style.transformOrigin = `${ex}px ${ey}px`

  const back = svg('sfx-e', 190, 124, '<rect x="0" y="8" width="190" height="116" rx="10" fill="var(--env2)" stroke="var(--ink)" stroke-width="2.4"/>')
  const front = svg('sfx-e', 190, 124,
    '<path d="M1 124 V16 L95 76 L189 16 V124 Z" fill="var(--env)" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path class="sfx-flap" d="M1 8 H189 L95 78 Z" fill="var(--env2)" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>' +
    `<g class="sfx-seal"><circle cx="95" cy="74" r="11" fill="#f5b300" stroke="var(--ink)" stroke-width="2"/><g stroke="#f5b300" stroke-width="3" stroke-linecap="round">${RAYS}</g></g>`)
  for (const s of [back, front]) Object.assign(s.style, { left: `${ex - 95}px`, top: `${ey - 62}px`, opacity: '0' })
  back.style.zIndex = '1'
  front.style.zIndex = '3'

  const ghost = card.cloneNode(true) as HTMLElement
  freeze(card, ghost)
  Object.assign(ghost.style, { position: 'absolute', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '2', transformOrigin: 'center' })
  env.append(back, ghost, front)

  const trail = svg('sfx-trail', vw, vh,
    `<defs><linearGradient id="sfxg" x1="0" x2="1"><stop offset="0" stop-color="#f5b300" stop-opacity="0"/><stop offset="1" stop-color="#ffd25a"/></linearGradient></defs><path pathLength="1" d="${d}"/>`)
  const plane = document.createElement('div')
  plane.className = 'sfx-plane'
  plane.style.offsetPath = `path('${d}')`
  plane.appendChild(svg('', 56, 40,
    '<polygon points="2,20 54,3 36,37 28,24" fill="var(--card)" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<polygon points="2,20 28,24 54,3" fill="var(--env)" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M28 24 L54 3" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="30" cy="17" r="3.4" fill="#f5b300" stroke="var(--ink)" stroke-width="1.4"/>'))
  const ring = document.createElement('div')
  ring.className = 'sfx-ring'
  Object.assign(ring.style, { left: `${ax - 26}px`, top: `${ay - 26}px`, width: '52px', height: '52px' })

  ov.append(env, trail, plane, ring)
  root.appendChild(ov)
  card.style.visibility = 'hidden'

  const both = { fill: 'both' as const }
  const flap = front.querySelector('.sfx-flap') as SVGElement, seal = front.querySelector('.sfx-seal') as SVGElement
  const anims: Animation[] = [
    ghost.animate([
      { transform: 'none' },
      { transform: `translate(${ex - (r.left + r.width / 2)}px,${ey - (r.top + r.height / 2) - 6}px) scale(${k})`, offset: 0.45 },
      { transform: `translate(${ex - (r.left + r.width / 2)}px,${ey - (r.top + r.height / 2) + 26}px) scale(${k})`, offset: 0.78, opacity: 1 },
      { transform: `translate(${ex - (r.left + r.width / 2)}px,${ey - (r.top + r.height / 2) + 26}px) scale(${k})`, opacity: 0 },
    ], { duration: 1300, delay: 100, easing: 'cubic-bezier(.5,0,.3,1)', ...both }),
    back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 500, ...both }),
    front.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 500, ...both }),
    flap.animate([{ transform: 'scaleY(-1)' }, { transform: 'scaleY(1)' }], { duration: 400, delay: 1050, easing: 'ease-in-out', ...both }),
    seal.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'none' }], { duration: 450, delay: 1500, easing: 'cubic-bezier(.3,1.8,.5,1)', ...both }),
    env.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.4) rotate(-10deg)', opacity: 0 }], { duration: 450, delay: 2000, easing: 'ease-in', ...both }),
    plane.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: 1500, delay: 2350, easing: EASE_FLY, ...both }),
    plane.firstElementChild!.animate([
      { opacity: 0, transform: 'scale(.2) rotate(-30deg)' },
      { opacity: 1, transform: 'scale(1.2) rotate(6deg)', offset: 0.14 },
      { opacity: 1, transform: 'none', offset: 0.19 },
      { opacity: 1, transform: 'none', offset: 0.91 },
      { opacity: 0, transform: 'scale(.25)' },
    ], { duration: 1850, delay: 2050, ...both }),
    trail.querySelector('path')!.animate([{ strokeDashoffset: '0.3', opacity: 1 }, { strokeDashoffset: '-0.7', opacity: 1 }], { duration: 1500, delay: 2350, easing: EASE_FLY, ...both }),
    trail.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, delay: 3600, ...both }),
    ring.animate([{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.9)' }], { duration: 900, delay: 3750, easing: 'ease-out', fill: 'forwards' }),
  ]
  if (avatar) anims.push(avatar.animate([{ transform: 'none' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 420, delay: 3750, easing: 'ease-out' }))

  let gone = false
  const remove = () => { if (gone) return; gone = true; ov.remove(); card.style.visibility = '' }
  return {
    done: Promise.all(anims.map((a) => a.finished)).then(() => undefined, () => undefined),
    finish: () => { ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished.then(remove, remove) },
    cancel: () => { anims.forEach((a) => a.cancel()); remove() },
  }
}

/** Big approve-and-send button. Nothing goes out until it is pressed. */
export function SendButton({ cardRef, avatarRef }: { cardRef: RefObject<HTMLDivElement | null>; avatarRef: RefObject<HTMLDivElement | null> }) {
  const { t, send, busy } = useApp()
  const [running, setRunning] = useState(false)

  const go = async () => {
    if (running || busy) return
    const card = cardRef.current, root = card?.closest('.sp') as HTMLElement | null
    if (!card || !root) { await send(); return }
    setRunning(true)
    const av = avatarRef.current
    if (av && av.getBoundingClientRect().top < 70) {
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' })
      await new Promise((r) => setTimeout(r, reduced() ? 0 : 420))
    }
    const fx = startSendFx(card, avatarRef.current, root)
    const ok = await send(fx.done)
    if (ok) fx.finish()
    else { fx.cancel(); setRunning(false) }
  }

  return (
    <button type="button" className="sendbtn" disabled={running || busy} onClick={() => void go()}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" />
      </svg>
      {running ? t('Sending…') : t('Send to my installer')}
    </button>
  )
}
