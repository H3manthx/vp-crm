import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import HomeButton from '../components/HomeButton';
import { Calendar, User as UserIcon } from 'lucide-react';

// Small helper to format a yyyy-mm-dd date to something human
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ---------------------------- Fancy User Picker ---------------------------- */
function UserPicker({ options, value, onChange, placeholder = 'Assign lead' }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState('bottom'); // 'bottom' | 'top'
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    setPlacement(below < 280 && above > below ? 'top' : 'bottom');
  }, [open]);

  return (
    <div className="relative w-full">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-[52px] rounded-xl bg-indigo-600 text-white px-4 py-3 hover:bg-indigo-700"
      >
        <span className="font-medium">{placeholder}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-20 left-0 w-full max-h-72 overflow-auto rounded-xl border bg-white shadow-lg ${
              placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
            }`}
          >
            {options.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500">No users</div>
            )}
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50"
              >
                <div className="font-medium leading-5">{opt.title}</div>
                <div className="text-xs text-gray-500 leading-4">{opt.sub}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------- Page Component ---------------------------- */
export default function ManagerUnassigned() {
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // modal state
  const [openLead, setOpenLead] = useState(null); // { lead, items? }
  const [detailLoading, setDetailLoading] = useState(false);

  // employees + stores for assignment
  const [people, setPeople] = useState([]);
  const [stores, setStores] = useState([]);

  // --- prettier cards: cache first brand for preview ---
  const [brandCache, setBrandCache] = useState({});

  const storeMap = useMemo(() => {
    const m = new Map();
    stores.forEach(s => m.set(s.store_id, s.name));
    return m;
  }, [stores]);

  const peopleMap = useMemo(() => {
    const m = new Map();
    people.forEach(p => m.set(p.employee_id, p));
    return m;
  }, [people]);

  const labelizeRole = (r) => {
    if (!r) return '—';
    const map = {
      sales: 'Sales',
      laptop_manager: 'Laptop Manager',
      pc_manager: 'PC Manager',
      corporate_manager: 'Corporate Manager',
    };
    return map[r] || r;
  };

  // prettier two-line options
  const assigneeOptions = useMemo(() => {
    return people
      .filter(p => p.role !== 'corporate_manager') // exclude corp mgr
      .map(p => ({
        value: p.employee_id,
        title: p.name || p.email,
        sub: `${labelizeRole(p.role)} • ${storeMap.get(p.store_id) || (p.store_id ? `Store #${p.store_id}` : 'No store')}`
      }));
  }, [people, storeMap]);

  /* ------------------------------- Loads -------------------------------- */
  async function loadLeads() {
    setErr('');
    setLoading(true);
    try {
      const res = await api.get('/retail/leads', { params: { unassigned: 1, limit: 100 } });
      const data = res.data?.data || res.data || [];
      setLeads(data);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function loadPeople() {
    try {
      const r = await api.get('/employees', { params: {} });
      setPeople(Array.isArray(r.data) ? r.data : []);
    } catch { /* ignore */ }
  }

  async function loadStores() {
    try {
      const r = await api.get('/stores');
      setStores(Array.isArray(r.data) ? r.data : []);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadLeads();
    loadPeople();
    loadStores();
  }, []);

  async function preloadFirstBrand(leadId) {
    try {
      const r = await api.get(`/retail/leads/${leadId}`);
      const it = (r.data?.items || [])[0];
      return it?.brand || '—';
    } catch {
      return '—';
    }
  }
  useEffect(() => {
    (async () => {
      const missing = leads.filter(l => !(l.lead_id in brandCache));
      if (!missing.length) return;
      const clones = { ...brandCache };
      for (const l of missing) {
        clones[l.lead_id] = await preloadFirstBrand(l.lead_id);
      }
      setBrandCache(clones);
    })();
  }, [leads]); // eslint-disable-line

  /* --------------------------- Open + Assign ---------------------------- */
  async function openLeadModal(lead) {
    setDetailLoading(true);
    try {
      const r = await api.get(`/retail/leads/${lead.lead_id}`);
      setOpenLead({ ...lead, items: r.data?.items || [] });
    } catch {
      setOpenLead({ ...lead, items: [] });
    } finally {
      setDetailLoading(false);
    }
  }

  async function assign(leadId, assignedTo) {
    await api.post('/retail/leads/assign', { lead_id: leadId, assigned_to: assignedTo });
    setOpenLead(null);
    await loadLeads();
  }

  /* ------------------------- Helpers for UI ----------------------------- */
  const creatorName = (lead) => {
    const p = peopleMap.get(lead?.created_by);
    return p?.name || p?.email || (lead?.created_by ? `#${lead.created_by}` : '—');
  };

  const Initial = ({ name }) => {
    const ch = (name || 'L').trim()[0]?.toUpperCase?.() || 'L';
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-semibold shadow-sm">
        {ch}
      </div>
    );
  };

  /* ------------------------------- UI ---------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <HomeButton to="/mgr" />

      {/* Header — corporate style */}
      <div className="max-w-6xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
          </svg>
          <span className="text-xs font-medium text-gray-600">Queue</span>
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">Unassigned leads</h1>
        <p className="mt-1 text-sm md:text-base text-gray-500">
          {loading ? 'Loading…' : `${leads.length} unassigned ${leads.length === 1 ? 'lead' : 'leads'}`}
        </p>
        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {err && (
        <div className="mx-auto max-w-xl text-center text-sm text-red-600 mt-6">{err}</div>
      )}

      {/* Cards — corporate look */}
      <div className="mt-6 max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {!loading && leads.length === 0 && (
          <div className="md:col-span-2 text-center text-gray-500">No unassigned leads in your domain.</div>
        )}

        {leads.map((lead) => (
          <button
            key={lead.lead_id}
            type="button"
            onClick={() => openLeadModal(lead)}
            className="text-left bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition"
          >
            <div className="flex items-start gap-3">
              <Initial name={lead.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold truncate">{lead.name || '—'}</div>
                    <div className="mt-1 text-sm text-gray-600">
                      Brand: <span className="font-medium text-gray-800">{brandCache[lead.lead_id] || '…'}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {lead.enquiry_date ? fmtDate(lead.enquiry_date) : '—'}
                  </div>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                  Unassigned
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal — corporate style + creator name */}
      {openLead && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpenLead(null)} />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border p-6 relative z-50">
              <button
                onClick={() => setOpenLead(null)}
                className="absolute right-4 top-4 rounded-full border w-9 h-9 inline-flex items-center justify-center hover:bg-gray-50"
                title="Close"
              >
                ✕
              </button>

              <div className="flex items-start gap-4 mb-4">
                <Initial name={openLead.name} />
                <div className="min-w-0">
                  <div className="text-xl font-semibold leading-6 truncate">{openLead.name || '—'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={14} /> {fmtDate(openLead.enquiry_date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserIcon size={14} /> Created by: <span className="font-medium text-gray-800">{creatorName(openLead)}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Customer name</label>
                  <input className="w-full mt-1 rounded-xl border px-3 py-2 bg-white" value={openLead.name || ''} readOnly />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Enquiry date</label>
                  <input className="w-full mt-1 rounded-xl border px-3 py-2 bg-white" value={fmtDate(openLead.enquiry_date)} readOnly />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Product type</label>
                  <input
                    className="w-full mt-1 rounded-xl border px-3 py-2 bg-white"
                    value={(openLead.items?.[0]?.category === 'pc_component' ? 'PC Component' : (openLead.items?.[0]?.category ? 'Laptop' : '—'))}
                    readOnly
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Brand</label>
                  <input className="w-full mt-1 rounded-xl border px-3 py-2 bg-white" value={openLead.items?.[0]?.brand || '—'} readOnly />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500">Product details</label>
                  <textarea
                    className="w-full mt-1 rounded-xl border px-3 py-2 bg-white"
                    rows={3}
                    value={openLead.items?.[0]?.item_description || '—'}
                    readOnly
                  />
                </div>
              </div>

              {detailLoading && (
                <div className="mt-3 text-sm text-gray-500">Loading details…</div>
              )}

              {/* Actions — corporate sizing */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                <UserPicker
                  options={assigneeOptions}
                  value={null}
                  onChange={(uid) => assign(openLead.lead_id, uid)}
                  placeholder="Assign lead"
                />
                <button
                  type="button"
                  onClick={() => assign(openLead.lead_id, user?.id || user?.user_id)}
                  className="w-full h-[52px] rounded-xl bg-indigo-600 text-white px-4 py-3 hover:bg-indigo-700"
                >
                  Assign to self
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}