'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { BetFeedEntry } from '@/types'
import { formatEnergy, displayChoice } from '@/lib/utils'

interface Props {
  bets: BetFeedEntry[]
}

export function LiveBetFeed({ bets }: Props) {
  return (
    <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {bets.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-6 tracking-wider">
            Chưa có cược nào...
          </p>
        )}
        {bets.map((bet, i) => (
          <motion.div
            key={`${bet.username}-${bet.createdAt}-${i}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="font-orbitron text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                style={{
                  color: bet.choice === 'T' ? 'var(--cyan-titan)' : 'var(--crimson-xenon)',
                  background: bet.choice === 'T' ? 'rgba(0,245,255,0.1)' : 'rgba(255,23,68,0.1)',
                }}
              >
                {displayChoice(bet.choice)}
              </span>
              <span className="text-xs text-[var(--text-primary)] truncate">{bet.username}</span>
            </div>
            <span className="text-xs font-orbitron text-[var(--text-muted)] flex-shrink-0 ml-2">
              {formatEnergy(bet.amount)} ⚡
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
