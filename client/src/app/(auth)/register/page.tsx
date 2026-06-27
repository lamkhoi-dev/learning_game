'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useBrand } from '@/hooks/useBrand'
import api from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const brandName = useBrand()
  const [form, setForm] = useState({ username: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/register', form)
      setAuth(data.accessToken, data.user)
      router.replace('/game')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key: 'username' as const, label: 'Username', type: 'text', placeholder: 'void_warrior' },
    { key: 'phone' as const, label: 'Số điện thoại', type: 'tel', placeholder: '0901234567' },
    { key: 'password' as const, label: 'Mật khẩu', type: 'password', placeholder: '••••••••' },
  ]

  return (
    <div className="void-grid min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt={brandName} className="mx-auto w-64 max-w-full h-auto rounded-2xl" />
          <p className="text-[var(--text-muted)] text-sm mt-3 tracking-wider">
            ENTER THE ARENA
          </p>
        </div>

        <div className="glass-panel p-8">
          <h2 className="font-orbitron text-lg font-semibold text-[var(--text-primary)] mb-6 tracking-wide">
            ĐĂNG KÝ
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest uppercase">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  required
                  placeholder={placeholder}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                />
              </div>
            ))}

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
              {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG KÝ'}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-[var(--gold)] hover:underline">
              Đăng nhập
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
