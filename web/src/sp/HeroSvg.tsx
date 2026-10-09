import { useApp } from './state'

const SMOKE_BAD: [number, number, number][] = [[13, -34, 0], [13, -34, 1.1], [13, -34, 2.2], [29, -18, 0.6], [29, -18, 1.9]]
const SMOKE_OK: [number, number, number][] = [[13, -34, 0]]

/** Inverter, money leak, house and coal plant. `gap` is the kWh the grid had to fill today. */
export function HeroSvg({ fixed, today, expected }: { fixed: boolean; today: number; expected: number }) {
  const { t } = useApp()
  const f = fixed
  const pct = expected > 0 ? Math.min(100, Math.round((today / expected) * 100)) : 0
  const gap = Math.max(0, expected - today)
  const barW = Math.max(2, (56 * pct) / 100)
  return (
    <svg viewBox="0 0 360 250" width="100%" role="img" aria-label="Inverter, money leak and coal plant">
      <defs>
        <linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--b1)" /><stop offset="1" stopColor="var(--b2)" /></linearGradient>
      </defs>
      <circle cx="16" cy="18" r="8" fill="#f5b300" />
      <g transform="translate(36,8) skewX(-18)"><rect width="78" height="30" rx="3" fill="#1e3a8a" /><path d="M19.5 0v30M39 0v30M58.5 0v30M0 15h78" stroke="#93c5fd" strokeWidth=".9" /></g>
      <path d="M64 38V56" stroke="var(--wire)" strokeWidth="5" /><path className="flow" d="M64 38V56" />
      <g fill="var(--fin)"><rect x="50" y="52" width="28" height="6" rx="2" /><rect x="50" y="198" width="28" height="6" rx="2" /><rect x="14" y="72" width="4" height="112" rx="2" /><rect x="110" y="72" width="4" height="112" rx="2" /></g>
      <rect x="18" y="56" width="92" height="144" rx="14" fill="url(#bd)" stroke="var(--fin)" />
      <rect x="27" y="76" width="74" height="58" rx="7" fill="#000" opacity=".85" /><rect x="30" y="79" width="68" height="52" rx="5" fill="var(--scr)" />
      <text x="36" y="91" fontSize="7" fill="var(--scrInk)" opacity=".7">{t('TODAY')}</text>
      <text x="92" y="91" fontSize="7" fill="var(--scrInk)" opacity=".7" textAnchor="end">kWh</text>
      <text x="36" y="109" fontSize="17" fontWeight="800" fill="var(--scrInk)">{today.toFixed(1)}</text>
      <text x="92" y="109" fontSize="8" fill={f ? '#86efac' : '#fcd34d'} textAnchor="end">/ {expected.toFixed(1)}</text>
      <rect x="36" y="115" width="56" height="5" rx="2.5" fill="#fff" opacity=".15" />
      <rect x="36" y="115" width={barW} height="5" rx="2.5" fill={f ? '#22c55e' : '#f5b300'} />
      <text x="36" y="128" fontSize="6.5" fill="var(--scrInk)" opacity=".65">{t(`${pct}% of expected`)}</text>
      <g fontSize="6.5" fill="var(--mut)" textAnchor="middle">
        <circle cx="40" cy="148" r="3.2" fill="#22c55e" /><text x="40" y="160">PV</text>
        <circle cx="64" cy="148" r="3.2" fill="#22c55e" /><text x="64" y="160">{t('GRID')}</text>
        <circle className={f ? '' : 'led'} cx="88" cy="148" r="3.2" fill={f ? '#22c55e' : '#f59e0b'} /><text x="88" y="160">{f ? t('OK') : t('CHECK')}</text>
      </g>
      <text x="64" y="178" fontSize="7" fontWeight="700" fill="var(--mut)" textAnchor="middle">{t('INVERTER · 3 kW')}</text>
      <path d="M110 150H222" stroke="var(--wire)" strokeWidth="5" strokeLinecap="round" />
      {f ? (
        <><path className="flow" d="M114 150H220" /><rect x="149" y="144" width="14" height="12" rx="3" fill="#22c55e" /></>
      ) : (
        <><path className="flow" d="M114 150H150" /><path className="flow thin" d="M164 150H220" /><path d="M153 142l5 7-4 4 6 7" stroke="#dc2626" strokeWidth="2.2" fill="none" strokeLinecap="round" /></>
      )}
      {!f && (
        <g transform="translate(158,160)">
          {[0, 0.8, 1.6].map((d, i) => (
            <g key={i} className="coin" style={{ animationDelay: `${d}s` }}>
              <circle cx={[0, -4, 4][i]} r="7" fill="#f5b300" stroke="#b45309" />
              <text x={[0, -4, 4][i]} y="3" fontSize="8" textAnchor="middle" fill="#5a3e00" fontWeight="700">₹</text>
            </g>
          ))}
        </g>
      )}
      <path d="M136 196h44l-4 30h-36z" fill="none" stroke="var(--mut)" strokeWidth="1.5" />
      {!f && <path d="M139 208h38l-2.4 16h-33.2z" fill="#f5b300" opacity=".6" />}
      <text x="158" y="240" fontSize="7.5" fill="var(--mut)" textAnchor="middle">{f ? t('leak fixed') : t('₹ lost')}</text>
      <g transform="translate(218,118)">
        <ellipse cx="26" cy="61" rx="34" ry="4" fill="#16a34a" opacity=".25" />
        <rect x="7" y="25" width="38" height="36" rx="2" fill="var(--hw)" stroke="var(--hs)" strokeWidth="1.2" />
        <rect x="34" y="6" width="7" height="14" fill="var(--hr2)" /><rect x="33" y="4" width="9" height="3" rx="1" fill="var(--hs)" />
        <path d="M0 28L26 5L52 28Z" fill="var(--hr)" stroke="var(--hr2)" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 24L26 9M14 27L30 13" stroke="#fff" strokeOpacity=".25" strokeWidth="1.2" />
        <rect x="21" y="41" width="11" height="20" rx="1.5" fill="#8b5e34" /><circle cx="29.5" cy="52" r="1" fill="#fde68a" />
        <g fill="#fde68a" stroke="var(--hs)" strokeWidth="1"><rect x="10" y="32" width="8" height="8" rx="1" /><rect x="35" y="32" width="8" height="8" rx="1" /></g>
        <path d="M14 32V40M10 36H18M39 32V40M35 36H43" stroke="var(--hs)" strokeWidth=".8" />
        <path d="M-3 62H55" stroke="var(--hs)" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <g transform="translate(286,62)" opacity={f ? 0.55 : 1}>
        <rect x="8" y="-30" width="11" height="62" fill="var(--plant)" /><rect x="25" y="-14" width="9" height="46" fill="var(--plant2)" />
        <path d="M0 32V14L14 6V14L28 6V14L42 6V14L56 6V60H0Z" fill="var(--plant)" /><rect y="32" width="56" height="28" fill="var(--plant2)" />
        {[6, 22, 38].map((x, i) => (
          <rect key={x} className={f ? '' : 'glowc'} x={x} y="40" width="10" height="8" rx="1" fill={f ? '#78350f' : '#f97316'} style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
        <path d="M8 60h40l-4-6H12z" fill="#1c1917" />
        <g fill="var(--smoke)">
          {(f ? SMOKE_OK : SMOKE_BAD).map((p, i) => (
            <g key={i} className="smk" transform={`translate(${p[0]},${p[1]})`} style={{ animationDelay: `${p[2]}s` }}><circle r="6" /><circle cx="6" cy="-2" r="5" /></g>
          ))}
        </g>
      </g>
      <text x="258" y="22" fontSize="9" fontWeight="700" fill="var(--smoke)">CO₂</text>
      <text x="314" y="136" fontSize="8" fill="var(--mut)" textAnchor="middle">{t('Coal plant')}</text>
      {!f && (
        <>
          <path d="M314 142V160H272" stroke="var(--wire)" strokeWidth="4" fill="none" /><path className="coalflow" d="M314 142V160H272" />
          <g transform="translate(296,176)">
            <rect x="-30" y="-8" width="62" height="17" rx="8.5" fill="var(--smoke)" opacity=".15" />
            <text y="3" fontSize="7.5" fill="var(--ink)" textAnchor="middle" fontWeight="600">{t(`fills the ${gap.toFixed(1)} kWh gap`)}</text>
          </g>
        </>
      )}
    </svg>
  )
}
