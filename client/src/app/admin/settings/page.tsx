'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '@/lib/api'

export default function SettingsPage() {
  const [brandName, setBrandName] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    api.get('/api/admin/settings')
      .then(({ data }) => setBrandName(data.brandName))
      .catch(() => {})
  }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function save() {
    setLoading(true)
    try {
      const { data } = await api.put('/api/admin/settings', { brandName: brandName.trim() })
      setBrandName(data.brandName)
      flash('Đã lưu tên thương hiệu')
    } catch (err: unknown) {
      flash((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại', false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="font-orbitron text-xl font-bold text-[var(--text-primary)] tracking-wide">CÀI ĐẶT</h2>

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

      <div className="glass-panel p-6 space-y-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5 tracking-widest font-orbitron uppercase">
            Tên thương hiệu (hiện ở header người chơi)
          </label>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            maxLength={40}
            placeholder="VOID PROTOCOL"
            className="w-full bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] transition-colors"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Tối đa 40 ký tự.</p>
        </div>
        <button
          onClick={save}
          disabled={loading || !brandName.trim()}
          className="font-orbitron text-xs px-6 py-2.5 rounded-lg text-black tracking-widest disabled:opacity-40 transition-all"
          style={{ background: 'var(--gold)', boxShadow: '0 0 16px rgba(255,210,74,0.3)' }}
        >
          {loading ? '...' : 'LƯU'}
        </button>
      </div>
    </div>
  )
}
