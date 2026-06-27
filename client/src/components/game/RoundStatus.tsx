import { RoundStatus as RS } from '@/types'

const statusConfig: Record<RS, { label: string; color: string; bg: string }> = {
  WAITING: { label: 'CHỜ MỞ',  color: '#ffd600', bg: 'rgba(255,214,0,0.1)' },
  OPEN:    { label: 'ĐANG ĐẶT CƯỢC', color: '#00f5ff', bg: 'rgba(0,245,255,0.1)' },
  LOCKED:  { label: 'ĐÃ KHÓA', color: '#ff6d00', bg: 'rgba(255,109,0,0.1)' },
  RESULT:  { label: 'KẾT QUẢ', color: '#69ff47', bg: 'rgba(105,255,71,0.1)' },
}

interface Props {
  status: RS
  coefficient?: string
}

export function RoundStatusBadge({ status, coefficient }: Props) {
  const cfg = statusConfig[status]
  return (
    <div className="flex items-center gap-3">
      <span
        className="font-orbitron text-xs font-semibold px-3 py-1 rounded-full tracking-widest"
        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
      >
        {cfg.label}
      </span>
      {coefficient && (
        <span className="font-orbitron text-xs text-[var(--text-muted)]">
          HỆ SỐ: <span className="text-[var(--gold)]">×{coefficient}</span>
        </span>
      )}
    </div>
  )
}
