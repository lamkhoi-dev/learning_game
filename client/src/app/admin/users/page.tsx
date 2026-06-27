'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { User } from '@/types'
import { formatEnergy } from '@/lib/utils'

interface UserRow extends User { createdAt: string }
interface PendingUser { id: string; username: string; phone: string; createdAt: string }

type Tab = 'active' | 'pending'

export default function UsersPage() {
  const myId = useAuthStore((s) => s.user?.id)
  const [tab, setTab] = useState<Tab>('active')
  const [users, setUsers] = useState<UserRow[]>([])
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editEnergy, setEditEnergy] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const LIMIT = 20

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchUsers() {
    try {
      const { data } = await api.get('/api/admin/users', {
        params: { page, limit: LIMIT, search: search || undefined, status: 'ACTIVE' },
      })
      setUsers(data.users)
      setTotal(data.total)
    } catch { setUsers([]) }
  }

  async function fetchPending() {
    try {
      const { data } = await api.get('/api/admin/users/pending')
      setPendingUsers(data)
    } catch { setPendingUsers([]) }
  }

  useEffect(() => { fetchUsers() }, [page, search])
  useEffect(() => { fetchPending() }, [])

  async function saveEnergy(userId: string) {
    const val = parseInt(editEnergy)
    if (isNaN(val) || val < 0) { flash('Năng lượng không hợp lệ', false); return }
    setLoading(true)
    try {
      await api.put(`/api/admin/users/${userId}/energy`, { energy: val })
      flash('Đã cập nhật năng lượng')
      setEditId(null)
      fetchUsers()
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally { setLoading(false) }
  }

  async function approve(userId: string, username: string) {
    try {
      await api.put(`/api/admin/users/${userId}/approve`)
      flash(`Đã duyệt ${username}`)
      fetchPending()
      fetchUsers()
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    }
  }

  async function reject(userId: string, username: string) {
    if (!confirm(`Xoá tài khoản ${username}?`)) return
    try {
      await api.put(`/api/admin/users/${userId}/reject`)
      flash(`Đã từ chối ${username}`)
      fetchPending()
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    }
  }

  async function promoteAdmin(userId: string, username: string) {
    if (!confirm(`Thăng ${username} lên Admin?`)) return
    try {
      await api.put(`/api/admin/users/${userId}/role`, { role: 'ADMIN' })
      flash(`Đã thăng ${username} lên Admin`)
      fetchUsers()
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    }
  }

  async function deleteUser(userId: string, username: string) {
    if (!confirm(`XÓA tài khoản "${username}"? Toàn bộ lệnh cược của họ cũng bị xóa. Không thể hoàn tác.`)) return
    try {
      await api.delete(`/api/admin/users/${userId}`)
      flash(`Đã xóa tài khoản ${username}`)
      fetchUsers()
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    }
  }

  async function demoteUser(userId: string, username: string) {
    if (!confirm(`Hạ ${username} xuống người chơi thường?`)) return
    try {
      await api.put(`/api/admin/users/${userId}/role`, { role: 'USER' })
      flash(`Đã hạ ${username} xuống thường`)
      fetchUsers()
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h2 className="font-orbitron text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-wide">NGƯỜI DÙNG</h2>
          <div className="flex gap-1">
            {(['active', 'pending'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="font-orbitron text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  color: tab === t ? 'var(--gold)' : 'var(--text-muted)',
                  background: tab === t ? 'rgba(255,210,74,0.08)' : 'transparent',
                  border: `1px solid ${tab === t ? 'rgba(255,210,74,0.25)' : 'transparent'}`,
                }}
              >
                {t === 'active' ? `HOẠT ĐỘNG (${total})` : `CHỜ DUYỆT (${pendingUsers.length})`}
              </button>
            ))}
          </div>
        </div>
        {tab === 'active' && (
          <input
            type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm tên / sđt..."
            className="bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors w-full sm:w-52"
          />
        )}
      </div>

      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="font-orbitron text-xs px-4 py-2 rounded-lg"
            style={{
              color: msg.ok ? 'var(--gold)' : 'var(--crimson-xenon)',
              background: msg.ok ? 'rgba(255,210,74,0.08)' : 'rgba(255,23,68,0.08)',
              border: `1px solid ${msg.ok ? 'rgba(255,210,74,0.2)' : 'rgba(255,23,68,0.2)'}`,
            }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending tab */}
      {tab === 'pending' && (
        <div className="glass-panel overflow-hidden">
          {pendingUsers.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-sm">
              Không có tài khoản nào chờ duyệt
            </div>
          ) : (
            <div className="divide-y divide-[var(--glass-border)]">
              {pendingUsers.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-4"
                >
                  <div>
                    <div className="font-orbitron text-sm text-[var(--text-primary)]">{u.username}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{u.phone}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {new Date(u.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(u.id, u.username)}
                      className="font-orbitron text-xs px-4 py-2 rounded-lg bg-[var(--gold)] text-black tracking-widest hover:bg-[var(--gold-dim)] transition-all"
                      style={{ boxShadow: '0 0 12px rgba(255,210,74,0.25)' }}
                    >
                      DUYỆT
                    </button>
                    <button
                      onClick={() => reject(u.id, u.username)}
                      className="font-orbitron text-xs px-4 py-2 rounded-lg border border-[rgba(255,23,68,0.4)] text-[var(--crimson-xenon)] hover:bg-[rgba(255,23,68,0.08)] transition-all"
                    >
                      TỪ CHỐI
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active users tab — dạng thẻ, responsive */}
      {tab === 'active' && (
        <div className="glass-panel overflow-hidden">
          <div className="divide-y divide-[var(--glass-border)]">
            {users.map((u) => (
              <div key={u.id} className="flex items-start justify-between gap-3 px-4 py-3 flex-wrap hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                {/* Tên + sđt + quyền */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-orbitron text-sm text-[var(--text-primary)] truncate">{u.username}</span>
                    <span
                      className="font-orbitron text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        color: u.role === 'ADMIN' ? '#ffd600' : 'var(--text-muted)',
                        background: u.role === 'ADMIN' ? 'rgba(255,214,0,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${u.role === 'ADMIN' ? 'rgba(255,214,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {u.role === 'ADMIN' ? 'ADMIN' : 'NGƯỜI CHƠI'}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{u.phone}</div>
                </div>

                {/* Chíp + thao tác */}
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {editId === u.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" value={editEnergy}
                        onChange={(e) => setEditEnergy(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEnergy(u.id)}
                        className="w-24 bg-[rgba(255,255,255,0.08)] border border-[var(--gold)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveEnergy(u.id)} disabled={loading} className="text-[var(--gold)] text-xs font-orbitron">OK</button>
                      <button onClick={() => setEditId(null)} className="text-[var(--text-muted)] text-xs">✕</button>
                    </div>
                  ) : (
                    <span className="font-orbitron text-sm neon-text-gold">{formatEnergy(u.energy)} chíp</span>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => { setEditId(u.id); setEditEnergy(u.energy) }} className="text-xs font-orbitron text-[var(--gold)] hover:underline">
                      SỬA CHÍP
                    </button>
                    {u.role !== 'ADMIN' ? (
                      <button onClick={() => promoteAdmin(u.id, u.username)} className="text-xs font-orbitron text-[#ffd600] hover:underline">
                        LÊN ADMIN
                      </button>
                    ) : u.id !== myId && (
                      <button onClick={() => demoteUser(u.id, u.username)} className="text-xs font-orbitron text-[var(--text-muted)] hover:text-[var(--crimson-xenon)] hover:underline">
                        HẠ XUỐNG
                      </button>
                    )}
                    {u.role !== 'ADMIN' && u.id !== myId && (
                      <button onClick={() => deleteUser(u.id, u.username)} className="text-xs font-orbitron text-[var(--crimson-xenon)] hover:underline">
                        XÓA
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">Không tìm thấy người dùng</div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-[var(--glass-border)]">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="font-orbitron text-xs px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] disabled:opacity-30 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">←</button>
              <span className="font-orbitron text-xs text-[var(--text-muted)]">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="font-orbitron text-xs px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] disabled:opacity-30 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">→</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
