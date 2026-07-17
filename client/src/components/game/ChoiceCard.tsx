'use client'
import { motion } from 'framer-motion'
import { Choice } from '@/types'
import { cn, displayChoice, formatEnergy } from '@/lib/utils'

interface Props {
  choice: Choice
  selected: boolean
  disabled: boolean
  betCount?: number
  total?: number
  compact?: boolean
  onSelect: () => void
}

const config = {
  T: {
    color: 'var(--cyan-titan)',
    bgGlow: 'rgba(0,245,255,0.06)',
    borderSelected: 'rgba(0,245,255,0.8)',
    borderIdle: 'rgba(0,245,255,0.15)',
    shadowSelected: '0 0 32px rgba(0,245,255,0.4), inset 0 0 32px rgba(0,245,255,0.05)',
    textClass: 'neon-text-cyan',
  },
  X: {
    color: 'var(--crimson-xenon)',
    bgGlow: 'rgba(255,23,68,0.06)',
    borderSelected: 'rgba(255,23,68,0.8)',
    borderIdle: 'rgba(255,23,68,0.15)',
    shadowSelected: '0 0 32px rgba(255,23,68,0.4), inset 0 0 32px rgba(255,23,68,0.05)',
    textClass: 'neon-text-crimson',
  },
}

export function ChoiceCard({ choice, selected, disabled, betCount = 0, total = 0, compact = false, onSelect }: Props) {
  const c = config[choice]

  return (
    <motion.button
      onClick={() => !disabled && onSelect()}
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      animate={selected ? { scale: 1.04 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={cn(
        'relative flex-1 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300 cursor-pointer select-none',
        compact ? 'min-h-[104px] py-2' : 'min-h-[200px] sm:min-h-[260px]',
        disabled && !selected ? 'opacity-40 cursor-not-allowed' : '',
      )}
      style={{
        background: selected ? c.bgGlow : 'var(--glass-bg)',
        borderColor: selected ? c.borderSelected : c.borderIdle,
        boxShadow: selected ? c.shadowSelected : 'none',
      }}
    >
      {/* Symbol */}
      <span
        className={cn('font-orbitron font-black leading-none select-none', c.textClass)}
        style={{ fontSize: compact ? 'clamp(40px, 11vw, 58px)' : 'clamp(72px, 12vw, 120px)' }}
      >
        {displayChoice(choice)}
      </span>

      {/* Tổng chíp mỗi bên */}
      <span className="font-orbitron font-bold mt-1" style={{ color: c.color, fontSize: compact ? '13px' : '16px' }}>
        {formatEnergy(total)}
      </span>

      {/* Bet count badge */}
      {betCount > 0 && (
        <div
          className={cn('absolute font-orbitron rounded-full', compact ? 'top-1.5 right-1.5 text-[10px] px-1.5' : 'top-3 right-3 text-xs px-2 py-0.5')}
          style={{
            background: `rgba(${choice === 'T' ? '0,245,255' : '255,23,68'},0.15)`,
            color: c.color,
            border: `1px solid ${c.color}30`,
          }}
        >
          {betCount}
        </div>
      )}

      {/* Selected indicator */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn('absolute font-orbitron tracking-widest', compact ? 'bottom-1 text-[9px]' : 'bottom-3 text-xs')}
          style={{ color: c.color }}
        >
          ✓ ĐÃ CHỌN
        </motion.div>
      )}
    </motion.button>
  )
}
