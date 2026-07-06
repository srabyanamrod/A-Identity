import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type User = {
  name: string
  email: string
}

type AuthState = {
  user: User | null
  /**
   * Mock sign-in. No backend yet, so any credentials succeed. Replaced later by
   * real agent-identity auth (Phase: KYA / ERC-8004).
   */
  login: (email: string, name?: string) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (email, name) =>
        set({ user: { email, name: name?.trim() || email.split('@')[0] } }),
      logout: () => set({ user: null }),
    }),
    { name: 'a-identity-auth' },
  ),
)
