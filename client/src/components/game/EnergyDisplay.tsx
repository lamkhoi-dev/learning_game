'use client'
import { useEffect, useRef, useState } from 'react'
import { formatEnergy } from '@/lib/utils'

interface Props {
  energy: string
}

export function EnergyDisplay({ energy }: Props) {
  const [displayed, setDisplayed] = useState(Number(energy))
  const [bouncing, setBouncing] = useState(false)
  const prevRef = useRef(Number(energy))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = Number(energy)
    if (from === to) return

    prevRef.current = to
    setBouncing(true)
    setTimeout(() => setBouncing(false), 400)

    const duration = 800
    const start = performance.now()

    function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      setDisplayed(Math.round(from + (to - from) * ease(t)))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [energy])

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-muted)] tracking-widest font-orbitron">NĂNG LƯỢNG</span>
      <span
        className="font-orbitron font-bold text-sm neon-text-gold transition-transform"
        style={{
          transform: bouncing ? 'scale(1.2)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}
      >
        {formatEnergy(displayed)} ⚡
      </span>
    </div>
  )
}
