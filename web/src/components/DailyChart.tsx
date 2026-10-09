import { useEffect, useRef, useState } from 'react'
import type { DailyPoint } from '../api'
import { FLAG_LABEL, STATUS, type Lang, T } from '../i18n'

const H = 240
const M = { top: 16, right: 16, bottom: 28, left: 40 }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(280)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceMax(v: number) {
  const step = v > 20 ? 5 : v > 8 ? 2 : 1
  return Math.ceil(v / step) * step
}

const fmtDate = (d: string, lang: Lang) =>
  new Date(d).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })

export function DailyChart({ data, lang, replayFrom }: { data: DailyPoint[]; lang: Lang; replayFrom?: string | null }) {
  const [wrap, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const t = T[lang]
  if (!data.length) return null

  const iw = Math.max(width - M.left - M.right, 100)
  const ih = H - M.top - M.bottom
  const yMax = niceMax(Math.max(...data.map((d) => Math.max(d.p90, d.actual))) * 1.05)
  const x = (i: number) => M.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v: number) => M.top + ih - (v / yMax) * ih
  const ticks = [0, yMax / 2, yMax]

  const band =
    data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.p90)}`).join('') +
    data.map((_, k) => { const i = data.length - 1 - k; return `L${x(i)},${y(data[i].p10)}` }).join('') + 'Z'
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.actual)}`).join('')
  const replayIdx = replayFrom ? data.findIndex((d) => d.date >= replayFrom) : -1
  const xLabels = data.map((_, i) => i).filter((i) => i % Math.ceil(data.length / (width < 480 ? 4 : 7)) === 0)

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1))
    setHover(Math.min(Math.max(i, 0), data.length - 1))
  }

  const h = hover !== null ? data[hover] : null
  const last = data.length - 1

  return (
    <div ref={wrap} className="relative w-full min-w-0 select-none">
      <svg width={width} height={H} role="img" aria-label={t.chartTitle} style={{ display: 'block', maxWidth: '100%' }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {fmtDate(data[i].date, lang)}
          </text>
        ))}
        {replayIdx >= 0 && (
          <g>
            <rect x={x(replayIdx) - 2} y={M.top} width={x(last) - x(replayIdx) + 4} height={ih} fill="var(--demo-bg)" opacity={0.8} />
            <text x={x(replayIdx) + 4} y={M.top + 12} fontSize="10" fontWeight={700} fill="var(--demo-ink)">{T[lang].replayTag}</text>
          </g>
        )}
        <path d={band} fill="var(--band)" opacity={0.7} />
        <path d={line} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) =>
          d.flag ? (
            <circle key={d.date} cx={x(i)} cy={y(d.actual)} r={4.5}
              fill={`var(--${STATUS[d.flag].tone})`} stroke="var(--surface-1)" strokeWidth={2} />
          ) : null,
        )}
        {width >= 420 && (
          <>
            <text x={x(last) - 4} y={y(data[last].p90) - 6} textAnchor="end" fontSize="11" fill="var(--text-secondary)">
              {t.expected}
            </text>
            <text x={x(last) - 4} y={y(data[last].actual) + 16} textAnchor="end" fontSize="11" fontWeight={600} fill="var(--text-primary)">
              {t.actual}
            </text>
          </>
        )}
        {h && hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="var(--text-muted)" strokeDasharray="3 3" />
        )}
        {h && hover !== null && (
          <circle cx={x(hover)} cy={y(h.actual)} r={5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
        )}
        <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>

      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(x(hover) - 80, 0), width - 170),
            width: 170,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtDate(h.date, lang)}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {t.actual}: <b style={{ color: 'var(--text-primary)' }}>{h.actual.toFixed(1)}</b> {t.kwh}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {t.expected}: {h.p10.toFixed(1)}–{h.p90.toFixed(1)}
          </div>
          {h.flag && (
            <div className="mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
              <span style={{ color: `var(--${STATUS[h.flag].tone})` }}>●</span> {FLAG_LABEL[h.flag][lang]}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
