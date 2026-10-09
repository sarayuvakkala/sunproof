import type { CSSProperties, ReactNode } from 'react'

export function Card({ children, style, delay, className = '' }: { children: ReactNode; style?: CSSProperties; delay?: number; className?: string }) {
  return <div className={`card up ${className}`} style={{ animationDelay: delay ? `${delay}s` : undefined, ...style }}>{children}</div>
}

export function Stats({ items }: { items: { v: ReactNode; l: string; color?: string }[] }) {
  return (
    <div className="stats">
      {items.map((it) => (
        <div className="stat" key={it.l}><div className="big" style={{ color: it.color }}>{it.v}</div><div className="lab">{it.l}</div></div>
      ))}
    </div>
  )
}
