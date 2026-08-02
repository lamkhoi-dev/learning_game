'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RoundBet, Choice } from '@/types'
import { formatEnergy } from '@/lib/utils'

interface Props {
  bets: RoundBet[]
  currentUserId: string
  isAdmin: boolean
  canCancel: boolean // round đang OPEN
  cancellingId: string | null
  onCancel: (bet: RoundBet) => void
  // Sửa số chíp (chỉ admin)
  canEdit?: boolean
  savingId?: string | null
  onEdit?: (bet: RoundBet, newAmount: number) => void
  tall?: boolean // cột cao hơn (dùng cho admin)
}

interface EditCtx {
  editId: string | null
  editVal: string
  setEditVal: (v: string) => void
  startEdit: (bet: RoundBet) => void
  cancelEdit: () => void
  submitEdit: (bet: RoundBet) => void
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function Column({ side, color, ...rest }: Props & EditCtx & { side: Choice; color: string }) {
  const { bets, currentUserId, isAdmin, canCancel, cancellingId, onCancel,
    canEdit, savingId, editId, editVal, setEditVal, startEdit, cancelEdit, submitEdit } = rest
  const sideBets = bets.filter(b => b.choice === side)
  const total = sideBets.reduce((s, b) => s + Number(b.amount), 0)
  const symbol = side === 'T' ? '₮' : 'Ӿ'

  return (
    <div className="flex-1 min-w-0 flex flex-col rounded-xl border" style={{ borderColor: `${color}40`, background: `${color}08` }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: `${color}25` }}>
        <div className="flex items-center gap-2">
          <span className="font-orbitron text-xl font-black" style={{ color }}>{symbol}</span>
          <span className="text-xs font-orbitron tracking-widest" style={{ color }}>{sideBets.length} lệnh</span>
        </div>
      </div>

      <div className={`flex-1 flex flex-col gap-1 p-2 overflow-y-auto min-h-[120px] ${rest.tall ? 'max-h-[520px]' : 'max-h-[340px]'}`}>
        <AnimatePresence initial={false}>
          {sideBets.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center py-6">Chưa có lệnh</p>
          )}
          {sideBets.map((b) => {
            const mine = b.userId === currentUserId
            const showCancel = canCancel && (isAdmin || mine)
            const showEdit = canEdit && canCancel
            const editing = editId === b.betId
            return (
              <motion.div
                key={b.betId}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: side === 'T' ? -12 : 12 }}
                transition={{ duration: 0.2 }}
                className="px-2.5 py-2 rounded-lg"
                style={{ background: mine ? `${color}1a` : 'rgba(255,255,255,0.03)' }}
              >
                {/* Hàng 1: tên + số chíp (luôn đầy đủ, không bị nút che) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm text-[var(--text-primary)] truncate">{b.username}</span>
                    {mine && <span className="text-[9px] font-orbitron px-1 rounded flex-shrink-0" style={{ color, background: `${color}25` }}>BẠN</span>}
                  </div>
                  <span className="font-orbitron text-sm font-bold flex-shrink-0" style={{ color }}>
                    {formatEnergy(b.amount)}
                  </span>
                </div>

                {/* Hàng 2: giờ + thao tác (hoặc ô sửa) */}
                {editing ? (
                  <div className="flex items-center gap-1 mt-1.5 justify-end">
                    <input
                      type="number" value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(b); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus
                      className="flex-1 min-w-0 bg-[rgba(255,255,255,0.1)] border rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                      style={{ borderColor: color }}
                    />
                    <button onClick={() => submitEdit(b)} disabled={savingId === b.betId}
                      className="text-[10px] font-orbitron px-2.5 py-1 rounded text-black flex-shrink-0" style={{ background: color }}>
                      {savingId === b.betId ? '...' : 'LƯU'}
                    </button>
                    <button onClick={cancelEdit} className="text-[10px] text-[var(--text-muted)] px-1.5 py-1 flex-shrink-0">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[10px] text-[var(--text-muted)] font-orbitron">{fmtTime(b.createdAt)}</span>
                    {(showEdit || showCancel) && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {showEdit && (
                          <button
                            onClick={() => startEdit(b)}
                            className="text-[10px] font-orbitron px-2.5 py-1 rounded border transition-all"
                            style={{ borderColor: `${color}80`, color }}
                          >
                            SỬA
                          </button>
                        )}
                        {showCancel && (
                          <button
                            onClick={() => onCancel(b)}
                            disabled={cancellingId === b.betId}
                            className="text-[10px] font-orbitron px-2.5 py-1 rounded border border-[var(--crimson-xenon)] text-[var(--crimson-xenon)] hover:bg-[rgba(255,23,68,0.12)] disabled:opacity-40 transition-all"
                          >
                            {cancellingId === b.betId ? '...' : 'HỦY'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: `${color}25`, background: `${color}0f` }}>
        <span className="text-[10px] text-[var(--text-muted)] font-orbitron tracking-widest">TỔNG {symbol}</span>
        <span className="font-orbitron text-base font-black" style={{ color, textShadow: `0 0 8px ${color}80` }}>
          {formatEnergy(total)} <span className="text-xs">chíp</span>
        </span>
      </div>
    </div>
  )
}

export function TwoColumnFeed(props: Props) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  const ctx: EditCtx = {
    editId, editVal, setEditVal,
    startEdit: (bet) => { setEditId(bet.betId); setEditVal(String(bet.amount)) },
    cancelEdit: () => { setEditId(null); setEditVal('') },
    submitEdit: (bet) => {
      const n = parseInt(editVal)
      if (!isNaN(n) && n > 0 && props.onEdit) props.onEdit(bet, n)
      setEditId(null); setEditVal('')
    },
  }

  return (
    <div className="flex gap-2 sm:gap-3">
      <Column {...props} {...ctx} side="T" color="var(--cyan-titan)" />
      <Column {...props} {...ctx} side="X" color="var(--crimson-xenon)" />
    </div>
  )
}
