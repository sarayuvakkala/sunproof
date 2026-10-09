import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Ic, type IconName } from './ic'
import { DEMO_HOUSES, HOME_ID, store, useApp } from './state'

const SUNI = (
  <svg className="osun" viewBox="-10 -10 20 20" aria-hidden>
    <g stroke="#f5b300" strokeWidth="2.6" strokeLinecap="round">
      <line y1="-17.8" y2="-13.9" /><line y1="17.8" y2="13.9" /><line x1="-17.8" x2="-13.9" /><line x1="17.8" x2="13.9" />
      <line x1="-12.6" y1="-12.6" x2="-9.8" y2="-9.8" /><line x1="12.6" y1="12.6" x2="9.8" y2="9.8" /><line x1="-12.6" y1="12.6" x2="-9.8" y2="9.8" /><line x1="12.6" y1="-12.6" x2="9.8" y2="-9.8" />
    </g>
    <circle r="9.4" fill="#f5b300" />
  </svg>
)

export const Logo = ({ size = 19 }: { size?: number }) => (
  <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.035em', whiteSpace: 'nowrap' }}>SunPr{SUNI}of</span>
)

const TABS: [string, IconName, string][] = [
  ['home', 'home', 'Home'], ['installer', 'tool', 'Installer'], ['cleaning', 'droplet', 'Cleaning'], ['impact', 'leaf', 'Impact'],
]

export function Shell() {
  const { lang, setLang, dark, setDark, t, view, v, clean, cl, toast, recovered } = useApp()
  const loc = useLocation()
  const nav = useNavigate()
  const acc = loc.pathname.endsWith('/accuracy')
  const here = (p: string) => loc.pathname.endsWith(`/${p}`)
  const canSend = v?.status === 'shortfall' || v?.status === 'trip'
  const dots: Record<string, boolean> = {
    installer: (view === 'idle' && !!canSend) || view === 'esc' || view === 'reo' || view === 'fail',
    cleaning: ((clean?.decision === 'clean' && !cl) || view === 'dis'),
    impact: view === 'fix' || (cl === 'clean' || cl === 'rain'),
  }
  void recovered
  const chip = (l: 'en' | 'hi', label: string) => (
    <span className="chipS" role="button" tabIndex={0} onClick={() => setLang(l)}
      style={{ cursor: 'pointer', padding: '3px 8px', ...(lang === l ? { background: 'var(--ink)', color: 'var(--bg)' } : { border: '1px solid var(--line)' }) }}>{label}</span>
  )
  return (
    <div className="shell">
      <div className="top">
        {acc ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#b45309', fontWeight: 600, cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => nav('/app/impact')}>
            <Ic n="chevron-left" size={20} />{t('Impact')}
          </span>
        ) : <Logo />}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {chip('en', 'EN')}{chip('hi', 'हिं')}
          <span className="chipS" role="button" tabIndex={0} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)}
            style={{ cursor: 'pointer', padding: '3px 8px', border: '1px solid var(--line)' }}>{dark ? '☀' : '🌙'}</span>
        </div>
      </div>
      {!acc && v?.isDemo && (
        <div className="scn" aria-label={t('Demo house')} style={{ margin: '0 16px 6px' }}>
          <span className="mut" style={{ fontSize: 12, padding: '6px 4px' }}>{t('Demo house')}</span>
          {DEMO_HOUSES.map(([id, name]) => (
            <span key={id} className={HOME_ID === id ? 'on' : ''} role="button" tabIndex={0} aria-pressed={HOME_ID === id}
              onClick={() => { if (HOME_ID !== id) { store.set('sp:home', id); window.location.reload() } }}>{name}</span>
          ))}
        </div>
      )}
      <div className="body"><Outlet /></div>
      {!acc && (
        <nav className="tabs" aria-label="Main">
          {TABS.map(([p, ic, label]) => (
            <NavLink key={p} to={`/app/${p}`} className={`tb ${here(p) ? 'on' : ''}`}>
              {dots[p] && !here(p) && <span className="dot" style={{ display: 'block' }} />}
              <Ic n={ic} size={22} />{t(label)}
            </NavLink>
          ))}
        </nav>
      )}
      <div className="glowO" id="glowO"><div className="fl" id="glowF" /></div>
      {toast && <div role="status" style={{ position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 12, fontSize: 13, zIndex: 60, maxWidth: 380 }}>{t(toast)}</div>}
    </div>
  )
}
