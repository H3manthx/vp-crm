// client/src/components/CorporateRemindersBar.jsx
import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Check } from 'lucide-react'

function rel(ts) {
  const diff = new Date(ts).getTime() - Date.now()
  const day = 86_400_000, hour = 3_600_000
  if (diff < -day)  return `${Math.ceil(Math.abs(diff)/day)}d overdue`
  if (diff < -hour) return `${Math.ceil(Math.abs(diff)/hour)}h overdue`
  if (diff < 0)     return 'due now'
  if (diff < hour)  return `in ${Math.ceil(diff/hour)}h`
  return `in ${Math.ceil(diff/day)}d`
}

export default function CorporateRemindersBar() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/corporate/reminders', { params: { window_days: 14, due_only: 0 } })
      setRows(Array.isArray(r.data) ? r.data : [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  const ack = async (reminder_id) => {
    const prev = rows
    setRows(s => s.filter(x => x.reminder_id !== reminder_id)) // optimistic
    try { await api.post('/corporate/reminders/ack', { reminder_id }) }
    catch (e) { setRows(prev); alert(e?.response?.data?.error || 'Failed to acknowledge') }
  }

  if (!loading && rows.length === 0) return null

  return (
    <div className="w-full">
      {/* centered, single-line pill rail */}
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center gap-2 h-9 px-2 overflow-x-auto whitespace-nowrap">
          {rows.map(r => (
            <span
              key={r.reminder_id}
              className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-gray-200 px-3 py-1 shadow-sm"
              title={new Date(r.remind_at).toLocaleString()}
            >
              <span className="text-xs font-medium text-gray-900">
                {r.name || `Lead #${r.corporate_lead_id}`}
              </span>
              <span className="text-[11px] text-gray-500">
                • {r.reminder_type === 'lead_checkin' ? 'cords check in' : 'follow-up'} • {rel(r.remind_at)}
              </span>
              <button
                onClick={() => ack(r.reminder_id)}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                aria-label="Mark reminder done"
              >
                <Check size={12} /> Done
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
