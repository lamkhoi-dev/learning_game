'use client'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Choice } from '@/types'
import { displayChoice, formatEnergy } from '@/lib/utils'

interface Props {
  visible: boolean
  result: Choice
  loss: number
  onDismiss: () => void
}

export function LoseOverlay({ visible, result, loss, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.9)' }}
        >
          <motion.div
            animate={{ x: [0, -8, 8, -6, 6, -3, 3, 0] }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col items-center gap-4"
          >
            <div
              className="font-orbitron text-7xl font-black"
              style={{
                color: 'var(--crimson-xenon)',
                textShadow: '0 0 40px rgba(255,23,68,0.8), 0 0 80px rgba(255,23,68,0.3)',
              }}
            >
              THUA
            </div>
            <div className="font-orbitron text-2xl font-black" style={{ color: 'var(--crimson-xenon)' }}>
              −{formatEnergy(loss)} chíp
            </div>
            <div className="font-orbitron text-sm tracking-widest" style={{ color: 'rgba(255,23,68,0.7)' }}>
              KẾT QUẢ: {displayChoice(result)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-4 animate-pulse">
              nhấn bất kỳ để đóng
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
