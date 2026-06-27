import { create } from 'zustand'
import { User } from '@/types'

interface AuthState {
  accessToken: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
  updateEnergy: (energy: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
  updateEnergy: (energy) =>
    set((state) => ({
      user: state.user ? { ...state.user, energy } : null,
    })),
}))
