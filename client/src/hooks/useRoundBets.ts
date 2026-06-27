'use client'
import { useEffect, useState } from 'react'
import { RoundBet, BetFeedEntry } from '@/types'
import { useSocket } from './useSocket'
import api from '@/lib/api'

// Tải toàn bộ lệnh của ván hiện tại + cập nhật realtime (thêm/xóa). Xếp theo giờ tăng dần.
export function useRoundBets(roundId: string | undefined) {
  const { socket } = useSocket()
  const [bets, setBets] = useState<RoundBet[]>([])

  useEffect(() => {
    if (!roundId) { setBets([]); return }
    let active = true
    api.get(`/api/game/round/${roundId}/bets`)
      .then(({ data }) => { if (active) setBets(data) })
      .catch(() => {})
    return () => { active = false }
  }, [roundId])

  useEffect(() => {
    if (!socket) return
    const onAdd = (e: BetFeedEntry & { betId?: string; userId?: string }) => {
      if (!roundId || e.roundId !== roundId) return
      setBets((prev) => {
        // chỉ chặn trùng theo betId (1 người được đặt nhiều lệnh)
        if (e.betId && prev.some(b => b.betId === e.betId)) return prev
        return [...prev, {
          betId: e.betId ?? `${e.username}-${e.createdAt}`,
          userId: e.userId ?? '',
          username: e.username,
          choice: e.choice,
          amount: e.amount,
          createdAt: e.createdAt,
          roundId: e.roundId!,
        }]
      })
    }
    const onRemove = ({ betId }: { betId: string }) => {
      setBets((prev) => prev.filter(b => b.betId !== betId))
    }
    const onUpdate = ({ betId, amount }: { betId: string; amount: string }) => {
      setBets((prev) => prev.map(b => b.betId === betId ? { ...b, amount } : b))
    }
    socket.on('bet:feed', onAdd)
    socket.on('bet:feed:remove', onRemove)
    socket.on('bet:feed:update', onUpdate)
    return () => {
      socket.off('bet:feed', onAdd)
      socket.off('bet:feed:remove', onRemove)
      socket.off('bet:feed:update', onUpdate)
    }
  }, [socket, roundId])

  return { bets, setBets }
}
