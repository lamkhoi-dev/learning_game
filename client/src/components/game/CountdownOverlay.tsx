'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  visible: boolean
  seconds: number
}

export function CountdownOverlay({ visible, seconds }: Props) {
  const [count, setCount] = useState(seconds)

  useEffect(() => {
    if (!visible) return
    setCount(seconds)
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [visible, seconds])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.75)' }}
        >
          <motion.div
            key={count}
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="font-orbitron font-black"
            style={{
              fontSize: 'clamp(100px, 20vw, 180px)',
              color: count <= 2 ? 'var(--crimson-xenon)' : 'var(--gold)',
              textShadow: count <= 2
                ? '0 0 40px rgba(255,23,68,0.8)'
                : '0 0 40px rgba(0,245,255,0.8)',
              lineHeight: 1,
            }}
          >
            {count}
          </motion.div>
          <p className="font-orbitron text-sm text-[var(--text-muted)] tracking-[0.4em] mt-6">
            ĐANG CHỐT KẾT QUẢ
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
