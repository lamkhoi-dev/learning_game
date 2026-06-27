'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useStats } from '@/hooks/useStats'
import api from '@/lib/api'

const navItems = [
  { href: '/admin/dashboard', label: 'TỔNG QUAN' },
  { href: '/admin/rounds',    label: 'PHIÊN CƯỢC' },
  { href: '/admin/users',     label: 'NGƯỜI DÙNG' },
  { href: '/admin/audit',     label: 'NHẬT KÝ' },
  { href: '/admin/settings',  label: 'CÀI ĐẶT' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, accessToken, setAuth, clearAuth } = useAuthStore()
  const [ready, setReady] = useState(false)
  const stats = useStats()

  useEffect(() => {
    let cancelled = false
    async function boot() {
      // Đã có phiên admin sẵn trong RAM
      if (accessToken && user?.role === 'ADMIN') { setReady(true); return }
      try {
        // Lấy token mới từ cookie refresh, rồi xác minh role
        const { data } = await api.post('/api/auth/refresh')
        const { data: u } = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        })
        if (cancelled) return
        if (u.role !== 'ADMIN') { clearAuth(); router.replace(u.status === 'PENDING' ? '/pending' : '/game'); return }
        setAuth(data.accessToken, u)
        setReady(true)
      } catch {
        if (!cancelled) { clearAuth(); router.replace('/login') }
      }
    }
    boot()
    return () => { cancelled = true }
  }, [])

  function handleLogout() {
    api.post('/api/auth/logout').catch(() => {})
    clearAuth()
    router.replace('/login')
  }

  return (
    <div className="void-grid min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="logo" className="h-9 w-auto rounded-md" />
            <span className="font-orbitron text-sm font-black neon-text-gold tracking-widest">ADMIN</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-orbitron text-xs px-3 py-1.5 rounded-lg tracking-widest transition-all"
                  style={{
                    color: active ? 'var(--gold)' : 'var(--text-muted)',
                    background: active ? 'rgba(255,210,74,0.08)' : 'transparent',
                    border: active ? '1px solid rgba(255,210,74,0.2)' : '1px solid transparent',
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:flex items-center gap-1 text-xs font-orbitron text-[var(--text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[#22c55e] font-bold">{stats.online}</span> online
          </span>
          <span className="hidden md:flex items-center gap-1 text-xs font-orbitron text-[var(--text-muted)]">
            🎯 <span className="neon-text-gold font-bold">{stats.totalBettors}</span> đã đặt
          </span>
          <span className="text-xs text-[var(--text-muted)] font-orbitron hidden sm:block">
            {user?.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-orbitron px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--crimson-xenon)] hover:text-[var(--crimson-xenon)] transition-all"
          >
            THOÁT
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden flex gap-1 px-4 py-2 border-b border-[var(--glass-border)] overflow-x-auto">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="font-orbitron text-xs px-3 py-1.5 rounded-lg tracking-widest whitespace-nowrap transition-all"
              style={{
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                background: active ? 'rgba(255,210,74,0.08)' : 'transparent',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        {ready ? children : (
          <div className="flex items-center justify-center py-20">
            <span className="font-orbitron text-sm neon-text-gold animate-pulse tracking-widest">ĐANG TẢI...</span>
          </div>
        )}
      </main>
    </div>
  )
}
