import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import api from '../lib/api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false) // <-- NEW

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const payload = jwtDecode(token)
        const name = localStorage.getItem('user_name') || null
        setUser({ id: payload.user_id, role: payload.role, store_id: payload.store_id, name })
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user_name')
      }
    }
    setHydrated(true) // <-- initial check finished
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    if (data?.user?.name) localStorage.setItem('user_name', data.user.name)
    const p = jwtDecode(data.token)
    setUser({ id: p.user_id, role: p.role, store_id: p.store_id, name: data?.user?.name || null })
  }

  const register = async (payload) => { await api.post('/auth/register', payload) }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user_name')
    setUser(null)
  }

  const value = useMemo(() => ({ user, hydrated, login, register, logout }), [user, hydrated])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}