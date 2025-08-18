// src/components/StatusModal.jsx
import { useState } from 'react'
import Modal from './Modal'
import api from '../lib/api'

export default function StatusModal({ open, onClose, lead, onSaved }) {
  const [status, setStatus] = useState('In Progress')
  const [notes, setNotes] = useState('')
  const [value, setValue] = useState('')

  const showValue = status === 'Closed Won'

  async function save() {
    try {
      await api.post('/retail/leads/status', {
        lead_id: lead.lead_id,
        status,
        notes: notes || null,
        value_closed: showValue ? Number(value || 0) : undefined,
      })
      onSaved?.()
      onClose?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to update status')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Update status" z={60}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">New status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option>In Progress</option>
            <option>Closed Won</option>
            <option>Closed Lost</option>
          </select>
        </div>

        {showValue && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Value (₹)</label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Enter deal value"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
          <textarea
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Add a short note…"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancel</button>
          <button onClick={save} className="px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
        </div>
      </div>
    </Modal>
  )
}