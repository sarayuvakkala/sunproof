import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fd } from './dates'
import { useProApp } from './proCtx'

const HOLD_MS = 14000

/**
 * A request from a home owner arrives: a paper plane swoops in from the corner, turns into an envelope, the flap
 * opens and the request lifts out as a card. Closing it makes the job glow in the list.
 */
export function ArrivalFx() {
  const { arrival: a, closeArrival, L, lang } = useProApp()
  const nav = useNavigate()
  const id = a?.id
  useEffect(() => {
    if (!id) return
    const t = window.setTimeout(closeArrival, HOLD_MS)
    return () => clearTimeout(t)
  }, [id, closeArrival])

  const path = useMemo(() => {
    const r = (document.querySelector('.shell') ?? document.body).getBoundingClientRect()
    const vh = window.innerHeight
    const cx = r.left + r.width / 2, cy = vh / 2 - 6
    return `M${(r.right + 30).toFixed(0)} 36 C${(r.right - r.width * 0.12).toFixed(0)} ${(vh * 0.02).toFixed(0)} ${(cx + 150).toFixed(0)} ${(cy - 190).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!a) return null
  const open = () => { closeArrival(); nav(`/pro/jobs/${a.id}`, { state: { reply: true } }) }
  return (
    <div className="pj-arrveil" role="dialog" aria-label={L('New request', 'नया अनुरोध')} onClick={closeArrival}>
      <div className="pj-arrplane" style={{ offsetPath: `path('${path}')` }}>
        <div className="pj-arrpf">
          <svg width="56" height="40" viewBox="0 0 56 40" aria-hidden="true" style={{ transform: 'scaleY(-1)' }}>
            <polygon points="2,20 54,3 36,37 28,24" fill="var(--card)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
            <polygon points="2,20 28,24 54,3" fill="var(--env)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M28 24 L54 3" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="30" cy="17" r="3.4" fill="#f5b300" stroke="var(--ink)" strokeWidth="1.4" />
          </svg>
        </div>
      </div>
      <div className="pj-arrstage" onClick={(e) => e.stopPropagation()}>
        <div className="pj-arrenv">
          <svg className="pj-arrback" viewBox="0 0 220 140" aria-hidden="true"><rect x="1.5" y="10" width="217" height="128" rx="12" fill="var(--env2)" stroke="var(--ink)" strokeWidth="2.4" /></svg>
          <div className="pj-arrletter">
            <div className="pj-arrk">{a.reopened ? L('Still low after the fix', 'ठीक करने के बाद भी कम') : L('New request', 'नया अनुरोध')}</div>
            <div className="pj-arrn">{a.name}</div>
            <div className="pj-arrs">{L(`${a.kw} kW · ${a.city}`, `${a.kw} kW · ${a.city}`)}</div>
            <div className="pj-arrstat"><b className="pj-num">{a.pct}%</b> {L('less than expected', 'उम्मीद से कम')} · <b className="pj-num">{a.units}</b> {L('units lost', 'यूनिट गए')}</div>
            <div className="pj-arrs">{L(`Reply by ${fd(a.due, lang)}`, `${fd(a.due, lang)} तक जवाब दें`)}</div>
            <button className="pj-btn pj-arrbtn" onClick={open}>{L('Open request', 'अनुरोध खोलें')}</button>
          </div>
          <svg className="pj-arrfront" viewBox="0 0 220 140" aria-hidden="true">
            <path d="M1.5 138 V20 L110 88 L218.5 20 V138 Z" fill="var(--env)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
          <svg className="pj-arrflap" viewBox="0 0 220 140" aria-hidden="true">
            <path d="M1.5 10 H218.5 L110 88 Z" fill="var(--env2)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}
