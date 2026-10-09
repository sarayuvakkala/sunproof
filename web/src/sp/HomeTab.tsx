import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVoice } from '../api'
import { ChartCard } from './Chart'
import { HeroSvg } from './HeroSvg'
import { Ic, type IconName } from './ic'
import { HOME_ID, useApp, type View } from './state'
import { Ticker } from './Ticker'
import { Card } from './ui'
import { useWeather } from './useWeather'

type Chip = [bg: string, fg: string, icon: IconName, label: string, to: string]
const CHIP: Record<View | 'ok', Chip> = {
  ok: ['#dcfce7', '#166534', 'circle-check', 'All good', ''],
  idle: ['#fee2e2', '#991b1b', 'alert-triangle', 'Installer needed', 'installer'],
  sent: ['#dbeafe', '#1e40af', 'clock', 'Waiting for installer', 'installer'],
  rem: ['#fef3c7', '#92400e', 'clock', 'Reminder sent', 'installer'],
  visit: ['#dbeafe', '#1e40af', 'calendar', 'Visit booked', 'installer'],
  ver: ['#dbeafe', '#1e40af', 'chart-line', 'Checking the fix', 'installer'],
  fix: ['#dcfce7', '#166534', 'circle-check', 'Fixed · energy recovered', 'impact'],
  fail: ['#fef3c7', '#92400e', 'alert-triangle', "The fix didn't hold", 'installer'],
  reo: ['#fef3c7', '#92400e', 'refresh', 'Reopened with installer', 'installer'],
  esc: ['#fee2e2', '#991b1b', 'file-text', 'Complaint ready to file', 'installer'],
  dis: ['#f1f5f9', '#334155', 'message-circle', 'Installer: not the system', 'cleaning'],
}

export function HomeTab() {
  const { v, vErr, view, lang, t } = useApp()
  const nav = useNavigate()
  const weather = useWeather()
  const [voice, setVoice] = useState<'idle' | 'busy' | 'play'>('idle')
  const audio = useRef<HTMLAudioElement>(null)

  if (vErr) return <Card>{t('Could not load. Try again.')}</Card>
  if (!v) return <Card style={{ color: 'var(--mut)' }}>{t('Loading…')}</Card>

  const fixed = view === 'fix'
  const last = v.daily[v.daily.length - 1]
  const today = last?.actual ?? 0
  const expected = last?.p50 ?? 0
  const healthy = v.status === 'ok' && view === 'idle'
  const c = CHIP[healthy ? 'ok' : view]
  const home = (v.name ?? 'Sharma ji').replace(/\s*\(demo\)\s*$/i, '')

  async function listen() {
    if (voice === 'play') { audio.current?.pause(); setVoice('idle'); return }
    if (voice === 'busy') return
    setVoice('busy')
    try {
      const { audio_url } = await getVoice(HOME_ID, lang)
      if (audio.current) {
        audio.current.src = audio_url
        await audio.current.play()
        setVoice('play')
      }
    } catch { setVoice('idle') }
  }

  return (
    <>
      <Card>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{t(`Namaste, ${home} 👋`)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span className="sm mut">{t(`${v.kw ?? 3} kW rooftop · ${v.city ?? 'Delhi'}`)}</span>
          {weather && <span style={{ fontSize: 12, border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{weather.icon} {weather.temp}°</span>}
        </div>
        <div style={{ marginTop: 10 }}>
          <span className="chip" style={{ background: c[0], color: c[1] }} role="button" tabIndex={0}
            onClick={() => c[4] && nav(`/app/${c[4]}`)} onKeyDown={(e) => { if (e.key === 'Enter' && c[4]) nav(`/app/${c[4]}`) }}>
            <Ic n={c[2]} size={16} />{t(c[3])} {c[4] && <Ic n="chevron-right" size={16} />}
          </span>
        </div>
        <div className="today">
          <div><b style={{ color: fixed || healthy ? '#16a34a' : '#ea580c' }}>{today.toFixed(1)}</b><span>{t('today, kWh')}</span></div>
          <div><b>{expected.toFixed(1)}</b><span>{t('expected')}</span></div>
          <div><b>{weather ? t(weather.label) : '–'}</b><span>{weather ? t(weather.sub) : ''}</span></div>
        </div>
      </Card>

      <Card style={{ padding: '12px 10px' }} delay={0.1}>
        <HeroSvg fixed={fixed || healthy} today={today} expected={expected} />
        {!(fixed || healthy) && <div className="sm mut" style={{ textAlign: 'center', margin: '2px 6px 8px' }}>{t('When the roof falls short, the gap comes from the grid, mostly coal.')}</div>}
        <div className="stats">
          <div className="stat"><div className="big"><Ticker value={Math.round(v.units_lost)} delay={250} /></div><div className="lab">{t('units lost')}</div></div>
          <div className="stat"><div className="big">₹<Ticker value={Math.round(v.rupees_lost)} delay={390} /></div><div className="lab">{t('money lost')}</div></div>
          <div className="stat"><div className="big"><Ticker value={Math.round(v.co2_kg)} delay={530} /><span style={{ fontSize: 12, color: 'var(--mut)' }}> {t('kg')}</span></div><div className="lab">{t('extra CO₂')}</div></div>
        </div>
        <div className="sm mut" style={{ textAlign: 'center', marginTop: 8 }}>{t('Last 30 days')}</div>
      </Card>

      <div className="up" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12, animationDelay: '.2s' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f5b300', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <svg width="20" height="20" viewBox="-20 -20 40 40" aria-hidden><g stroke="#1a1200" strokeWidth="3" strokeLinecap="round"><line y1="-17" y2="-13" /><line y1="17" y2="13" /><line x1="-17" x2="-13" /><line x1="17" x2="13" /></g><circle r="8" fill="#1a1200" /></svg>
        </div>
        <div className="bub">
          <div className="sm mut" style={{ fontWeight: 600, marginBottom: 3 }}>SunProof</div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            {fixed
              ? <>{t('Your panels are')} <b>{t('back in range')}</b>{t('. The fix worked, and the clean energy is being counted.')}</>
              : v.message[lang]}
          </div>
          <span className={`lis ${voice === 'play' ? 'play' : ''}`} onClick={listen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') listen() }}>
            <Ic n={voice === 'play' ? 'player-pause' : 'player-play'} size={16} />
            <span>{voice === 'play' ? t('Playing') : t('Listen')}</span>
            <span className="wave"><i /><i /><i /><i /></span>
          </span>
          <audio ref={audio} className="hidden" onEnded={() => setVoice('idle')} onPause={() => setVoice('idle')} />
        </div>
      </div>

      <Card delay={0.3}>
        <ChartCard daily={v.daily} replayFrom={v.replayFrom} unitsLost={v.units_lost} fixed={fixed} />
      </Card>
    </>
  )
}
