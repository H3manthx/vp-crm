import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import Modal from './Modal'

export default function TransferLeadModal({ open, onClose, leadId, currentAssignee, onDone }) {
  const [people, setPeople] = useState([])
  const [toId, setToId] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const r = await api.get('/employees') // managers only; your route already exists
        setPeople(r.data || [])
      } catch {}
    })()
  }, [open])

  const options = useMemo(() => {
    return (people || [])
      .filter(p => p.employee_id !== currentAssignee) // don’t show current assignee
      .map(p => ({ value: p.employee_id, label: p.name || p.email }))
  }, [people, currentAssignee])

  async function submit() {
    if (!toId) return alert('Pick a new assignee')
    try {
      await api.post('/retail/leads/assign', {
        lead_id: Number(leadId),
        assigned_to: Number(toId),
        transfer_reason: reason || null,   // <<--- send reason
      })
      onDone?.()
      onClose?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Transfer failed')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Transfer lead" z={70} maxW="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">New owner</label>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">Select teammate…</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Why are you transferring this lead?"
          />
          <p className="mt-1 text-xs text-gray-500">
            The reason will be saved in the lead’s history and transfer log.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg border hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="w-full px-4 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Transfer
          </button>
        </div>
      </div>
    </Modal>
  )
}
