'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useSocket } from '@/hooks/useSocket'
import { useRound } from '@/hooks/useRound'
import { useRoundBets } from '@/hooks/useRoundBets'
import { useSettings } from '@/hooks/useSettings'
import { useStats } from '@/hooks/useStats'
import { ChoiceCard } from '@/components/game/ChoiceCard'
import { BetPanel } from '@/components/game/BetPanel'
import { TwoColumnFeed } from '@/components/game/TwoColumnFeed'
import { LivePlayer } from '@/components/game/LivePlayer'
import { ChatWidget } from '@/components/game/ChatWidget'
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
  const settings = useSettings()
  const brandName = settings.brandName
  const { bets } = useRoundBets(round?.id)
  const onlineStats = useStats()

  const isAdmin = user?.role === 'ADMIN'
  const gameAreaRef = useRef<HTMLElement>(null)
  const [chatMaxHeight, setChatMaxHeight] = useState<number | undefined>(undefined)

  // Đo đúng ranh giới video/khu chơi để panel chat không bao giờ trùm lên video
  useEffect(() => {
    if (!settings.streamOn) { setChatMaxHeight(undefined); return }
    function measure() {
      const top = gameAreaRef.current?.getBoundingClientRect().top
      if (top == null) return
      const reserved = 84 // khoảng cách nút chat + lề dưới đáy màn hình
      setChatMaxHeight(Math.max(160, window.innerHeight - top - reserved))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [settings.streamOn])

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

  const canBet = round?.status === 'OPEN' && !round?.paused
  const canCancel = round?.status === 'OPEN'

  if (booting) {
    return (
      <div className="void-grid min-h-screen flex items-center justify-center">
        <div className="font-orbitron text-sm neon-text-gold animate-pulse tracking-widest">ĐANG TẢI...</div>
      </div>
    )
  }

  const resultColor = lastResult === 'X' ? 'var(--crimson-xenon)' : lastResult === 'T' ? 'var(--cyan-titan)' : 'var(--text-muted)'
  const statusText = round?.paused ? '⏸ TẠM KHÓA'
    : round?.status === 'OPEN' ? '🟢 ĐANG MỞ'
    : round?.status === 'LOCKED' ? '⏳ ĐANG CHỐT'
    : round?.status === 'RESULT' ? 'ĐÃ KẾT THÚC'
    : 'CHỜ PHIÊN'

  // ── Khu chơi (gọn) ──
  const gameArea = (
    <div className="px-3 py-2 flex flex-col gap-2">
      {/* Thanh trạng thái gọn */}
      <div className="glass-panel px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap">
        <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: round?.paused ? 'var(--crimson-xenon)' : 'var(--gold)' }}>
          {statusText}{round && <span className="text-[var(--text-muted)] font-normal ml-1.5">#{round.id.slice(-4).toUpperCase()}</span>}
        </span>
        <div className="flex items-center gap-3 text-xs font-orbitron">
          <span className="text-[var(--text-muted)]">Hệ số <span className="neon-text-gold font-bold">×{round?.coefficient ?? '—'}</span></span>
          <span className="text-[var(--text-muted)]">KQ <span className="font-black text-base align-middle" style={{ color: resultColor }}>{lastResult ? displayChoice(lastResult) : '—'}</span></span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-orbitron w-full sm:w-auto">
          <span className="flex items-center gap-1 text-[var(--text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" /><span className="text-[#22c55e] font-bold">{onlineStats.online}</span> online
          </span>
          <span className="text-[var(--text-muted)]">🎯 <span className="neon-text-gold font-bold">{onlineStats.totalBettors}</span> đã đặt</span>
        </div>
      </div>

      {/* Thẻ chọn A / B (gọn, kèm tổng chíp mỗi bên) */}
      <div className="flex gap-2">
        {(['T', 'X'] as Choice[]).map((c) => (
          <ChoiceCard
            key={c}
            choice={c}
            compact
            selected={selectedChoice === c}
            disabled={!canBet}
            betCount={c === 'T' ? stats.countT : stats.countX}
            total={c === 'T' ? stats.totalT : stats.totalX}
            onSelect={() => canBet && setSelectedChoice(c)}
          />
        ))}
      </div>

      {/* Khu đặt cược */}
      <div className="glass-panel p-2.5">
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <p className="text-[11px] font-orbitron tracking-widest text-[var(--text-muted)]">
            {canBet
              ? selectedChoice ? `ĐANG CHỌN ${displayChoice(selectedChoice)} — NHẬP CHÍP` : 'CHỌN A / B RỒI ĐẶT'
              : round?.paused ? '⏸ TẠM KHÓA — CHỜ CHÚT'
              : round?.status === 'LOCKED' ? 'ĐANG CHỐT KẾT QUẢ...'
              : 'CHƯA THỂ ĐẶT'}
          </p>
          {(myTotals.t > 0 || myTotals.x > 0) && (
            <p className="text-[11px] font-orbitron">
              <span className="text-[var(--text-muted)]">Bạn: </span>
              {myTotals.t > 0 && <span className="neon-text-cyan">A{formatEnergy(myTotals.t)}</span>}
              {myTotals.t > 0 && myTotals.x > 0 && <span className="text-[var(--text-muted)]"> · </span>}
              {myTotals.x > 0 && <span style={{ color: 'var(--crimson-xenon)' }}>B{formatEnergy(myTotals.x)}</span>}
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
      </div>

      {/* 2 cột người chơi đang đặt */}
      <div>
        <p className="text-[11px] text-[var(--text-muted)] font-orbitron tracking-widest mb-1.5 flex items-center gap-2">
          <span>NGƯỜI CHƠI ĐANG ĐẶT</span><span className="neon-text-gold">({bets.length})</span>
        </p>
        <TwoColumnFeed
          bets={bets}
          currentUserId={user?.id ?? ''}
          isAdmin={isAdmin}
          canCancel={isAdmin && canCancel}
          cancellingId={cancellingId}
          onCancel={handleCancelFromFeed}
        />
      </div>

      <p className="text-[10px] leading-relaxed text-center max-w-xl mx-auto pt-1 pb-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
        Sản phẩm chỉ mang tính giải trí & giáo dục. Chíp là ảo, không quy đổi tiền thật. Chơi có trách nhiệm.
      </p>
    </div>
  )

  return (
    <div className="void-grid h-[100dvh] flex flex-col overflow-hidden">
      <CountdownOverlay visible={countdownVisible} seconds={countdownSeconds} />
      <WinOverlay visible={winVisible} result={resultInfo.result} net={resultInfo.amount} onDismiss={() => setWinVisible(false)} />
      <LoseOverlay visible={loseVisible} result={resultInfo.result} loss={resultInfo.amount} onDismiss={() => setLoseVisible(false)} />

      {/* ── Header slim ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]/70 backdrop-blur z-30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-orbitron text-sm font-black neon-text-gold tracking-widest truncate">{brandName}</span>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: connected ? 'var(--gold)' : '#555', boxShadow: connected ? '0 0 6px var(--gold)' : 'none' }} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <span className="text-xs">👤</span>
            <span className="text-xs font-orbitron text-[var(--text-primary)] truncate max-w-[60px] sm:max-w-[100px]">{user?.username}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--gold-dim)', background: 'rgba(255,210,74,0.08)' }}>
            <span className="text-xs">💰</span>
            <span className="font-orbitron text-xs font-bold neon-text-gold">{formatEnergy(user?.energy ?? '0')}</span>
          </div>
          {isAdmin && (
            <button onClick={() => router.push('/admin/dashboard')} className="text-[11px] font-orbitron px-2 py-1 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all">
              ADMIN
            </button>
          )}
          <button onClick={() => { clearAuth(); router.replace('/login') }} className="text-[11px] font-orbitron px-2 py-1 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--crimson-xenon)] hover:text-[var(--crimson-xenon)] transition-all">
            THOÁT
          </button>
        </div>
      </header>

      {/* ── Thân: cột giữa kiểu điện thoại ── */}
      <div className="flex-1 min-h-0 w-full max-w-[560px] mx-auto flex flex-col">
        {settings.streamOn ? (
          <>
            {/* VIDEO 3/5 + chat trong suốt phủ lên */}
            <section className="relative flex-[3] min-h-0 bg-black">
              <LivePlayer url={settings.streamUrl} type={settings.streamType} on={settings.streamOn} fill />

              {/* Badge trạng thái nổi trên video */}
              <div className="absolute top-2 left-2 right-2 z-20 pointer-events-none flex items-start justify-between gap-2">
                <span className="font-orbitron text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.45)', color: round?.paused ? 'var(--crimson-xenon)' : 'var(--gold)', backdropFilter: 'blur(3px)' }}>
                  {statusText} · ×{round?.coefficient ?? '—'}
                </span>
                <span className="font-orbitron text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', backdropFilter: 'blur(3px)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />{onlineStats.online}
                </span>
              </div>
            </section>

            {/* KHU CHƠI 2/5 (cuộn được) */}
            <section ref={gameAreaRef} className="flex-[2] min-h-0 overflow-y-auto">
              {gameArea}
            </section>
          </>
        ) : (
          <section className="flex-1 min-h-0 overflow-y-auto">
            {gameArea}
          </section>
        )}
      </div>

      {/* Chat dạng bong bóng nổi */}
      <ChatWidget isAdmin={isAdmin} currentUserId={user?.id ?? ''} compact={settings.streamOn} maxPanelHeight={chatMaxHeight} />
    </div>
  )
}
