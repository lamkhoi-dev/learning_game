'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Choice } from '@/types'
import { formatEnergy } from '@/lib/utils'

interface Props {
  roundId: string
  choice: Choice | null
  userEnergy: string
  disabled: boolean
  onBet: (amount: string) => Promise<void>
}

const QUICK_AMOUNTS = [2, 5, 10, 20, 50, 100]

export function BetPanel({ roundId: _roundId, choice, userEnergy, disabled, onBet }: Props) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [flash, setFlash] = useState<'success' | 'error' | null>(null)
  const [flashMsg, setFlashMsg] = useState('')

  const maxEnergy = Number(userEnergy)
  const betAmount = parseInt(amount)
  const isValid = !isNaN(betAmount) && betAmount > 0 && betAmount <= maxEnergy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !choice || disabled) return
    setLoading(true)
    try {
      await onBet(amount)
      setFlash('success')
      setFlashMsg('ĐÃ ĐẶT CƯỢC!')
      setAmount('')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Đặt cược thất bại'
      setFlash('error')
      setFlashMsg(msg)
    } finally {
      setLoading(false)
      setTimeout(() => setFlash(null), 2500)
    }
  }

  function setMax() { setAmount(userEnergy) }

  const choiceColor = choice === 'X' ? 'var(--crimson-xenon)' : choice === 'T' ? 'var(--cyan-titan)' : 'var(--gold)'
  const sym = choice === 'T' ? '₮' : choice === 'X' ? 'Ӿ' : ''
  const prefix = sym ? `${sym} ` : ''

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Quick amounts */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {QUICK_AMOUNTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled || q > maxEnergy}
            onClick={() => setAmount(q.toString())}
            className="px-2 py-2 rounded-lg text-xs font-orbitron border disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{
              borderColor: choice ? `${choiceColor}` : 'var(--glass-border)',
              color: choice ? choiceColor : 'var(--text-muted)',
            }}
          >
            {prefix}{formatEnergy(q)}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={setMax}
          className="px-2 py-2 rounded-lg text-xs font-orbitron font-bold border border-[var(--gold-dim)] text-[var(--gold)] hover:bg-[rgba(255,210,74,0.1)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          MAX
        </button>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center bg-[rgba(255,255,255,0.05)] border rounded-lg overflow-hidden focus-within:border-[var(--gold)] transition-colors"
          style={{ borderColor: choice ? `${choiceColor}66` : 'var(--glass-border)' }}
        >
          {sym && (
            <span className="pl-3 font-orbitron text-lg font-black select-none" style={{ color: choiceColor }}>{sym}</span>
          )}
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={choice ? 'Nhập số chíp...' : 'Chọn ₮ hoặc Ӿ trước...'}
            min={1}
            max={maxEnergy}
            disabled={disabled}
            className="flex-1 bg-transparent px-3 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={!isValid || !choice || disabled || loading}
          className="px-6 py-3 rounded-lg font-orbitron text-xs font-bold tracking-widest text-black disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={{
            background: isValid && choice && !disabled ? choiceColor : '#333',
            boxShadow: isValid && choice && !disabled ? `0 0 16px ${choiceColor}55` : 'none',
          }}
        >
          {loading ? '...' : 'ĐẶT CƯỢC'}
        </button>
      </div>

      {/* Flash message */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-orbitron text-center py-2 px-3 rounded-lg"
            style={{
              color: flash === 'success' ? 'var(--gold)' : 'var(--crimson-xenon)',
              background: flash === 'success' ? 'rgba(255,210,74,0.08)' : 'rgba(255,23,68,0.08)',
              border: `1px solid ${flash === 'success' ? 'rgba(255,210,74,0.25)' : 'rgba(255,23,68,0.2)'}`,
            }}
          >
            {flashMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}
