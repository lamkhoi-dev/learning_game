'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '@/lib/api'
import { formatEnergy } from '@/lib/utils'

interface Bot {
  id: string
  username: string
  energy: string
  botSide: string | null
  botMin: number
  botMax: number
  botAuto: boolean
  botChat: boolean
}

export default function VirtualPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // form tạo bot
  const [count, setCount] = useState('10')
  const [energy, setEnergy] = useState('1000000')

  // form rải cược
  const [sCount, setSCount] = useState('10')
  const [sRatioT, setSRatioT] = useState('50')
  const [sMin, setSMin] = useState('100')
  const [sMax, setSMax] = useState('2000')
  const [sSpread, setSSpread] = useState('10')

  function flash(text: string, ok = true) {
    setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000)
  }
  function errMsg(err: unknown) {
    return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Thất bại'
  }

  async function fetchBots() {
    try { const { data } = await api.get('/api/admin/virtual'); setBots(data) } catch { /* */ }
  }
  useEffect(() => { fetchBots() }, [])

  async function createBots() {
    setLoading(true)
    try {
      const { data } = await api.post('/api/admin/virtual', { count: parseInt(count) || 1, energy: parseInt(energy) || 0 })
      flash(`Đã tạo ${data.created} bot`)
      fetchBots()
    } catch (err) { flash(errMsg(err), false) } finally { setLoading(false) }
  }

  async function saveBot(b: Bot) {
    try {
      await api.put(`/api/admin/virtual/${b.id}`, {
        side: b.botSide ?? 'RANDOM', min: b.botMin, max: b.botMax, auto: b.botAuto, chat: b.botChat,
      })
      flash(`Đã lưu ${b.username}`)
    } catch (err) { flash(errMsg(err), false) }
  }

  async function delBot(id: string, name: string) {
    if (!confirm(`Xóa bot ${name}?`)) return
    try { await api.delete(`/api/admin/virtual/${id}`); setBots((p) => p.filter((x) => x.id !== id)) }
    catch (err) { flash(errMsg(err), false) }
  }

  async function scatter() {
    setLoading(true)
    try {
      const { data } = await api.post('/api/admin/virtual/scatter', {
        count: parseInt(sCount) || 1,
        ratioT: parseFloat(sRatioT) || 0,
        min: parseInt(sMin) || 1,
        max: parseInt(sMax) || 1,
        spreadSeconds: parseInt(sSpread) || 0,
      })
      flash(`Đang rải ${data.scheduled} lệnh vào phiên`)
      setTimeout(fetchBots, 1500)
    } catch (err) { flash(errMsg(err), false) } finally { setLoading(false) }
  }

  function patch(id: string, p: Partial<Bot>) {
    setBots((prev) => prev.map((b) => b.id === id ? { ...b, ...p } : b))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="font-orbitron text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-wide">
        NGƯỜI CHƠI ẢO <span className="text-[var(--text-muted)] text-sm">({bots.length})</span>
      </h2>

      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="font-orbitron text-xs px-4 py-3 rounded-lg"
            style={{
              color: msg.ok ? 'var(--gold)' : 'var(--crimson-xenon)',
              background: msg.ok ? 'rgba(255,210,74,0.08)' : 'rgba(255,23,68,0.08)',
              border: `1px solid ${msg.ok ? 'rgba(255,210,74,0.25)' : 'rgba(255,23,68,0.2)'}`,
            }}>{msg.text}</motion.div>
        )}
      </AnimatePresence>

      {/* Tạo bot + Rải cược */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-panel p-5 space-y-3">
          <p className="font-orbitron text-xs text-[var(--text-muted)] tracking-widest">TẠO BOT</p>
          <div className="flex gap-2">
            <input type="number" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Số lượng"
              className="w-24 bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]" />
            <input type="number" value={energy} onChange={(e) => setEnergy(e.target.value)} placeholder="Chíp khởi tạo"
              className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]" />
          </div>
          <button onClick={createBots} disabled={loading}
            className="font-orbitron text-xs px-5 py-2 rounded-lg bg-[var(--gold)] text-black tracking-widest disabled:opacity-40">
            {loading ? '...' : '+ TẠO'}
          </button>
        </div>

        <div className="glass-panel p-5 space-y-3">
          <p className="font-orbitron text-xs text-[var(--text-muted)] tracking-widest">RẢI CƯỢC NGAY (phiên đang mở)</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1">Số bot
              <input type="number" value={sCount} onChange={(e) => setSCount(e.target.value)}
                className="bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]" /></label>
            <label className="flex flex-col gap-1">% vào ₮
              <input type="number" value={sRatioT} onChange={(e) => setSRatioT(e.target.value)}
                className="bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]" /></label>
            <label className="flex flex-col gap-1">Chíp min
              <input type="number" value={sMin} onChange={(e) => setSMin(e.target.value)}
                className="bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]" /></label>
            <label className="flex flex-col gap-1">Chíp max
              <input type="number" value={sMax} onChange={(e) => setSMax(e.target.value)}
                className="bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]" /></label>
            <label className="flex flex-col gap-1 col-span-2">Rải trong (giây)
              <input type="number" value={sSpread} onChange={(e) => setSSpread(e.target.value)}
                className="bg-[rgba(255,255,255,0.05)] border border-[var(--glass-border)] rounded px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]" /></label>
          </div>
          <button onClick={scatter} disabled={loading}
            className="font-orbitron text-xs px-5 py-2 rounded-lg tracking-widest disabled:opacity-40"
            style={{ background: 'var(--cyan-titan)', color: '#000' }}>
            {loading ? '...' : '🎲 RẢI CƯỢC'}
          </button>
        </div>
      </div>

      {/* Danh sách bot */}
      <div className="glass-panel overflow-hidden divide-y divide-[var(--glass-border)]">
        {bots.length === 0 && <div className="text-center py-8 text-[var(--text-muted)] text-sm">Chưa có bot nào</div>}
        {bots.map((b) => (
          <div key={b.id} className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="font-orbitron text-sm text-[var(--text-primary)] truncate">{b.username}</div>
              <div className="text-[10px] text-[var(--text-muted)]">💰 {formatEnergy(b.energy)}</div>
            </div>
            <select value={b.botSide ?? 'RANDOM'} onChange={(e) => patch(b.id, { botSide: e.target.value })}
              className="bg-[rgba(255,255,255,0.06)] border border-[var(--glass-border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none">
              <option value="RANDOM">Ngẫu nhiên</option>
              <option value="T">₮</option>
              <option value="X">Ӿ</option>
            </select>
            <input type="number" value={b.botMin} onChange={(e) => patch(b.id, { botMin: parseInt(e.target.value) || 0 })}
              className="w-20 bg-[rgba(255,255,255,0.06)] border border-[var(--glass-border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none" placeholder="min" />
            <input type="number" value={b.botMax} onChange={(e) => patch(b.id, { botMax: parseInt(e.target.value) || 0 })}
              className="w-20 bg-[rgba(255,255,255,0.06)] border border-[var(--glass-border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none" placeholder="max" />
            <button onClick={() => patch(b.id, { botAuto: !b.botAuto })}
              className="text-[10px] font-orbitron px-2 py-1 rounded border transition-all"
              style={b.botAuto ? { background: '#22c55e', color: '#000', borderColor: '#22c55e' } : { borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
              TỰ ĐỘNG
            </button>
            <button onClick={() => patch(b.id, { botChat: !b.botChat })}
              className="text-[10px] font-orbitron px-2 py-1 rounded border transition-all"
              style={b.botChat ? { background: 'var(--gold)', color: '#000', borderColor: 'var(--gold)' } : { borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
              CHAT
            </button>
            <button onClick={() => saveBot(b)} className="text-[10px] font-orbitron px-2 py-1 rounded bg-[var(--gold)] text-black">LƯU</button>
            <button onClick={() => delBot(b.id, b.username)} className="text-[10px] font-orbitron px-2 py-1 rounded border border-[var(--crimson-xenon)] text-[var(--crimson-xenon)]">XÓA</button>
          </div>
        ))}
      </div>
    </div>
  )
}
