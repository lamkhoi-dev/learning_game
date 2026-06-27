'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export default function PendingPage() {
  const router = useRouter()
  const { user, clearAuth, setAuth } = useAuthStore()
  const [checking, setChecking] = useState(false)

  // Poll every 5 seconds to check if approved
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/api/auth/me')
        if (data.status === 'ACTIVE') {
          setAuth(useAuthStore.getState().accessToken!, data)
          router.replace('/game')
        }
      } catch { /* token expired — stay on page */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  async function handleCheck() {
    setChecking(true)
    try {
      const { data } = await api.get('/api/auth/me')
      if (data.status === 'ACTIVE') {
        setAuth(useAuthStore.getState().accessToken!, data)
        router.replace('/game')
      }
    } catch { /* ignore */ }
    finally { setChecking(false) }
  }

  function handleLogout() {
    clearAuth()
    router.replace('/login')
  }

  return (
    <div className="void-grid min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        {/* Pulsing icon */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-6xl mb-6"
        >
          ⏳
        </motion.div>

        <h1 className="font-orbitron text-2xl font-black neon-text-gold tracking-widest mb-3">
          CHỜ DUYỆT
        </h1>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-2">
          Tài khoản <span className="text-[var(--text-primary)] font-semibold">{user?.username}</span> đang chờ admin phê duyệt.
        </p>
        <p className="text-[var(--text-muted)] text-xs mb-8">
          Trang sẽ tự động chuyển khi được duyệt.
        </p>

        <div className="glass-panel p-6 space-y-3">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="w-full py-3 rounded-lg font-orbitron text-xs font-semibold tracking-widest border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,210,74,0.08)] disabled:opacity-40 transition-all"
          >
            {checking ? 'ĐANG KIỂM TRA...' : 'KIỂM TRA TRẠNG THÁI'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-lg font-orbitron text-xs text-[var(--text-muted)] hover:text-[var(--crimson-xenon)] transition-colors tracking-widest"
          >
            ĐĂNG XUẤT
          </button>
        </div>
      </motion.div>
    </div>
  )
}
