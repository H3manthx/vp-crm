// client/src/pages/ManagerAssignedByMe.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../lib/api'
import HomeButton from '../components/HomeButton'
import HistoryModal from '../components/HistoryModal'
import { Calendar } from 'lucide-react'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Pretty "X day(s), Y hour(s)" label.
// Uses API fields active_days/active_hours_rem when present,
// else falls back to active_hours or enquiry_date.
function ageLabel(row) {
  let days, remHours

  if (
    row &&
    Number.isFinite(row.active_days) &&
    Number.isFinite(row.active_hours_rem)
  ) {
    days = Math.max(0, Math.floor(row.active_days))
    remHours = Math.max(0, Math.floor(row.active_hours_rem))
  } else {
    let hours
    if (row && Number.isFinite(row.active_hours)) {
      hours = Math.max(0, Math.floor(row.active_hours))
    } else if (row?.enquiry_date) {
      const ms = Date.now() - new Date(row.enquiry_date).getTime()
      hours = Math.max(0, Math.floor(ms / 3600000))
    } else {
      return '—'
    }
    days = Math.floor(hours / 24)
    remHours = hours % 24
  }

  const dPart = days > 0 ? `${days} day${days === 1 ? '' : 's'}` : ''
  const hPart = `${remHours} hour${remHours === 1 ? '' : 's'}`
  return dPart ? `${dPart}, ${hPart}` : hPart
}

// NEW: unified label — shows "Lead closed in …" for closed leads, else "Active for …"
function timelineLabel(row) {
  if (!row) return '—'
  const s = (row.status || '').toLowerCase()
  const isClosed = s === 'closed won' || s === 'closed lost' || !!row.closed_date

  const fmtDur = (totalHours) => {
    const total = Math.max(0, Math.floor(totalHours))
    const days = Math.floor(total / 24)
    const hours = total % 24
    const dPart = days > 0 ? `${days} day${days === 1 ? '' : 's'}` : ''
    const hPart = `${hours} hour${hours === 1 ? '' : 's'}`
    return dPart ? `${dPart}, ${hPart}` : hPart
  }

  if (isClosed) {
    const start = row.enquiry_date ? new Date(row.enquiry_date).getTime() : null
    const end = row.closed_date ? new Date(row.closed_date).getTime() : null
    if (start == null || end == null || end < start) return 'Lead closed'
    const hours = (end - start) / 3600000
    return `Lead closed in ${fmtDur(hours)}`
  }

  // still open
  return `Active for ${ageLabel(row)}`
}

const cap = (s='') => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const catLabel = (c) => c === 'pc_component' ? 'PC Component' : cap(c)

export default function ManagerAssignedByMe() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // employees: employee_id -> meta
  const [people, setPeople] = useState({})

  // detail modal
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // filters / sort / view
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' = all
  const [sortKey, setSortKey] = useState('date_desc')  // date_desc | date_asc | name_asc | name_desc | status_asc
  const [viewMode, setViewMode] = useState('list')     // list | month

  // history modal
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])

  // transfer overlay (FIXED: removed stray 'the')
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const transferSelectRef = useRef(null)

  // load leads assigned by me + employees
  const load = async () => {
    setLoading(true); setErr('')
    try {
      const [{ data: leads }, { data: emps }] = await Promise.all([
        api.get('/retail/leads', { params: { assigned_by: 'me', limit: 200 } }),
        api.get('/employees')
      ])
      const list = leads?.data || leads || []
      setRows(list)
      const map = {}
      ;(emps || []).forEach(e => { map[e.employee_id] = e })
      setPeople(map)
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const assigneeName = (id) => {
    if (!id) return 'Unassigned'
    const p = people[id]
    return p?.name || p?.email || `#${id}`
  }

  const allEmployees = useMemo(
    () =>
      Object.values(people)
        .filter(p => p.role !== 'corporate_manager')
        .sort((a,b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')),
    [people]
  )

  // derive available statuses from data
  const statusOptions = useMemo(() => {
    const set = new Set(rows.map(r => r.status).filter(Boolean))
    const preferred = ['New','Assigned','In Progress','Closed Won','Closed Lost']
    const rest = [...set].filter(s => !preferred.includes(s)).sort()
    return preferred.filter(s => set.has(s)).concat(rest)
  }, [rows])

  // filter + sort (client-side)
  const filtered = useMemo(() => {
    const s = (q || '').trim().toLowerCase()
    const arr = rows.filter(r => {
      const okQ = !s || (r.name || '').toLowerCase().includes(s) || String(r.lead_id || '').includes(s)
      const okStatus = !statusFilter || (r.status || '') === statusFilter
      return okQ && okStatus
    })
    const valDate = (r) => r.enquiry_date ? new Date(r.enquiry_date).getTime() : (r.lead_id || 0)
    const cmp = new Intl.Collator('en').compare
    arr.sort((a,b) => {
      if (sortKey === 'date_asc')   return valDate(a) - valDate(b)
      if (sortKey === 'name_asc')   return cmp(a.name || '', b.name || '')
      if (sortKey === 'name_desc')  return cmp(b.name || '', a.name || '')
      if (sortKey === 'status_asc') return cmp(a.status || '', b.status || '')
      return valDate(b) - valDate(a) // newest first
    })
    return arr
  }, [rows, q, statusFilter, sortKey])

  // month groups (like corporate)
  const monthGroups = useMemo(() => {
    const map = new Map()
    for (const lead of filtered) {
      if (!lead.enquiry_date) continue
      const d = new Date(lead.enquiry_date)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const key = monthStart.toISOString().slice(0, 10)
      if (!map.has(key)) {
        const label = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        map.set(key, { key, monthStart, label, items: [] })
      }
      map.get(key).items.push(lead)
    }
    const groups = Array.from(map.values()).sort((a,b) => b.monthStart - a.monthStart)
    for (const g of groups) {
      const cmp = new Intl.Collator('en').compare
      const valDate = (r) => r.enquiry_date ? new Date(r.enquiry_date).getTime() : (r.lead_id || 0)
      g.items.sort((a,b) => {
        if (sortKey === 'date_asc')   return valDate(a) - valDate(b)
        if (sortKey === 'name_asc')   return cmp(a.name || '', b.name || '')
        if (sortKey === 'name_desc')  return cmp(b.name || '', a.name || '')
        if (sortKey === 'status_asc') return cmp(a.status || '', b.status || '')
        return valDate(b) - valDate(a)
      })
    }
    return groups
  }, [filtered, sortKey])

  // open detail modal + fetch details + history
  const openLead = async (lead_id) => {
    setOpenId(lead_id)
    setDetail(null)
    setDetailLoading(true)
    setShowTransfer(false); setTransferTo(''); setTransferReason('')
    try {
      const { data } = await api.get(`/retail/leads/${lead_id}`)
      setDetail(data)
      try {
        const hr = await api.get(`/retail/leads/${lead_id}`)
        setHistory(hr.data?.history || [])
      } catch { setHistory([]) }
    } catch (e) {
      setDetail({ error: e?.response?.data?.error || 'Failed to fetch lead' })
      setHistory([])
    } finally {
      setDetailLoading(false)
    }
  }
  const closeModal = () => {
    setOpenId(null); setDetail(null); setShowTransfer(false); setTransferTo(''); setTransferReason('')
  }

  const Initial = ({ name }) => {
    const ch = (name || 'L').trim()[0]?.toUpperCase?.() || 'L'
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-semibold shadow-sm">
        {ch}
      </div>
    )
  }

  // transfer API
  async function doTransfer() {
    if (!transferTo) return alert('Choose a teammate to transfer to.')
    try {
      await api.post('/retail/leads/assign', {
        lead_id: openId,
        assigned_to: Number(transferTo),
        transfer_reason: transferReason || null,
      })
      alert('Lead transferred.')
      setShowTransfer(false)
      closeModal()
      await load()
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to transfer lead')
    }
  }

  // focus & esc on transfer overlay
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setShowTransfer(false) }
    if (showTransfer) {
      window.addEventListener('keydown', onKey)
      setTimeout(() => transferSelectRef.current?.focus(), 0)
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [showTransfer])

  const total = rows.length
  const shown = filtered.length

  function LeadCard({ r }) {
    return (
      <button
        onClick={() => openLead(r.lead_id)}
        className="text-left rounded-2xl border bg-white shadow-sm hover:shadow-md transition p-4 focus:outline-none"
      >
        <div className="flex items-start gap-3">
          <Initial name={r.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold truncate">{r.name || '—'}</div>
                <div className="mt-1 text-sm text-gray-700">
                  Assigned to: <span className="font-medium">{assigneeName(r.assigned_to)}</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {timelineLabel(r)}
                </div>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {r.enquiry_date ? fmtDate(r.enquiry_date) : '—'}
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
              {r.status || 'New'}
            </div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="relative min-h-screen bg-gray-50 pb-24">
      <HomeButton to="/mgr" />

      {/* Header — corporate style */}
      <div className="pt-10 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6M9 9h6m-8 8h10a2 2 0 002-2V7a2 2 0 00-2-2h-2.5a2 2 0 01-2-2h-3a2 2 0 01-2 2H6a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <span className="text-xs font-medium text-gray-600">Your assignments</span>
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">Assigned leads</h1>
        <p className="mt-1 text-sm md:text-base text-gray-500">
          {loading ? 'Loading…' : `${shown} of ${total} lead${total === 1 ? '' : 's'}`}
        </p>
        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* Filters + view toggle */}
      <section className="mx-auto max-w-6xl px-4 md:px-0 mt-6">
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Search by name or #id…"
            className="w/full md:w-80 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e)=>setStatusFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="Filter by status"
            >
              <option value="">All</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={sortKey}
              onChange={(e)=>setSortKey(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="Sort"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="status_asc">Status A–Z</option>
            </select>

            <button
              onClick={()=>{ setQ(''); setStatusFilter(''); setSortKey('date_desc') }}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Reset
            </button>

            <div className="ml-2 inline-flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-2 text-sm ${viewMode === 'month' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                By month
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      {viewMode === 'list' ? (
        <main className="mx-auto max-w-6xl px-4 md:px-0 py-6">
          {err && <div className="mb-4 rounded-xl border bg-red-50 text-red-700 px-4 py-3 text-center">{err}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!loading && !filtered.length && (
              <div className="col-span-full text-center text-gray-500 py-10">
                No leads match the current filters.
              </div>
            )}
            {filtered.map(r => <LeadCard key={r.lead_id} r={r} />)}
          </div>
        </main>
      ) : (
        <div className="mt-6 max-w-6xl mx-auto px-4 md:px-0 space-y-8">
          {monthGroups.length === 0 && <div className="text-center text-gray-500">No leads to show.</div>}
          {monthGroups.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{g.label}</h3>
                <span className="text-sm text-gray-500">{g.items.length} lead(s)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.items.map((r) => <LeadCard key={r.lead_id} r={r} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {openId != null && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border p-6 relative">
              <button
                onClick={closeModal}
                className="absolute right-4 top-4 rounded-full border w-9 h-9 inline-flex items-center justify-center hover:bg-gray-50"
                aria-label="Close"
              >
                ✕
              </button>

              <h2 className="text-xl font-bold mb-4">Lead #{openId}</h2>

              {detailLoading && <div className="text-gray-600">Loading…</div>}
              {!detailLoading && detail?.error && (
                <div className="rounded-lg border bg-red-50 text-red-700 px-3 py-2">{detail.error}</div>
              )}

              {!detailLoading && detail && !detail.error && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <Initial name={detail.lead?.name} />
                    <div className="min-w-0">
                      <div className="text-lg font-semibold truncate">{detail.lead?.name || '—'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                          {detail.lead?.status || 'New'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} /> {detail.lead?.enquiry_date ? fmtDate(detail.lead.enquiry_date) : '—'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
                          {timelineLabel(detail.lead)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Customer name</label>
                      <input className="mt-1 w-full rounded-xl border px-3 py-2 bg-white" value={detail.lead?.name || ''} readOnly />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Enquiry date</label>
                      <input className="mt-1 w/full rounded-xl border px-3 py-2 bg-white" value={detail.lead?.enquiry_date ? fmtDate(detail.lead.enquiry_date) : '—'} readOnly />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Product type</label>
                      <input className="mt-1 w/full rounded-xl border px-3 py-2 bg-white" value={catLabel(detail.items?.[0]?.category)} readOnly />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Brand</label>
                      <input className="mt-1 w/full rounded-xl border px-3 py-2 bg-white" value={detail.items?.[0]?.brand || ''} readOnly />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm text-gray-500">Product details</label>
                      <textarea className="mt-1 w/full rounded-xl border px-3 py-2 bg-white" rows={3} value={detail.items?.[0]?.item_description || ''} readOnly />
                    </div>
                    {detail.lead?.status === 'Closed Won' && (
                      <div>
                        <label className="text-sm text-gray-500">Lead value</label>
                        <input className="mt-1 w/full rounded-xl border px-3 py-2 font-semibold bg-white" value={Number(detail.lead?.value_closed || 0).toLocaleString()} readOnly />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md/grid-cols-2 gap-3">
                    <button
                      className="w/full px-4 py-2 rounded-lg border hover:bg-gray-50"
                      onClick={() => setShowHistory(true)}
                    >
                      View status history
                    </button>
                    <button
                      className="w/full px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                      onClick={() => setShowTransfer(true)}
                    >
                      Transfer lead
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transfer Overlay Card */}
          {showTransfer && (
            <>
              <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setShowTransfer(false)} />
              <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                <div className="w/full max-w-xl rounded-2xl bg-white border shadow-2xl p-5 relative">
                  <button
                    onClick={() => setShowTransfer(false)}
                    className="absolute right-4 top-4 rounded-full border w-9 h-9 inline-flex items-center justify-center hover:bg-gray-50"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                  <h3 className="text-lg font-semibold">Transfer lead #{openId}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Current assignee: <span className="font-medium">{assigneeName(detail?.lead?.assigned_to)}</span>
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Transfer to</label>
                      <select
                        ref={transferSelectRef}
                        className="w/full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                        value={transferTo}
                        onChange={(e)=>setTransferTo(e.target.value)}
                      >
                        <option value="">Select employee…</option>
                        {allEmployees.map(u => (
                          <option key={u.employee_id} value={u.employee_id}>
                            {u.name || u.email} {u.store_id ? `(Store #${u.store_id})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
                      <textarea
                        rows={3}
                        className="w/full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                        placeholder="Why are you transferring this lead?"
                        value={transferReason}
                        onChange={(e)=>setTransferReason(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This note will be saved with the transfer record.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <button
                        className="flex-1 px-4 py-2 rounded-lg border hover:bg-gray-50"
                        onClick={() => setShowTransfer(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={doTransfer}
                      >
                        Confirm transfer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* History modal */}
      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
      />
    </div>
  )
}
