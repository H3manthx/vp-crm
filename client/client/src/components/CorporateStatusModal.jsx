// client/src/components/CorporateStatusModal.jsx
import { useEffect, useState } from 'react'
import Modal from './Modal'
import api from '../lib/api'
import { formatDateTime } from '../utils/dates'

export default function CorporateStatusModal({
  open,
  onClose,
  lead,                // { corporate_lead_id, status, last_quoted_value, last_quoted_at, ... }
  onSaved,             // callback after a successful save
  onProposalUploaded,  // optional: parent can refresh proposals list
}) {
  // status section
  const [status, setStatus] = useState('Discovery')
  const [notes, setNotes] = useState('')
  const [valueWon, setValueWon] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  // quotation section
  const [qAmount, setQAmount] = useState('')
  const [qNotes,  setQNotes]  = useState('')
  const [savingQuote, setSavingQuote] = useState(false)

  // proposal upload (visible when status === "Proposal Sent")
  const [pdfFile, setPdfFile] = useState(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)

  useEffect(() => {
    if (open && lead) {
      setStatus(lead.status || 'Discovery')
      setNotes('')
      setValueWon('')
      setQAmount('')
      setQNotes('')
      setPdfFile(null)
    }
  }, [open, lead])

  // --- STATUS actions --------------------------------------------------------
  async function saveStatus() {
    if (!lead?.corporate_lead_id) return
    try {
      setSavingStatus(true)

      if (status === 'Closed Won' || status === 'Closed Lost') {
        await api.post('/corporate/leads/close', {
          corporate_lead_id: lead.corporate_lead_id,
          status,
          notes: notes || null,
          value_closed: status === 'Closed Won' && valueWon !== '' ? Number(valueWon) : undefined,
        })
      } else {
        await api.put('/corporate/leads', {
          corporate_lead_id: lead.corporate_lead_id,
          status,
          notes: notes || null,
        })
      }

      onSaved?.()
      onClose?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to update status')
    } finally {
      setSavingStatus(false)
    }
  }

  // --- QUOTE actions ---------------------------------------------------------
  async function addQuote() {
    if (!lead?.corporate_lead_id) return
    if (qAmount === '' || Number.isNaN(Number(qAmount))) {
      return alert('Please enter a valid quotation amount.')
    }

    try {
      setSavingQuote(true)
      await api.post('/corporate/leads/quotes', {
        corporate_lead_id: lead.corporate_lead_id,
        amount: Number(qAmount),
        notes: qNotes || null,
      })
      onSaved?.()    // refresh parent so last_quoted_* reflects the new quote
      setQAmount('')
      setQNotes('')
      alert('Quotation added.')
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to add quotation')
    } finally {
      setSavingQuote(false)
    }
  }

  // --- PROPOSAL upload (only for "Proposal Sent") ----------------------------
  async function uploadProposalPdf() {
    if (!lead?.corporate_lead_id) return
    if (!pdfFile) return alert('Please choose a PDF first.')
    if (pdfFile.type !== 'application/pdf') return alert('Only PDF files are allowed.')

    try {
      setUploadingPdf(true)
      const form = new FormData()
      form.append('corporate_lead_id', String(lead.corporate_lead_id))
      form.append('file', pdfFile)
      await api.post('/corporate/leads/proposals/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      alert('Proposal uploaded.')
      setPdfFile(null)
      onProposalUploaded?.()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to upload proposal')
    } finally {
      setUploadingPdf(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Update status / quotation" z={60} maxW="max-w-lg">
      <div className="space-y-6 text-sm">

        {/* STATUS BLOCK (fields only) */}
        <section className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">New status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option>Discovery</option>
              <option>Proposal Sent</option>
              <option>Negotiation</option>
              <option>Closed Won</option>
              <option>Closed Lost</option>
            </select>
          </div>

          {status === 'Closed Won' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Deal value (₹)</label>
              <input
                type="number"
                min="0"
                value={valueWon}
                onChange={(e) => setValueWon(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Enter final value"
              />
            </div>
          )}

          {status === 'Proposal Sent' && (
            <div className="space-y-2">
              <label className="block text-xs text-gray-600">Attach proposal (PDF)</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="flex-1 rounded-lg border px-3 py-2 bg-white"
                />
                <button
                  type="button"
                  onClick={uploadProposalPdf}
                  disabled={uploadingPdf || !pdfFile}
                  className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {uploadingPdf ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-600 mb-1">Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Add a short note…"
            />
          </div>
        </section>

        <div className="h-px bg-gray-100" />

        {/* QUOTATION BLOCK — now above the Save Status button */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Quotation</h4>
            {lead?.last_quoted_value != null && (
              <div className="text-[11px] text-gray-500">
                Last: ₹{Number(lead.last_quoted_value).toLocaleString('en-IN')}
                {lead?.last_quoted_at ? ` • ${formatDateTime(lead.last_quoted_at)}` : ''}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={qAmount}
                onChange={(e) => setQAmount(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Enter quotation amount"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Notes (optional)</label>
              <input
                value={qNotes}
                onChange={(e) => setQNotes(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. revision 2 / terms"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={addQuote}
              disabled={savingQuote}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingQuote ? 'Saving…' : 'Add quotation'}
            </button>
          </div>
        </section>

        {/* Primary action at the very end */}
        <button
          disabled={savingStatus}
          onClick={saveStatus}
          className="w-full px-5 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {savingStatus ? 'Saving…' : 'Save status'}
        </button>
      </div>
    </Modal>
  )
}