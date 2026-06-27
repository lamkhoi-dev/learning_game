'use client'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Choice } from '@/types'
import { displayChoice, formatEnergy } from '@/lib/utils'

interface Props {
  visible: boolean
  result: Choice
  net: number
  onDismiss: () => void
}

export function WinOverlay({ visible, result, net, onDismiss }: Props) {
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
          style={{ background: 'rgba(0,0,0,0.88)' }}
        >
          {/* Flash ring */}
          <motion.div
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute w-64 h-64 rounded-full border-4"
            style={{ borderColor: 'var(--cyan-titan)' }}
          />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center gap-4"
          >
            <div
              className="font-orbitron text-7xl font-black neon-text-cyan"
              style={{ textShadow: '0 0 40px rgba(0,245,255,0.8), 0 0 80px rgba(0,245,255,0.4)' }}
            >
              THẮNG
            </div>
            <div className="font-orbitron text-2xl font-black neon-text-cyan">
              +{formatEnergy(net)} chíp
            </div>
            <div className="font-orbitron text-sm text-[var(--text-muted)] tracking-widest">
              KẾT QUẢ: <span className="text-[var(--text-primary)]">{displayChoice(result)}</span>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-4 animate-pulse">
              nhấn bất kỳ để đóng
            </div>
          </motion.div>

          {/* Particles */}
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((i / 16) * 2 * Math.PI) * (120 + Math.random() * 80),
                y: Math.sin((i / 16) * 2 * Math.PI) * (120 + Math.random() * 80),
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
              className="absolute w-2 h-2 rounded-full"
              style={{ background: i % 2 === 0 ? 'var(--cyan-titan)' : '#fff' }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
