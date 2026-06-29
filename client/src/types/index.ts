export type Role = 'USER' | 'ADMIN'
export type UserStatus = 'PENDING' | 'ACTIVE'
export type RoundStatus = 'WAITING' | 'OPEN' | 'LOCKED' | 'RESULT'
export type Choice = 'T' | 'X'
export type BetStatus = 'PENDING' | 'WIN' | 'LOSE'

export interface User {
  id: string
  username: string
  phone: string
  energy: string
  role: Role
  status: UserStatus
}

export interface Round {
  id: string
  status: RoundStatus
  paused?: boolean
  coefficient: string
  result: Choice | null
  createdById: string
  createdAt: string
  openedAt: string | null
  lockedAt: string | null
  resultAt: string | null
}

export interface Bet {
  id: string
  userId: string
  roundId: string
  choice: Choice
  amount: string
  status: BetStatus
  payout: string
  createdAt: string
}

export interface BetFeedEntry {
  username: string
  choice: Choice
  amount: string
  createdAt: string
  roundId?: string
}

export interface RoundBet {
  betId: string
  userId: string
  username: string
  choice: Choice
  amount: string
  createdAt: string
  roundId: string
}

export interface AuditLog {
  id: string
  adminId: string
  admin: { username: string }
  action: string
  entityType: string | null
  entityId: string | null
  oldValue: unknown
  newValue: unknown
  ipAddress: string | null
  createdAt: string
}
