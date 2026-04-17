import { create } from 'zustand'
import api from '../lib/api'

interface User {
  id: number
  email: string
  fullName: string
  createdAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  setUser: (user: User) => void
  setToken: (token: string) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => void
  checkAuth: () => Promise<void>
}

// Helper to persist token to localStorage
const getStoredToken = () => {
  try {
    const stored = localStorage.getItem('auth-token')
    return stored || null
  } catch {
    return null
  }
}

const setStoredToken = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem('auth-token', token)
    } else {
      localStorage.removeItem('auth-token')
    }
  } catch (e) {
    console.error('Failed to store token:', e)
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getStoredToken(),
  isLoading: false,

  setUser: (user) => set({ user }),
  setToken: (token) => {
    setStoredToken(token)
    set({ token })
  },

  signIn: async (email, password) => {
    set({ isLoading: true })
    try {
      const response = await api.post('/auth/signin', { email, password })
      const { token, user } = response.data
      setStoredToken(token)
      set({ token, user, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  signUp: async (email, password, fullName) => {
    set({ isLoading: true })
    try {
      const response = await api.post('/auth/signup', { email, password, fullName })
      const { token, user } = response.data
      setStoredToken(token)
      set({ token, user, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  signOut: () => {
    setStoredToken(null)
    set({ user: null, token: null })
  },

  checkAuth: async () => {
    const { token } = get()
    if (!token) return

    try {
      const response = await api.get('/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
      set({ user: response.data.user })
    } catch (error) {
      setStoredToken(null)
      set({ user: null, token: null })
    }
  }
}))

