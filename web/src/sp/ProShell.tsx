import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Ic, type IconName } from './ic'
import { Logo } from './Shell'
import { ArrivalFx } from './pro/ArrivalFx'
import { FxOverlay } from './pro/FxOverlay'
import { ProProvider } from './pro/ProState'
import { useProApp } from './pro/proCtx'
import { useApp } from './state'

const TABS: [string, IconName, string][] = [
  ['jobs', 'briefcase', 'Jobs'], ['visits', 'calendar', 'Visits'], ['record', 'chart-line', 'Record'],
]

/** Frame for the installer side: same look as the household shell, three tabs, and a way back to the role picker. */
function ProFrame() {
  const { lang, setLang, dark, setDark, t } = useApp()
  const { toast } = useProApp()
  const loc = useLocation()
  const nav = useNavigate()
  const here = (p: string) => loc.pathname.includes(`/pro/${p}`)
  const chip = (l: 'en' | 'hi', label: string) => (
    <span className="chipS" role="button" tabIndex={0} onClick={() => setLang(l)}
      style={{ cursor: 'pointer', padding: '3px 8px', ...(lang === l ? { background: 'var(--ink)', color: 'var(--bg)' } : { border: '1px solid var(--line)' }) }}>{label}</span>
  )
  return (
    <div className="shell">
      <div className="top">
        <span><Logo /><span className="rolepill">{t('Installer')}</span></span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {chip('en', 'EN')}{chip('hi', 'हिं')}
          <span className="chipS" role="button" tabIndex={0} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)}
            style={{ cursor: 'pointer', padding: '3px 8px', border: '1px solid var(--line)' }}>{dark ? '☀' : '🌙'}</span>
          <span className="chipS" role="button" tabIndex={0} aria-label={t('Switch role')} onClick={() => nav('/')}
            style={{ cursor: 'pointer', padding: '3px 8px', border: '1px solid var(--line)' }}><Ic n="swap" size={14} /></span>
        </div>
      </div>
      <div className="body"><Outlet /></div>
      <nav className="tabs t3" aria-label="Installer">
        {TABS.map(([p, ic, label]) => (
          <NavLink key={p} to={`/pro/${p}`} className={`tb ${here(p) ? 'on' : ''}`}>
            <Ic n={ic} size={22} />{t(label)}
          </NavLink>
        ))}
      </nav>
      <FxOverlay />
      <ArrivalFx />
      {toast && <div role="status" style={{ position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 12, fontSize: 13, zIndex: 60, maxWidth: 380 }}>{toast}</div>}
    </div>
  )
}

/** Frame for the installer side. Holds the sample jobs so every tab sees the same data. */
export function ProShell() {
  return <ProProvider><ProFrame /></ProProvider>
}
