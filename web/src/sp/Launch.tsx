import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from './state'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function Launch() {
  const { t, lang, setLang, dark, setDark } = useApp()
  const nav = useNavigate()
  const [on, setOn] = useState(false)
  const [tag, setTag] = useState(false)
  const [grow, setGrow] = useState(false)
  const [cta, setCta] = useState(false)
  const timers = useRef<number[]>([])

  const finish = () => { timers.current.forEach(clearTimeout); setOn(true); setTag(true); setGrow(true); setCta(true) }
  const play = () => {
    timers.current.forEach(clearTimeout)
    setOn(false); setTag(false); setGrow(false); setCta(false)
    if (reduced()) { finish(); return }
    const T = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms))
    T(() => setOn(true), 250)
    T(() => setTag(true), 3500)
    T(() => setGrow(true), 4000)
    T(() => setCta(true), 4400)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { play(); return () => timers.current.forEach(clearTimeout) }, [])

  const seg = (items: [string, string][], cur: string, set: (k: string) => void) => (
    <span className="seg">
      {items.map(([k, l]) => <span key={k} className={cur === k ? 'on' : ''} role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); set(k) }}>{l}</span>)}
    </span>
  )

  return (
    <div className="lp" onClick={finish}>
      <div className="lctl" onClick={(e) => e.stopPropagation()}>
        {seg([['l', t('☀ Light')], ['d', t('🌙 Dark')]], dark ? 'd' : 'l', (k) => setDark(k === 'd'))}
        {seg([['en', 'EN'], ['hi', 'हिं']], lang, (k) => setLang(k as 'en' | 'hi'))}
      </div>
      <div className="lground" /><div className={`lglow ${on ? 'on' : ''}`} /><div className="lhz" />
      <div className="lword">
        <span className={`lpart ${on ? 'in' : ''}`} id="lwS">Sun</span>
        <span className={`lpart ${on ? 'in' : ''}`} id="lwP">Pr
          <svg className={`osun ${on ? 'lgo' : ''}`} id="lo" viewBox="-10 -10 20 20" aria-hidden>
            <g stroke="#f5b300" strokeWidth="2.6" strokeLinecap="round">
              <line y1="-17.8" y2="-13.9" /><line y1="17.8" y2="13.9" /><line x1="-17.8" x2="-13.9" /><line x1="17.8" x2="13.9" />
              <line x1="-12.6" y1="-12.6" x2="-9.8" y2="-9.8" /><line x1="12.6" y1="12.6" x2="9.8" y2="9.8" /><line x1="-12.6" y1="12.6" x2="-9.8" y2="9.8" /><line x1="12.6" y1="-12.6" x2="9.8" y2="-9.8" />
            </g>
            <circle r="9.4" fill="#f5b300" />
          </svg>of
        </span>
      </div>
      <div className={`ltag fade ${tag ? 'in' : ''} ${grow ? 'grow' : ''}`}>
        {t('One click away from')}<br />{t('a greener future.')}
        <svg className="sprout" viewBox="0 0 20 24" aria-hidden>
          <g className="sg">
            <path className="st" pathLength="1" d="M10 24 C10 18 10 14 10 9" stroke="#16a34a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path className="lf" style={{ transformOrigin: '100% 100%', animationDelay: '.45s' }} d="M10 16 C5 16 2 13 2 9 C7 9 10 12 10 16Z" fill="#22c55e" />
            <path className="lf" style={{ transformOrigin: '0% 100%', animationDelay: '.62s' }} d="M10 11 C15 11 18 8 18 4 C13 4 10 7 10 11Z" fill="#16a34a" />
          </g>
        </svg>
      </div>
      <div className={`lcta fade ${cta ? 'in' : ''}`} onClick={(e) => e.stopPropagation()}>
        <span className="act" role="button" tabIndex={0} onClick={() => nav('/app/home')} onKeyDown={(e) => { if (e.key === 'Enter') nav('/app/home') }}>{t('Try the demo')}</span>
        <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--mut)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 0', background: 'var(--bg)' }}>{t('Sign in · Coming soon')}</span>
      </div>
    </div>
  )
}
