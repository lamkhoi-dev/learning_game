'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useSocket } from '@/hooks/useSocket'
import { useRound } from '@/hooks/useRound'
import { useRoundBets } from '@/hooks/useRoundBets'
import { useBrand } from '@/hooks/useBrand'
import { useStats } from '@/hooks/useStats'
import { ChoiceCard } from '@/components/game/ChoiceCard'
import { BetPanel } from '@/components/game/BetPanel'
import { TwoColumnFeed } from '@/components/game/TwoColumnFeed'
import { WinOverlay } from '@/components/game/WinOverlay'
import { LoseOverlay } from '@/components/game/LoseOverlay'
import { CountdownOverlay } from '@/components/game/CountdownOverlay'
import { Choice, RoundBet } from '@/types'
import { displayChoice, formatEnergy } from '@/lib/utils'
import api from '@/lib/api'

export default function GamePage() {
  const router = useRouter()
  const { user, clearAuth, updateEnergy, accessToken, setAuth } = useAuthStore()
  const [booting, setBooting] = useState(!accessToken)
  const { socket, connected } = useSocket()
  const { round } = useRound()
  const brandName = useBrand()
  const { bets } = useRoundBets(round?.id)
  const onlineStats = useStats()

  const isAdmin = user?.role === 'ADMIN'

  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null)
  const [winVisible, setWinVisible] = useState(false)
  const [loseVisible, setLoseVisible] = useState(false)
  const [resultInfo, setResultInfo] = useState<{ result: Choice; amount: number }>({ result: 'T', amount: 0 })
  const [lastResult, setLastResult] = useState<Choice | null>(null)
  const [countdownVisible, setCountdownVisible] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(5)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Thống kê 2 bên từ danh sách lệnh
  const stats = useMemo(() => {
    let countT = 0, countX = 0, totalT = 0, totalX = 0
    for (const b of bets) {
      if (b.choice === 'T') { countT++; totalT += Number(b.amount) }
      else { countX++; totalX += Number(b.amount) }
    }
    return { countT, countX, totalT, totalX }
  }, [bets])

  // Các lệnh của chính tôi trong phiên + tổng mỗi bên
  const myBets = useMemo(() => bets.filter((b) => b.userId === user?.id), [bets, user?.id])
  const myTotals = useMemo(() => {
    let t = 0, x = 0
    for (const b of myBets) { if (b.choice === 'T') t += Number(b.amount); else x += Number(b.amount) }
    return { t, x }
  }, [myBets])

  // Snapshot lệnh của tôi để tính lãi/lỗ khi ra kết quả (bets bị reset khi sang phiên mới)
  const myBetsRef = useRef(myBets)
  myBetsRef.current = myBets

  // Khôi phục phiên khi reload (accessToken nằm trong RAM, mất khi F5)
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (accessToken) { setBooting(false); return }
      try {
        const { data } = await api.post('/api/auth/refresh')
        const { data: me } = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        })
        if (cancelled) return
        setAuth(data.accessToken, me)
        setBooting(false)
      } catch {
        if (!cancelled) router.replace('/login')
      }
    }
    boot()
    return () => { cancelled = true }
  }, [])

  // Chờ duyệt → sang trang pending
  useEffect(() => {
    if (user?.status === 'PENDING') router.replace('/pending')
  }, [user?.status])

  // Đổi phiên → reset lựa chọn (danh sách lệnh của tôi lấy từ feed)
  useEffect(() => {
    setSelectedChoice(null)
  }, [round?.id])

  // Socket events
  useEffect(() => {
    if (!socket) return

    socket.on('user:energy:update', ({ energy }: { energy: string }) => updateEnergy(energy))

    socket.on('round:countdown', ({ seconds }: { seconds: number }) => {
      setCountdownSeconds(seconds)
      setCountdownVisible(true)
      setTimeout(() => setCountdownVisible(false), seconds * 1000 + 500)
    })

    socket.on('bet:cancel:confirmed', () => setCancellingId(null))

    socket.on('round:result', ({ result, coefficient }: { result: Choice; coefficient: string }) => {
      setLastResult(result)
      const coef = Number(coefficient)
      const mine = myBetsRef.current
      if (mine.length === 0) return
      const staked = mine.reduce((s, b) => s + Number(b.amount), 0)
      const returned = mine.filter(b => b.choice === result).reduce((s, b) => s + Number(b.amount), 0) * coef
      const net = returned - staked
      if (returned >= staked) { setResultInfo({ result, amount: net }); setWinVisible(true) }
      else { setResultInfo({ result, amount: staked - returned }); setLoseVisible(true) }
    })

    return () => {
      socket.off('user:energy:update')
      socket.off('round:countdown')
      socket.off('round:result')
      socket.off('bet:cancel:confirmed')
    }
  }, [socket])

  const handleBet = useCallback(async (amount: string) => {
    if (!round || !selectedChoice || !socket) throw new Error('Không thể đặt cược lúc này')
    return new Promise<void>((resolve, reject) => {
      socket.emit('bet:place', { roundId: round.id, choice: selectedChoice, amount })
      const onConfirm = () => { cleanup(); resolve() }
      const onError = ({ error }: { error: string }) => { cleanup(); reject(new Error(error)) }
      function cleanup() {
        socket!.off('bet:confirmed', onConfirm)
        socket!.off('bet:error', onError)
      }
      socket.once('bet:confirmed', onConfirm)
      socket.once('bet:error', onError)
    })
  }, [round, selectedChoice, socket])

  // Hủy lệnh từ danh sách 2 cột: admin → API; user (lệnh của mình) → socket
  const handleCancelFromFeed = useCallback(async (bet: RoundBet) => {
    const who = isAdmin && bet.userId !== user?.id ? `lệnh của ${bet.username}` : 'lệnh của bạn'
    if (!confirm(`Hủy ${who} — ${displayChoice(bet.choice)} ${formatEnergy(bet.amount)} chíp? Chíp sẽ được hoàn lại.`)) return
    setCancellingId(bet.betId)
    try {
      if (isAdmin) {
        await api.delete(`/api/admin/bets/${bet.betId}`)
        setCancellingId(null)
      } else if (socket) {
        socket.emit('bet:cancel', { betId: bet.betId })
        setTimeout(() => setCancellingId(null), 4000)
      }
    } catch {
      setCancellingId(null)
    }
  }, [isAdmin, socket, user?.id])

  const canBet = round?.status === 'OPEN'
  const canCancel = round?.status === 'OPEN'

  if (booting) {
    return (
      <div className="void-grid min-h-screen flex items-center justify-center">
        <div className="font-orbitron text-sm neon-text-gold animate-pulse tracking-widest">ĐANG TẢI...</div>
      </div>
    )
  }

  return (
    <div className="void-grid min-h-screen flex flex-col">
      <CountdownOverlay visible={countdownVisible} seconds={countdownSeconds} />
      <WinOverlay visible={winVisible} result={resultInfo.result} net={resultInfo.amount} onDismiss={() => setWinVisible(false)} />
      <LoseOverlay visible={loseVisible} result={resultInfo.result} loss={resultInfo.amount} onDismiss={() => setLoseVisible(false)} />

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]/60 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt={brandName} className="h-10 w-auto rounded-md flex-shrink-0" />
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: connected ? 'var(--gold)' : '#555', boxShadow: connected ? '0 0 6px var(--gold)' : 'none' }}
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Tên người chơi */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <span className="text-sm">👤</span>
            <span className="text-xs sm:text-sm font-orbitron text-[var(--text-primary)] truncate max-w-[90px]">{user?.username}</span>
          </div>
          {/* Số chíp */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border" style={{ borderColor: 'var(--gold-dim)', background: 'rgba(255,210,74,0.08)' }}>
            <span className="text-sm">💰</span>
            <span className="font-orbitron text-xs sm:text-sm font-bold neon-text-gold">{formatEnergy(user?.energy ?? '0')}</span>
          </div>
          {isAdmin && (
            <button onClick={() => router.push('/admin/dashboard')}
              className="text-xs font-orbitron px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">
              ADMIN
            </button>
          )}
          <button onClick={() => { clearAuth(); router.replace('/login') }}
            className="text-xs font-orbitron px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--crimson-xenon)] hover:text-[var(--crimson-xenon)] transition-all">
            THOÁT
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">

        {/* ── Thanh trạng thái phiên ── */}
        <div className="glass-panel p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-orbitron text-sm font-bold tracking-widest neon-text-gold">
              {round?.status === 'OPEN' ? 'PHIÊN ĐANG MỞ — ĐẶT CƯỢC' : round?.status === 'LOCKED' ? 'ĐANG CHỐT KẾT QUẢ...' : round?.status === 'RESULT' ? 'PHIÊN ĐÃ KẾT THÚC' : 'CHỜ BẮT ĐẦU PHIÊN MỚI'}
            </p>
            {round && <p className="text-xs text-[var(--text-muted)] mt-0.5">Phiên #{round.id.slice(-6).toUpperCase()}</p>}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs font-orbitron text-[var(--text-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-[#22c55e] font-bold">{onlineStats.online}</span> online
              </span>
              <span className="flex items-center gap-1 text-xs font-orbitron text-[var(--text-muted)]">
                🎯 <span className="neon-text-gold font-bold">{onlineStats.totalBettors}</span> đã đặt
              </span>
            </div>
          </div>
          {/* Kết quả + hệ số */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[10px] text-[var(--text-muted)] font-orbitron tracking-widest">HỆ SỐ</div>
              <div className="font-orbitron text-lg font-black neon-text-gold">×{round?.coefficient ?? '—'}</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg border" style={{
              borderColor: lastResult === 'X' ? 'var(--crimson-xenon)' : lastResult === 'T' ? 'var(--cyan-titan)' : 'var(--glass-border)',
            }}>
              <div className="text-[10px] text-[var(--text-muted)] font-orbitron tracking-widest">KẾT QUẢ</div>
              <div className="font-orbitron text-2xl font-black" style={{
                color: lastResult === 'X' ? 'var(--crimson-xenon)' : lastResult === 'T' ? 'var(--cyan-titan)' : 'var(--text-muted)',
              }}>
                {lastResult ? displayChoice(lastResult) : '—'}
              </div>
              {/* Live on TikTok ngay dưới ô kết quả */}
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--crimson-xenon)] animate-pulse" />
                <span className="text-[10px] font-orbitron tracking-wider text-[var(--text-muted)]">Live on TikTok</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Thẻ chọn T / X ── */}
        <div>
          <p className="text-xs text-[var(--text-muted)] font-orbitron tracking-widest mb-2 text-center">
            BẤM CHỌN ₮ HOẶC Ӿ RỒI ĐẶT CƯỢC
          </p>
          <div className="flex gap-3">
            {(['T', 'X'] as Choice[]).map((c) => (
              <ChoiceCard
                key={c}
                choice={c}
                selected={selectedChoice === c}
                disabled={!canBet}
                betCount={c === 'T' ? stats.countT : stats.countX}
                onSelect={() => canBet && setSelectedChoice(c)}
              />
            ))}
          </div>
        </div>

        {/* ── Khu đặt cược ── */}
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs font-orbitron tracking-widest" style={{ color: canBet ? 'var(--text-muted)' : 'var(--text-muted)' }}>
              {canBet
                ? selectedChoice ? `ĐANG CHỌN ${displayChoice(selectedChoice)} — NHẬP SỐ CHÍP` : 'CHỌN ₮ HOẶC Ӿ RỒI ĐẶT (ĐẶT NHIỀU LẦN, CẢ 2 BÊN)'
                : round?.status === 'LOCKED' ? 'ĐANG CHỐT KẾT QUẢ...'
                : 'CHƯA THỂ ĐẶT CƯỢC'}
            </p>
            {(myTotals.t > 0 || myTotals.x > 0) && (
              <p className="text-xs font-orbitron">
                <span className="text-[var(--text-muted)]">Bạn đặt: </span>
                {myTotals.t > 0 && <span className="neon-text-cyan">₮ {formatEnergy(myTotals.t)}</span>}
                {myTotals.t > 0 && myTotals.x > 0 && <span className="text-[var(--text-muted)]"> · </span>}
                {myTotals.x > 0 && <span style={{ color: 'var(--crimson-xenon)' }}>Ӿ {formatEnergy(myTotals.x)}</span>}
              </p>
            )}
          </div>
          <BetPanel
            roundId={round?.id ?? ''}
            choice={selectedChoice}
            userEnergy={user?.energy ?? '0'}
            disabled={!canBet || !selectedChoice}
            onBet={handleBet}
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-2 text-center">
            Hủy từng lệnh ở danh sách bên dưới (nút HỦY)
          </p>
        </div>

        {/* ── 2 cột live + tổng chíp ── */}
        <div>
          <p className="text-xs text-[var(--text-muted)] font-orbitron tracking-widest mb-2 flex items-center gap-2">
            <span>NGƯỜI CHƠI ĐANG ĐẶT</span>
            <span className="neon-text-gold">({bets.length})</span>
          </p>
          <TwoColumnFeed
            bets={bets}
            currentUserId={user?.id ?? ''}
            isAdmin={isAdmin}
            canCancel={canCancel}
            cancellingId={cancellingId}
            onCancel={handleCancelFromFeed}
          />
        </div>

        {/* Miễn trừ trách nhiệm */}
        <p className="text-[10px] leading-relaxed text-center max-w-xl mx-auto pt-2 pb-4"
          style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
          Sản phẩm chỉ mang tính chất giải trí và giáo dục. Chíp trong trò chơi là ảo, không có giá trị quy đổi
          và không liên quan đến tiền thật. Vui lòng chơi có trách nhiệm.
        </p>
      </main>
    </div>
  )
}
