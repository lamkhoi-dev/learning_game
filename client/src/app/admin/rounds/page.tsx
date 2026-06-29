'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Round, RoundBet } from '@/types'
import { TwoColumnFeed } from '@/components/game/TwoColumnFeed'

export default function RoundsPage() {
  const { socket } = useSocket()
  const adminId = useAuthStore((s) => s.user?.id) ?? ''
  const [activeRound, setActiveRound] = useState<Round | null>(null)
  const [coefficient, setCoefficient] = useState('0.95')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pendingResult, setPendingResult] = useState<'T' | 'X' | null>(null)
  const [liveBets, setLiveBets] = useState<RoundBet[]>([])
  const [cancellingBet, setCancellingBet] = useState<string | null>(null)
  const [savingBet, setSavingBet] = useState<string | null>(null)
  const [editCoef, setEditCoef] = useState<string | null>(null) // giá trị đang sửa hệ số (null = không sửa)

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function fetchRound() {
    try {
      const { data } = await api.get('/api/game/round/current')
      setActiveRound(data)
    } catch { setActiveRound(null) }
  }

  useEffect(() => { fetchRound() }, [])

  async function cancelBet(bet: RoundBet) {
    const sym = bet.choice === 'T' ? '₮' : 'Ӿ'
    if (!confirm(`Hủy lệnh ${sym} của ${bet.username} (${Number(bet.amount).toLocaleString('vi-VN')} chíp)? Chíp sẽ được hoàn lại.`)) return
    setCancellingBet(bet.betId)
    try {
      await api.delete(`/api/admin/bets/${bet.betId}`)
      setLiveBets(prev => prev.filter(b => b.betId !== bet.betId))
      flash('Đã hủy lệnh — hoàn chíp cho người chơi')
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally {
      setCancellingBet(null)
    }
  }

  async function saveCoefficient() {
    if (!activeRound || editCoef === null) return
    const val = parseFloat(editCoef)
    if (isNaN(val) || val <= 0) { flash('Hệ số phải lớn hơn 0', false); return }
    setLoading(true)
    try {
      const { data } = await api.put(`/api/admin/rounds/${activeRound.id}/coefficient`, { coefficient: val })
      setActiveRound(data)
      setEditCoef(null)
      flash(`Đã chỉnh hệ số ×${data.coefficient}`)
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally { setLoading(false) }
  }

  async function editBet(bet: RoundBet, newAmount: number) {
    setSavingBet(bet.betId)
    try {
      await api.put(`/api/admin/bets/${bet.betId}`, { amount: newAmount })
      setLiveBets(prev => prev.map(b => b.betId === bet.betId ? { ...b, amount: String(newAmount) } : b))
      flash('Đã sửa số chíp lệnh')
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally {
      setSavingBet(null)
    }
  }

  // Load bets khi round thay đổi
  useEffect(() => {
    if (!activeRound || activeRound.status === 'RESULT') { setLiveBets([]); return }
    api.get(`/api/admin/rounds/${activeRound.id}/bets`)
      .then(({ data }) => setLiveBets(data))
      .catch(() => {})
  }, [activeRound?.id])

  // Lắng nghe round:state + bet:feed + bet:feed:remove
  useEffect(() => {
    if (!socket) return
    const onRound = (r: Round) => setActiveRound(r)
    const onBet = (entry: RoundBet) => {
      setLiveBets(prev => {
        if (activeRound && entry.roundId !== activeRound.id) return prev
        if (prev.some(b => b.betId === entry.betId)) return prev
        return [...prev, entry]
      })
    }
    const onRemove = ({ betId }: { betId: string }) => {
      setLiveBets(prev => prev.filter(b => b.betId !== betId))
    }
    const onUpdate = ({ betId, amount }: { betId: string; amount: string }) => {
      setLiveBets(prev => prev.map(b => b.betId === betId ? { ...b, amount } : b))
    }
    socket.on('round:state', onRound)
    socket.on('bet:feed', onBet)
    socket.on('bet:feed:remove', onRemove)
    socket.on('bet:feed:update', onUpdate)
    return () => {
      socket.off('round:state', onRound)
      socket.off('bet:feed', onBet)
      socket.off('bet:feed:remove', onRemove)
      socket.off('bet:feed:update', onUpdate)
    }
  }, [socket, activeRound?.id])

  async function togglePause(paused: boolean) {
    if (!activeRound) return
    setLoading(true)
    try {
      const { data } = await api.put(`/api/admin/rounds/${activeRound.id}/pause`, { paused })
      setActiveRound(data)
      flash(paused ? 'Đã khóa phòng — ngừng nhận cược' : 'Đã mở lại phòng — tiếp tục nhận cược')
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally { setLoading(false) }
  }

  async function createRound() {
    setLoading(true)
    try {
      const { data } = await api.post('/api/admin/rounds', { coefficient: parseFloat(coefficient) })
      setActiveRound(data)
      flash('Phiên mới đã mở — đang nhận cược')
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally { setLoading(false) }
  }

  async function lockAndReveal(result: 'T' | 'X') {
    setLoading(true)
    try {
      await api.put(`/api/admin/rounds/${activeRound!.id}/lock-and-result`, { result })
      flash(`Đã khoá! Kết quả ${result === 'T' ? '₮' : 'Ӿ'} hiện sau 5 giây — round mới sẽ tự tạo`)
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally { setLoading(false) }
  }

  const STATUS_COLOR: Record<string, string> = {
    WAITING: '#ffd600', OPEN: '#00f5ff', LOCKED: '#ff6d00', RESULT: '#69ff47',
  }
  const STATUS_LABEL: Record<string, string> = {
    WAITING: 'CHỜ MỞ', OPEN: 'ĐANG ĐẶT CƯỢC', LOCKED: 'ĐÃ KHOÁ', RESULT: 'KẾT QUẢ',
  }

  const noActiveRound = !activeRound || activeRound.status === 'RESULT'

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="font-orbitron text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-wide">
        QUẢN LÝ PHIÊN
      </h2>

      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="font-orbitron text-xs px-4 py-3 rounded-lg"
            style={{
              color: msg.ok ? 'var(--gold)' : 'var(--crimson-xenon)',
              background: msg.ok ? 'rgba(255,210,74,0.08)' : 'rgba(255,23,68,0.08)',
              border: `1px solid ${msg.ok ? 'rgba(255,210,74,0.25)' : 'rgba(255,23,68,0.2)'}`,
            }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current round */}
      {activeRound && activeRound.status !== 'RESULT' && (
        <div className="glass-panel p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] tracking-widest font-orbitron">PHIÊN HIỆN TẠI</p>
              <p className="font-orbitron font-bold mt-0.5">#{activeRound.id.slice(-8).toUpperCase()}</p>
            </div>
            <span
              className="font-orbitron text-xs px-3 py-1.5 rounded-full"
              style={{
                color: STATUS_COLOR[activeRound.status],
                background: `${STATUS_COLOR[activeRound.status]}15`,
                border: `1px solid ${STATUS_COLOR[activeRound.status]}30`,
              }}
            >
              {STATUS_LABEL[activeRound.status]}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="text-[var(--text-muted)]">Hệ số thắng:</span>
            {editCoef !== null ? (
              <div className="flex items-center gap-2">
                <input
                  type="number" step="0.01" min="0" value={editCoef}
                  onChange={(e) => setEditCoef(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveCoefficient(); if (e.key === 'Escape') setEditCoef(null) }}
                  autoFocus
                  className="w-24 bg-[rgba(255,255,255,0.08)] border border-[var(--gold)] rounded px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none"
                />
                <button onClick={saveCoefficient} disabled={loading}
                  className="font-orbitron text-xs px-3 py-1 rounded bg-[var(--gold)] text-black tracking-widest disabled:opacity-40">
                  {loading ? '...' : 'LƯU'}
                </button>
                <button onClick={() => setEditCoef(null)} className="text-xs text-[var(--text-muted)]">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-orbitron text-lg neon-text-gold">×{activeRound.coefficient}</span>
                {activeRound.status === 'OPEN' && (
                  <button
                    onClick={() => setEditCoef(String(activeRound.coefficient))}
                    className="font-orbitron text-[10px] px-2 py-1 rounded border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,210,74,0.1)] transition-all tracking-widest"
                  >
                    CHỈNH
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Khóa/Mở phòng tạm thời */}
          {activeRound.status === 'OPEN' && (
            <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg" style={{
              background: activeRound.paused ? 'rgba(255,23,68,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeRound.paused ? 'rgba(255,23,68,0.3)' : 'var(--glass-border)'}`,
            }}>
              <span className="text-sm font-orbitron" style={{ color: activeRound.paused ? 'var(--crimson-xenon)' : 'var(--text-muted)' }}>
                {activeRound.paused ? '⏸ PHÒNG ĐANG TẠM KHÓA' : '● Đang nhận cược'}
              </span>
              <button
                onClick={() => togglePause(!activeRound.paused)}
                disabled={loading}
                className="ml-auto font-orbitron text-xs px-4 py-2 rounded-lg tracking-widest disabled:opacity-40 transition-all"
                style={activeRound.paused
                  ? { background: 'var(--gold)', color: '#000', boxShadow: '0 0 12px rgba(255,210,74,0.3)' }
                  : { border: '1px solid var(--crimson-xenon)', color: 'var(--crimson-xenon)' }}
              >
                {loading ? '...' : activeRound.paused ? '▶ MỞ LẠI PHÒNG' : '⏸ KHÓA PHÒNG'}
              </button>
            </div>
          )}

          {/* OPEN → chọn kết quả & khoá */}
          {activeRound.status === 'OPEN' && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)] font-orbitron tracking-widest">
                CHỌN KẾT QUẢ & KHOÁ:
              </p>

              {pendingResult ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-orbitron">
                    Xác nhận{' '}
                    <span style={{ color: pendingResult === 'T' ? 'var(--cyan-titan)' : 'var(--crimson-xenon)' }}>
                      {pendingResult === 'T' ? '₮' : 'Ӿ'}
                    </span>{' '}
                    thắng?
                  </span>
                  <button
                    onClick={() => { lockAndReveal(pendingResult); setPendingResult(null) }}
                    disabled={loading}
                    className="font-orbitron text-xs px-5 py-2.5 rounded-lg bg-[var(--gold)] text-black tracking-widest disabled:opacity-40 transition-all"
                    style={{ boxShadow: '0 0 16px rgba(255,210,74,0.3)' }}
                  >
                    {loading ? '...' : 'XÁC NHẬN & KHOÁ ⏱'}
                  </button>
                  <button onClick={() => setPendingResult(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    HỦY
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingResult('T')} disabled={loading}
                    className="flex-1 font-orbitron text-lg font-black py-5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95"
                    style={{ borderColor: 'var(--cyan-titan)', color: 'var(--cyan-titan)', background: 'rgba(0,245,255,0.06)', boxShadow: '0 0 20px rgba(0,245,255,0.1)' }}
                  >
                    ₮
                  </button>
                  <button
                    onClick={() => setPendingResult('X')} disabled={loading}
                    className="flex-1 font-orbitron text-lg font-black py-5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95"
                    style={{ borderColor: 'var(--crimson-xenon)', color: 'var(--crimson-xenon)', background: 'rgba(255,23,68,0.06)', boxShadow: '0 0 20px rgba(255,23,68,0.1)' }}
                  >
                    Ӿ
                  </button>
                </div>
              )}
            </div>
          )}

          {activeRound.status === 'LOCKED' && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#ff6d00] animate-pulse" />
              <span className="font-orbitron text-xs text-[#ff6d00] tracking-widest animate-pulse">
                ĐANG ĐẾM NGƯỢC — PHIÊN MỚI SẮP TẠO...
              </span>
            </div>
          )}

          {/* Live bets — 2 cột ₮ / Ӿ, có sửa & hủy */}
          <div className="border-t border-[var(--glass-border)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[var(--text-muted)] font-orbitron tracking-widest">
                LỆNH ĐẶT CƯỢC
              </p>
              <span className="font-orbitron text-xs px-2 py-0.5 rounded-full"
                style={{ color: 'var(--gold)', background: 'rgba(255,210,74,0.1)' }}>
                {liveBets.length}
              </span>
            </div>
            <TwoColumnFeed
              bets={liveBets}
              currentUserId={adminId}
              isAdmin={true}
              canCancel={activeRound?.status === 'OPEN'}
              cancellingId={cancellingBet}
              onCancel={cancelBet}
              canEdit={true}
              savingId={savingBet}
              onEdit={editBet}
              tall
            />
          </div>
        </div>
      )}

      {/* Không có round → tạo mới */}
      {noActiveRound && (
        <div className="glass-panel p-6 space-y-5">
          <div>
            <p className="font-orbitron text-xs text-[var(--text-muted)] tracking-widest mb-1">
              {activeRound?.status === 'RESULT' ? 'PHIÊN VỪA KẾT THÚC — TẠO PHIÊN MỚI:' : 'CHƯA CÓ PHIÊN — TẠO ĐỂ BẮT ĐẦU:'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Phiên sẽ tự mở ngay và tự tạo phiên tiếp theo sau mỗi kết quả.</p>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest font-orbitron uppercase">
              Hệ số nhân khi thắng
            </label>
            <input
              type="number" step="0.01" min="0"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              className="w-48 bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] transition-colors"
            />
          </div>
          <button
            onClick={createRound} disabled={loading}
            className="font-orbitron text-xs px-6 py-2.5 rounded-lg bg-[var(--gold)] text-black hover:bg-[var(--gold-dim)] disabled:opacity-40 transition-all tracking-widest"
            style={{ boxShadow: '0 0 16px rgba(255,210,74,0.3)' }}
          >
            {loading ? '...' : '▶ KHỞI ĐỘNG PHIÊN'}
          </button>
        </div>
      )}
    </div>
  )
}
