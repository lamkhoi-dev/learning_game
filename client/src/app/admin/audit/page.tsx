'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { AuditLog } from '@/types'

const ACTION_COLORS: Record<string, string> = {
  ROUND_CREATED: '#00f5ff',
  ROUND_OPENED: '#69ff47',
  ROUND_LOCKED: '#ff6d00',
  ROUND_RESULT_SET: '#ffd600',
  ROUND_COEFFICIENT_SET: '#00f5ff',
  USER_APPROVED: '#69ff47',
  USER_REJECTED: '#ff1744',
  USER_DELETED: '#ff1744',
  USER_ENERGY_SET: '#b388ff',
  USER_ROLE_PROMOTED: '#ff80ab',
  USER_ROLE_DEMOTED: '#90a4ae',
  BET_CANCELLED_BY_ADMIN: '#ff6d00',
  BET_EDITED_BY_ADMIN: '#b388ff',
  SETTINGS_UPDATED: '#ffd24a',
}

const ACTION_LABELS: Record<string, string> = {
  ROUND_CREATED: 'Tạo phiên',
  ROUND_OPENED: 'Mở phiên',
  ROUND_LOCKED: 'Khóa phiên',
  ROUND_RESULT_SET: 'Ra kết quả',
  ROUND_COEFFICIENT_SET: 'Chỉnh hệ số',
  USER_APPROVED: 'Duyệt người dùng',
  USER_REJECTED: 'Từ chối người dùng',
  USER_DELETED: 'Xóa người dùng',
  USER_ENERGY_SET: 'Sửa chíp',
  USER_ROLE_PROMOTED: 'Lên admin',
  USER_ROLE_DEMOTED: 'Hạ xuống thường',
  BET_CANCELLED_BY_ADMIN: 'Admin hủy lệnh',
  BET_EDITED_BY_ADMIN: 'Admin sửa lệnh',
  SETTINGS_UPDATED: 'Đổi cài đặt',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const LIMIT = 30

  useEffect(() => {
    api.get('/api/admin/audit', { params: { page, limit: LIMIT } })
      .then(({ data }) => { setLogs(data.logs); setTotal(data.total) })
      .catch(() => {})
  }, [page])

  const totalPages = Math.ceil(total / LIMIT)

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
  }

  return (
    <div className="space-y-4">
      <h2 className="font-orbitron text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-wide">
        NHẬT KÝ HOẠT ĐỘNG <span className="text-[var(--text-muted)] text-sm">({total})</span>
      </h2>

      <div className="glass-panel overflow-hidden divide-y divide-[var(--glass-border)]">
        {logs.map((log) => {
          const hasDetail = log.oldValue !== null || log.newValue !== null
          const color = ACTION_COLORS[log.action] ?? 'var(--text-muted)'
          return (
            <div key={log.id}>
              <button
                onClick={() => hasDetail && setExpanded(expanded === log.id ? null : log.id)}
                className="w-full text-left px-4 py-3 flex flex-col gap-1.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className="font-orbitron text-xs px-2 py-0.5 rounded"
                    style={{ color, background: `${color}18` }}
                  >
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] font-orbitron">{fmt(log.createdAt)}</span>
                </div>
                <div className="flex items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] flex-wrap">
                  <span>👤 <span className="text-[var(--text-primary)]">{log.admin?.username}</span></span>
                  {log.entityType && <span>{log.entityType} #{log.entityId?.slice(-6).toUpperCase()}</span>}
                  {log.ipAddress && <span>IP {log.ipAddress}</span>}
                  {hasDetail && <span className="neon-text-gold ml-auto">{expanded === log.id ? '▲ thu gọn' : '▼ chi tiết'}</span>}
                </div>
              </button>
              {expanded === log.id && hasDetail && (
                <div className="px-4 pb-3 bg-[rgba(255,210,74,0.02)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono pt-2">
                    {log.oldValue !== null && (
                      <div>
                        <div className="text-[var(--text-muted)] mb-1 tracking-wider">GIÁ TRỊ CŨ</div>
                        <pre className="text-[var(--text-primary)] whitespace-pre-wrap break-all">{JSON.stringify(log.oldValue, null, 2)}</pre>
                      </div>
                    )}
                    {log.newValue !== null && (
                      <div>
                        <div className="text-[var(--gold)] mb-1 tracking-wider">GIÁ TRỊ MỚI</div>
                        <pre className="text-[var(--text-primary)] whitespace-pre-wrap break-all">{JSON.stringify(log.newValue, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {logs.length === 0 && (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">Chưa có nhật ký</div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-3">
            <button
              disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="font-orbitron text-xs px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] disabled:opacity-30 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >←</button>
            <span className="font-orbitron text-xs text-[var(--text-muted)]">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="font-orbitron text-xs px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-muted)] disabled:opacity-30 hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >→</button>
          </div>
        )}
      </div>
    </div>
  )
}
