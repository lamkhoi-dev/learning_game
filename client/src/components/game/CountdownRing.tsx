'use client'
import { useEffect, useState, useRef } from 'react'

interface Props {
  openedAt: string | null
  durationSeconds?: number
}

const RADIUS = 48
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CountdownRing({ openedAt, durationSeconds = 120 }: Props) {
  const [progress, setProgress] = useState(1)
  const [remaining, setRemaining] = useState(durationSeconds)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!openedAt) {
      setProgress(1)
      setRemaining(durationSeconds)
      return
    }

    const start = new Date(openedAt).getTime()
    const total = durationSeconds * 1000

    function tick() {
      const elapsed = Date.now() - start
      const left = Math.max(0, total - elapsed)
      setProgress(left / total)
      setRemaining(Math.ceil(left / 1000))
      if (left > 0) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [openedAt, durationSeconds])

  const strokeOffset = CIRCUMFERENCE * (1 - progress)
  const color = progress > 0.5 ? '#00f5ff' : progress > 0.2 ? '#ffd600' : '#ff1744'

  const mins = Math.floor(remaining / 60).toString().padStart(2, '0')
  const secs = (remaining % 60).toString().padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"
        />
        {/* Progress */}
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeOffset}
          style={{
            transition: 'stroke 0.3s ease',
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
        {/* Center text — counter-rotate */}
        <text
          x="60" y="60"
          textAnchor="middle" dominantBaseline="middle"
          style={{ transform: 'rotate(90deg)', transformOrigin: '60px 60px', fill: color, fontSize: '18px', fontFamily: 'Orbitron, monospace', fontWeight: 700 }}
        >
          {mins}:{secs}
        </text>
      </svg>
      <span className="text-xs text-[var(--text-muted)] tracking-widest font-orbitron">THỜI GIAN</span>
    </div>
  )
}
