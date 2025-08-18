// client/src/pages/Register.jsx
import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

export default function Register(){
  const { register } = useAuth()
  const nav = useNavigate()

  const [form,setForm] = useState({
    name:'', email:'', password:'', confirm:'', store_id:''
  })
  const [err,setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const [stores, setStores] = useState([])
  const [storesLoading, setStoresLoading] = useState(true)
  const [storesErr, setStoresErr] = useState('')

  useEffect(() => {
    let mounted = true
    setStoresLoading(true)
    setStoresErr('')
    api.get('/stores') // expects: [{store_id, name}, ...]
      .then(r => { if (mounted) setStores(r.data || []) })
      .catch(() => { if (mounted) setStoresErr('Failed to load stores') })
      .finally(() => { if (mounted) setStoresLoading(false) })
    return () => { mounted = false }
  }, [])

  const pwdOk = useMemo(() => form.password.length >= 8, [form.password])
  const confirmOk = useMemo(() => !!form.password && form.password === form.confirm, [form.password, form.confirm])

  const isValid = () => {
    if (!form.name.trim()) return false
    if (!form.email.trim()) return false
    if (!pwdOk || !confirmOk) return false
    return true
  }

  const onSubmit = async (e)=>{
    e.preventDefault()
    if (!isValid()) return
    setErr('')
    setLoading(true)
    try{
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password, // server hashes
        store_id: form.store_id ? Number(form.store_id) : null
      }
      await register(payload)
      nav('/login')
    }catch(e){
      setErr(e?.response?.data?.error || 'Register failed')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <form onSubmit={onSubmit} className="bg-white p-6 rounded-2xl shadow w-full max-w-md space-y-4 text-left">
        <h1 className="text-2xl font-semibold">Register</h1>

        {err && <div className="text-red-600 text-sm">{err}</div>}

        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Full name"
          value={form.name}
          onChange={e=>setForm(f=>({...f,name:e.target.value}))}
          required
        />

        <input
          className="w-full border rounded-lg px-3 py-2"
          type="email"
          placeholder="Work email"
          value={form.email}
          onChange={e=>setForm(f=>({...f,email:e.target.value}))}
          required
        />

        <div className="space-y-2">
          <input
            className="w-full border rounded-lg px-3 py-2"
            type="password"
            placeholder="Password (min 8 chars)"
            value={form.password}
            onChange={e=>setForm(f=>({...f,password:e.target.value}))}
            required
          />
          <input
            className="w-full border rounded-lg px-3 py-2"
            type="password"
            placeholder="Confirm password"
            value={form.confirm}
            onChange={e=>setForm(f=>({...f,confirm:e.target.value}))}
            required
          />
          <div className="text-xs">
            <span className={pwdOk ? 'text-green-600' : 'text-gray-500'}>
              • At least 8 characters
            </span>
            <br />
            <span className={confirmOk ? 'text-green-600' : 'text-gray-500'}>
              • Passwords match
            </span>
          </div>
        </div>

        {/* Store selector (optional) */}
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Store (optional)</label>
          <select
            className="w-full border rounded-lg px-3 py-2 bg-white"
            value={form.store_id}
            onChange={e=>setForm(f=>({...f,store_id:e.target.value}))}
            disabled={storesLoading}
          >
            <option value="">
              {storesLoading ? 'Loading stores…' : (storesErr || 'Select a store (or leave blank)')}
            </option>
            {stores.map(s => (
              <option key={s.store_id} value={s.store_id}>{s.name}</option>
            ))}
          </select>
        </div>

        <button
          className="w-full bg-brand-600 text-white rounded-lg py-2 disabled:opacity-60"
          disabled={!isValid() || loading}
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-sm text-gray-600">
          Already have an account? <Link to="/login" className="text-brand-600">Login</Link>
        </p>
      </form>
    </div>
  )
}