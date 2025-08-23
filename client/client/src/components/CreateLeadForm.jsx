// client/src/components/CreateLeadForm.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../lib/api'
import {
  User,
  Phone,
  Mail,
  Tag,
  Info,
  Store as StoreIcon,
  Package,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
} from 'lucide-react'

/**
 * Retail Create Lead — corporate-style visuals, same functionality
 */
export default function CreateLeadForm({ onSuccess }) {
  // -------- Customer / lead info --------
  const [name, setName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('')
  const [sourceDetail, setSourceDetail] = useState('')

  // -------- Store handling --------
  const [stores, setStores] = useState([])
  const [storeSelection, setStoreSelection] = useState('') // '' | 'manual' | <store_id string>
  const [manualStoreId, setManualStoreId] = useState('')

  // -------- Items --------
  const categoryOptions = [
    { value: 'laptop', label: 'Laptop' },
    { value: 'pc_component', label: 'PC Component' },
  ]

  const brandOptions = [
    'Lenovo', 'Dell', 'HP', 'Acer', 'Asus', 'MSI', 'Apple',
    'AMD', 'Intel', 'NVIDIA', 'Gigabyte', 'ASRock', 'Corsair', 'Kingston', 'Crucial', 'Samsung',
    'Other'
  ]

  const [items, setItems] = useState([
    { category: 'laptop', brand: '', brandOther: '', description: '', quantity: 1 },
  ])

  // Try to fetch stores (optional). If it 404s or fails, we silently ignore.
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/stores') // expect [{ store_id, name }]
        const data = Array.isArray(r.data) ? r.data : []
        setStores(data)
      } catch {
        // optional endpoint – ignore missing route
      }
    })()
  }, [])

  // No "Not applicable". If stores list is empty, show a manual entry option.
  const storeOptions = useMemo(() => {
    if (stores.length) {
      return stores.map(s => ({ id: String(s.store_id), name: s.name }))
    }
    // Backend doesn’t provide stores -> allow manual ID entry only
    return [{ id: 'manual', name: 'Enter store ID manually…' }]
  }, [stores])

  function updateItem(index, patch) {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems(prev => [
      ...prev,
      { category: 'laptop', brand: '', brandOther: '', description: '', quantity: 1 },
    ])
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // derive store_id
    let store_id = null
    if (storeSelection) {
      if (storeSelection === 'manual') {
        store_id = manualStoreId ? Number(manualStoreId) : null
      } else {
        store_id = Number(storeSelection)
      }
    }

    // normalize items
    const payloadItems = items.map(it => ({
      item_description: it.description || null,
      category: (it.category || '').toLowerCase(), // must be laptop|pc_component
      brand: it.brand === 'Other' ? (it.brandOther || 'Other') : it.brand,
      quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
    }))

    // basic validation
    if (!name?.trim()) return alert('Please enter customer name.')
    if (!contactNumber?.trim()) return alert('Please enter contact number.')
    if (!payloadItems.length || !payloadItems[0].brand) {
      return alert('Please add at least one item with a brand.')
    }

    const body = {
      store_id,
      name: name.trim(),
      contact_number: contactNumber.trim(),
      email: email.trim() || null,
      source: source.trim() || null,
      source_detail: sourceDetail.trim() || null,
      items: payloadItems,
    }

    try {
      const r = await api.post('/retail/leads', body) // JWT auto-added by interceptor
      const data = r.data || {}
      alert('Lead created successfully.')
      onSuccess?.(data.lead_id)

      // reset minimal
      setName('')
      setContactNumber('')
      setEmail('')
      setSource('')
      setSourceDetail('')
      setStoreSelection('') // back to placeholder
      setManualStoreId('')
      setItems([{ category: 'laptop', brand: '', brandOther: '', description: '', quantity: 1 }])
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to create lead.'
      alert(msg)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header — matches corporate look */}
      <header className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        <span className="text-xs font-medium text-gray-600">Retail</span>
        </div>

        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">
          Create lead
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-500">
          Capture customer details and requested items.
        </p>

        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Customer section */}
        <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              icon={<User size={16} />}
              placeholder="Customer name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <Input
              icon={<Phone size={16} />}
              placeholder="Contact number"
              value={contactNumber}
              onChange={e => setContactNumber(e.target.value)}
            />
            <Input
              icon={<Mail size={16} />}
              placeholder="Email (optional)"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />

            {/* SOURCE: changed to dropdown (keeps icon + styling) */}
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Tag size={16} />
                </div>
                <select
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  className="w-full rounded-xl border pl-10 pr-3 py-3 outline-none focus:ring-2 focus:ring-indigo-200 bg-white text-gray-700"
                >
                  <option value="">Source (e.g., Walk-in, Online)</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Online">Online</option>
                  <option value="Referral">Referral</option>
                  <option value="Phone">Phone</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <Input
              icon={<Info size={16} />}
              placeholder="Source info / details"
              value={sourceDetail}
              onChange={e => setSourceDetail(e.target.value)}
            />

            {/* Store selection with label inside the control */}
            <div className="md:col-span-1">
              <StoreSelect
                value={storeSelection}
                options={storeOptions}
                onChange={val => setStoreSelection(val)}
              />
              {storeSelection === 'manual' && (
                <input
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200 mt-2"
                  placeholder="Enter store ID"
                  value={manualStoreId}
                  onChange={e => setManualStoreId(e.target.value)}
                />
              )}
            </div>
          </div>
        </section>

        {/* Items section */}
        <section className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Items</h2>
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
            {items.map((it, idx) => {
              const showBrandOther = it.brand === 'Other'
              return (
                <div key={idx} className="rounded-xl border p-4 bg-white/60">
                  {/* Row 1: Category & Brand */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Item type</label>
                      <select
                        value={it.category}
                        onChange={e => updateItem(idx, { category: e.target.value })}
                        className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        {categoryOptions.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">(Allowed types: Laptop, PC Component)</p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Brand</label>
                      <select
                        value={it.brand}
                        onChange={e => updateItem(idx, { brand: e.target.value })}
                        className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="">Select brand</option>
                        {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      {showBrandOther && (
                        <Input
                          className="mt-2"
                          placeholder="Enter brand"
                          value={it.brandOther}
                          onChange={e => updateItem(idx, { brandOther: e.target.value })}
                        />
                      )}
                    </div>
                  </div>

                  {/* Row 2: Description + Qty stepper (aligned heights) */}
                  <div className="grid md:grid-cols-[1fr,150px] gap-3 mt-3">
                    <Input
                      icon={<Package size={16} />}
                      placeholder="Description (optional)"
                      value={it.description}
                      onChange={e => updateItem(idx, { description: e.target.value })}
                    />

                    <div className="flex flex-col">
                      <span className="sr-only">Quantity</span>
                      <div className="h-[46px] flex items-center rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateItem(idx, { quantity: Math.max(1, Number(it.quantity || 1) - 1) })}
                          className="w-10 h-full grid place-items-center hover:bg-gray-50"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={e => updateItem(idx, { quantity: e.target.value })}
                          className="appearance-none w-full text-center outline-none border-0 focus:ring-0 bg-white"
                          aria-label="Quantity"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(idx, { quantity: Math.max(1, Number(it.quantity || 1) + 1) })}
                          className="w-10 h-full grid place-items-center hover:bg-gray-50"
                          aria-label="Increase quantity"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
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
              )
            })}
          </div>
        </section>

        {/* Subtle helper (optional info) */}
        <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-2">
          <h2 className="font-semibold text-lg">Notes</h2>
          <p className="text-sm text-gray-500">
            Brands list includes “Other”. Select it to type a custom brand.
          </p>
        </section>

        {/* Primary action — sticky like corporate */}
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

/** Store dropdown with the label embedded inside the control */
function StoreSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  // IMPORTANT FIX: do NOT default to options[0]; we want placeholder until the user picks one.
  const selected = options.find(o => String(o.id) === String(value)) || null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full rounded-xl border px-4 py-3 text-left outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-400">
            <StoreIcon size={16} />
          </div>
          <div className="flex-1">
            {/* Placeholder "Store" until a selection is made */}
            <div className={`leading-5 ${selected ? 'text-gray-700' : 'text-gray-400'}`}>
              {selected ? selected.name : 'Store'}
            </div>
          </div>
          <ChevronDown size={16} className="text-gray-400" />
        </div>
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 w-full max-h-72 overflow-auto rounded-xl border bg-white shadow-lg">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No stores available</div>
            ) : (
              options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onChange(opt.id); setOpen(false) }}
                  role="option"
                  aria-selected={String(opt.id) === String(value)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50"
                >
                  {opt.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Small utility input with a leading icon (corporate-style) */
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
