// client/src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login(){
  const { login } = useAuth()
  const nav = useNavigate()

  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [err,setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const isValid = () => {
    if (!email.trim()) return false
    if (!password) return false
    return true
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!isValid()) return
    setErr('')
    setLoading(true)
    try{
      // normalize email: trim + lowercase
      await login(email.trim().toLowerCase(), password)
      nav('/')
    }catch(e){
      setErr(e?.response?.data?.error || 'Login failed')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <form onSubmit={onSubmit} className="bg-white p-6 rounded-2xl shadow w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Login</h1>

        {err && <div className="text-red-600 text-sm">{err}</div>}

        <input
          className="w-full border rounded-lg px-3 py-2"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          required
        />

        <div className="relative">
          <input
            className="w-full border rounded-lg px-3 py-2 pr-12"
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={()=>setShowPwd(s=>!s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-600"
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? 'Hide' : 'Show'}
          </button>
        </div>

        <button
          className="w-full bg-brand-600 text-white rounded-lg py-2 disabled:opacity-60"
          disabled={!isValid() || loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>No account? <Link to="/register" className="text-brand-600">Register</Link></p>
          <span className="opacity-50">Forgot password?</span>
        </div>
      </form>
    </div>
  )
}