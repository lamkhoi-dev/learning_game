'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import api from '@/lib/api'
import { Round } from '@/types'

interface DashboardData {
  activeRound: (Round & { _count: { bets: number } }) | null
  totalBetsToday: number
  totalUsers: number
  pendingUsers: number
}

const STATUS_LABELS: Record<string, string> = {
  WAITING: 'CHỜ MỞ', OPEN: 'ĐANG ĐẶT CƯỢC', LOCKED: 'ĐÃ KHÓA', RESULT: 'KẾT QUẢ',
}
const STATUS_COLORS: Record<string, string> = {
  WAITING: '#ffd600', OPEN: '#00f5ff', LOCKED: '#ff6d00', RESULT: '#69ff47',
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.get('/api/admin/dashboard').then(({ data: d }) => setData(d)).catch(() => {})
    const interval = setInterval(() => {
      api.get('/api/admin/dashboard').then(({ data: d }) => setData(d)).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const stats = [
    { label: 'LỆNH HÔM NAY', value: data?.totalBetsToday ?? '-', color: 'var(--gold)' },
    { label: 'TỔNG NGƯỜI DÙNG', value: data?.totalUsers ?? '-', color: 'var(--gold)' },
    { label: 'CHỜ DUYỆT', value: data?.pendingUsers ?? '-', color: (data?.pendingUsers ?? 0) > 0 ? '#ffd600' : 'var(--text-muted)' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="font-orbitron text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-wide">
        TỔNG QUAN
      </h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(({ label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel p-5"
          >
            <div className="font-orbitron text-2xl font-black" style={{ color, textShadow: `0 0 12px ${color}60` }}>{value}</div>
            <div className="text-xs text-[var(--text-muted)] tracking-widest mt-1">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Active round */}
      <div className="glass-panel p-5">
        <h3 className="font-orbitron text-xs text-[var(--text-muted)] tracking-widest mb-4">
          PHIÊN HIỆN TẠI
        </h3>
        {data?.activeRound ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="font-orbitron text-xs px-3 py-1 rounded-full"
                style={{
                  color: STATUS_COLORS[data.activeRound.status],
                  background: `${STATUS_COLORS[data.activeRound.status]}15`,
                  border: `1px solid ${STATUS_COLORS[data.activeRound.status]}30`,
                }}
              >
                {STATUS_LABELS[data.activeRound.status]}
              </span>
              <span className="text-sm text-[var(--text-primary)] font-orbitron">
                #{data.activeRound.id.slice(-8).toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-[var(--text-muted)] tracking-widest mb-1">HỆ SỐ</div>
                <div className="font-orbitron font-bold neon-text-gold">×{data.activeRound.coefficient}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)] tracking-widest mb-1">SỐ LỆNH</div>
                <div className="font-orbitron font-bold text-[var(--text-primary)]">
                  {data.activeRound._count.bets}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/rounds')}
              className="font-orbitron text-xs px-4 py-2 rounded-lg border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,210,74,0.08)] transition-all tracking-widest"
            >
              QUẢN LÝ PHIÊN →
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-[var(--text-muted)] text-sm mb-4">Chưa có phiên nào đang chạy</p>
            <button
              onClick={() => router.push('/admin/rounds')}
              className="font-orbitron text-xs px-4 py-2 rounded-lg bg-[var(--gold)] text-black hover:bg-[var(--gold-dim)] transition-all tracking-widest"
              style={{ boxShadow: '0 0 16px rgba(255,210,74,0.3)' }}
            >
              TẠO PHIÊN MỚI
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
