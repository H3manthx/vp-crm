// client/src/components/CorporateCreateLead.jsx
import { useState } from 'react'
import api from '../lib/api'
import {
  Building2,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  Package,
  List,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react'

export default function CorporateCreateLead({ onCreated }) {
  // --- lead fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [enquiryDate, setEnquiryDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )

  // --- items (Bill of Material)
  const [items, setItems] = useState([
    { bill_of_material: '', quantity: 1, requirements: '' },
  ])

  // --- optional initial quotation
  const [quoteAmt, setQuoteAmt] = useState('')
  const [quoteNote, setQuoteNote] = useState('')

  const addItem = () =>
    setItems((s) => [
      ...s,
      { bill_of_material: '', quantity: 1, requirements: '' },
    ])

  const removeItem = (idx) =>
    setItems((s) => s.filter((_, i) => i !== idx))

  const updateItem = (idx, patch) =>
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const stepQty = (idx, delta) =>
    setItems((s) =>
      s.map((it, i) =>
        i === idx
          ? { ...it, quantity: Math.max(1, Number(it.quantity || 1) + delta) }
          : it
      )
    )

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return alert('Please enter customer name')
    if (!phone.trim()) return alert('Please enter contact number')

    try {
      // 1) create lead
      const leadRes = await api.post('/corporate/leads', {
        name: name.trim(),
        contact_number: phone.trim(),
        email: email.trim() || null,
        enquiry_date: enquiryDate, // server may ignore, safe to send
        status: 'New',
      })

      const newId = leadRes.data?.corporate_lead_id
      if (!newId) {
        alert('Lead created but no id returned — ensure your /corporate/leads POST returns corporate_lead_id')
        return
      }

      // 2) create items (only with a bill_of_material)
      const cleanItems = items.filter((i) => (i.bill_of_material || '').trim())
      for (const it of cleanItems) {
        await api.post('/corporate/leads/items', {
          corporate_lead_id: newId,
          bill_of_material: it.bill_of_material.trim(),
          quantity: Number(it.quantity || 1),
          requirements: it.requirements?.trim() || null,
        })
      }

      // 3) optional initial quotation
      if (quoteAmt !== '' && !Number.isNaN(Number(quoteAmt))) {
        await api.post('/corporate/leads/quotes', {
          corporate_lead_id: newId,
          amount: Number(quoteAmt),
          notes: quoteNote || null,
        })
      }

      alert('Corporate lead created.')
      onCreated?.()

      // reset
      setName('')
      setPhone('')
      setEmail('')
      setEnquiryDate(new Date().toISOString().slice(0, 10))
      setItems([{ bill_of_material: '', quantity: 1, requirements: '' }])
      setQuoteAmt('')
      setQuoteNote('')
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to create lead')
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <header className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-xs font-medium text-gray-600">Corporate</span>
        </div>

        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">
          Create lead
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-500">
          Capture company details and Bill of Material.
        </p>

        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Customer section */}
        <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              icon={<Building2 size={16} />}
              placeholder="Company / contact name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              icon={<Phone size={16} />}
              placeholder="Contact number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              icon={<Mail size={16} />}
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div>
              <label className="block text-sm text-gray-600 mb-1">Enquiry date</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <CalendarIcon size={16} />
                </div>
                <input
                  type="date"
                  className="pretty-date w-full rounded-xl border px-10 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
                  value={enquiryDate}
                  onChange={(e) => setEnquiryDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Items section */}
        <section className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Bill of Material</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-xl border p-4 bg-white/60">
                {/* Row: BOM + Qty (aligned heights) */}
                <div className="grid md:grid-cols-[1fr,150px] gap-3">
                  <Input
                    icon={<Package size={16} />}
                    placeholder="Bill of Material"
                    value={it.bill_of_material}
                    onChange={(e) =>
                      updateItem(idx, { bill_of_material: e.target.value })
                    }
                  />

                  {/* Qty stepper (no separate label; height matches inputs) */}
                  <div className="flex flex-col">
                    <span className="sr-only">Quantity</span>
                    <div className="h-[46px] flex items-center rounded-lg border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => stepQty(idx, -1)}
                        className="w-10 h-full grid place-items-center hover:bg-gray-50"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) =>
                          updateItem(idx, { quantity: Number(e.target.value || 1) })
                        }
                        className="no-spin appearance-none w-full text-center outline-none border-0 focus:ring-0 bg-white"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        onClick={() => stepQty(idx, 1)}
                        className="w-10 h-full grid place-items-center hover:bg-gray-50"
                        aria-label="Increase quantity"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="mt-3">
                  <Input
                    icon={<List size={16} />}
                    placeholder="Requirements (optional)"
                    value={it.requirements}
                    onChange={(e) => updateItem(idx, { requirements: e.target.value })}
                  />
                </div>

                {items.length > 1 && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 text-gray-700"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Initial quotation (optional) */}
        <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-lg">Initial quotation (optional)</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              type="number"
              min="0"
              placeholder="Amount (₹)"
              value={quoteAmt}
              onChange={(e) => setQuoteAmt(e.target.value)}
            />
            <Input
              placeholder="Note (optional)"
              value={quoteNote}
              onChange={(e) => setQuoteNote(e.target.value)}
            />
          </div>
        </section>

        {/* Primary action */}
        <div className="sticky bottom-4">
          <button
            type="submit"
            className="w-full px-5 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg"
          >
            Create Lead
          </button>
        </div>
      </form>
    </div>
  )
}

/** Small utility input with a leading icon */
function Input({ icon, className = '', ...rest }) {
  return (
    <div>
      {rest.label ? (
        <label className="block text-sm text-gray-600 mb-1">{rest.label}</label>
      ) : null}
      <div className="relative">
        {icon ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        ) : null}
        <input
          {...rest}
          className={
            'w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200 ' +
            (icon ? 'pl-10 ' : '') +
            className
          }
        />
      </div>
    </div>
  )
}
