'use client'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  visible: boolean
  loading: boolean
  usernames: string[]
  onClose: () => void
}

export function OnlineUsersModal({ visible, loading, usernames, onClose }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-xs max-h-[70vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
              <span className="font-orbitron text-sm font-bold tracking-widest">
                <span className="text-[#22c55e]">●</span> ĐANG ONLINE ({usernames.length})
              </span>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6 animate-pulse">Đang tải...</p>
              ) : usernames.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">Không có ai online</p>
              ) : (
                <ul className="space-y-1.5">
                  {usernames.map((name, i) => (
                    <li key={`${name}-${i}`} className="text-sm font-orbitron text-[var(--text-primary)] truncate">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
