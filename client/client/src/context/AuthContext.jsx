import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import api from '../lib/api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false) // <-- NEW
  const logoutTimer = useRef(null)

  const clearLogoutTimer = () => {
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current)
      logoutTimer.current = null
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user_name')
    clearLogoutTimer()
    setUser(null)
  }

  const scheduleLogout = (exp) => {
    const delay = exp * 1000 - Date.now()
    if (delay <= 0) {
      logout()
    } else {
      logoutTimer.current = setTimeout(logout, delay)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const payload = jwtDecode(token)
        if (payload.exp && payload.exp < Date.now() / 1000) {
          logout()
        } else {
          const name = localStorage.getItem('user_name') || null
          setUser({ id: payload.user_id, role: payload.role, store_id: payload.store_id, name })
          if (payload.exp) scheduleLogout(payload.exp)
        }
      } catch {
        logout()
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
    if (p.exp) scheduleLogout(p.exp)
  }

  const register = async (payload) => { await api.post('/auth/register', payload) }

  const value = useMemo(() => ({ user, hydrated, login, register, logout }), [user, hydrated])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}