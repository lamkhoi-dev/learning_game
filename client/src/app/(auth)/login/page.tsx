'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useBrand } from '@/hooks/useBrand'
import api from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const brandName = useBrand()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { identifier, password })
      setAuth(data.accessToken, data.user)
      if (data.user.role === 'ADMIN') router.replace('/admin/dashboard')
      else if (data.user.status === 'PENDING') router.replace('/pending')
      else router.replace('/game')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="void-grid min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt={brandName} className="mx-auto w-64 max-w-full h-auto rounded-2xl" />
          <p className="text-[var(--text-muted)] text-sm mt-3 tracking-wider">
            CHOOSE YOUR SIDE
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8">
          <h2 className="font-orbitron text-lg font-semibold text-[var(--text-primary)] mb-6 tracking-wide">
            ĐĂNG NHẬP
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest uppercase">
                Username / Số điện thoại
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="void_user hoặc 0901234567"
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest uppercase">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-[var(--crimson-xenon)] bg-[rgba(255,23,68,0.08)] border border-[rgba(255,23,68,0.2)] rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-lg font-orbitron text-sm font-semibold tracking-widest text-black bg-[var(--gold)] hover:bg-[var(--gold-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{ boxShadow: "0 0 20px rgba(255,210,74,0.3)" }}
            >
              {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP'}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-[var(--gold)] hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
