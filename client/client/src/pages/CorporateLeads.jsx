// client/src/pages/CorporateLeads.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import HomeButton from "../components/HomeButton";
import Modal from "../components/Modal";
import CorporateStatusModal from "../components/CorporateStatusModal";
import CorporateHistoryModal from "../components/CorporateHistoryModal";
import CorporateQuotesModal from "../components/CorporateQuotesModal";
import CorporateProposalsModal from "../components/CorporateProposalsModal";
import { formatDateTime, formatDate } from "../utils/dates";
import { Calendar, Mail, Phone, Package2 } from "lucide-react";

export default function CorporateLeads() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [viewMode, setViewMode] = useState("list"); // "list" | "month"

  const [openLead, setOpenLead] = useState(null);
  const [history, setHistory] = useState([]);
  const [showStatus, setShowStatus] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [showProposals, setShowProposals] = useState(false);
  const [proposalRefreshKey, setProposalRefreshKey] = useState(0);

  const load = () =>
    api
      .get("/corporate/leads", { params: { limit: 500, offset: 0 } })
      .then((r) => setRows(r.data.data || r.data))
      .catch((e) => setErr(e?.response?.data?.error || "Failed to load"));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (q.trim()) {
      const v = q.toLowerCase();
      list = list.filter(
        (x) =>
          String(x.corporate_lead_id).includes(v) ||
          (x.name || "").toLowerCase().includes(v) ||
          (x.email || "").toLowerCase().includes(v) ||
          (x.contact_number || "").toLowerCase().includes(v)
      );
    }
    if (status) list = list.filter((x) => (x.status || "New") === status);
    if (sort === "newest") list.sort((a, b) => b.corporate_lead_id - a.corporate_lead_id);
    else if (sort === "oldest") list.sort((a, b) => a.corporate_lead_id - b.corporate_lead_id);
    else if (sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [rows, q, status, sort]);

  const monthGroups = useMemo(() => {
    const map = new Map();
    for (const lead of filtered) {
      if (!lead.enquiry_date) continue;
      const d = new Date(lead.enquiry_date);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const key = monthStart.toISOString().slice(0, 10);
      if (!map.has(key)) {
        const label = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        map.set(key, { key, monthStart, label, items: [] });
      }
      map.get(key).items.push(lead);
    }
    const groups = Array.from(map.values()).sort((a, b) => b.monthStart - a.monthStart);
    for (const g of groups) {
      if (sort === "name") g.items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      else if (sort === "oldest") g.items.sort((a, b) => a.corporate_lead_id - b.corporate_lead_id);
      else g.items.sort((a, b) => b.corporate_lead_id - a.corporate_lead_id);
    }
    return groups;
  }, [filtered, sort]);

  const openLeadModal = async (lead) => {
    setOpenLead(lead);
    try {
      const r = await api.get(`/corporate/leads/${lead.corporate_lead_id}`);
      const h = await api.get(`/corporate/leads/history/${lead.corporate_lead_id}`).catch(() => ({ data: [] }));
      setOpenLead({ ...lead, ...(r.data || {}) });
      setHistory(h.data || []);
    } catch {
      setHistory([]);
    }
  };

  const refreshAfterSave = async () => {
    await load();
    if (openLead) {
      const fresh = rows.find(r => r.corporate_lead_id === openLead.corporate_lead_id) || openLead;
      setOpenLead(fresh);
      try {
        const h = await api.get(`/corporate/leads/history/${fresh.corporate_lead_id}`);
        setHistory(h.data || []);
      } catch {
        // ignore errors when refreshing history
      }
    }
  };

  const resetFilters = () => { setQ(""); setStatus(""); setSort("newest"); };

  const items = Array.isArray(openLead?.items) ? openLead.items : [];

  function LeadCard({ r }) {
    return (
      <button
        onClick={() => openLeadModal(r)}
        className="text-left bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{r.name || "—"}</div>
            <div className="mt-1 text-sm">
              <span className="text-gray-500">Status: </span>
              <span className="font-medium">{r.status || "New"}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 text-right whitespace-nowrap">
            {r.enquiry_date ? formatDateTime(r.enquiry_date) : "—"}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-50 pb-24">
      <HomeButton to="/corp" />

      {/* Header */}
      <div className="pt-10 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-xs font-medium text-gray-600">Corporate pipeline</span>
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Corporate leads</h1>
        <p className="mt-1 text-sm md:text-base text-gray-500">{filtered.length} lead(s)</p>
      </div>

      {/* Filters + view toggle */}
      <div className="mt-6 max-w-6xl mx-auto px-4 md:px-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <input
            className="w-full md:w-80 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Search by name or #id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option>New</option>
              <option>Discovery</option>
              <option>Proposal Sent</option>
              <option>Negotiation</option>
              <option>Closed Won</option>
              <option>Closed Lost</option>
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
            <button onClick={resetFilters} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">Reset</button>

            <div className="ml-2 inline-flex rounded-lg border overflow-hidden">
              <button onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                List
              </button>
              <button onClick={() => setViewMode("month")}
                className={`px-3 py-2 text-sm ${viewMode === "month" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                By month
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto px-4 md:px-0">
          {err && <div className="md:col-span-2 text-center text-red-600">{err}</div>}
          {filtered.map((r) => <LeadCard key={r.corporate_lead_id} r={r} />)}
          {!filtered.length && <div className="md:col-span-2 text-center text-gray-500">No corporate leads found.</div>}
        </div>
      ) : (
        <div className="mt-6 max-w-6xl mx-auto px-4 md:px-0 space-y-8">
          {monthGroups.length === 0 && <div className="text-center text-gray-500">No corporate leads found.</div>}
          {monthGroups.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{g.label}</h3>
                <span className="text-sm text-gray-500">{g.items.length} lead(s)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.items.map((r) => <LeadCard key={r.corporate_lead_id} r={r} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Lead detail modal */}
      <Modal
        open={!!openLead}
        onClose={() => setOpenLead(null)}
        title={openLead ? `Lead #${openLead.corporate_lead_id}` : ""}
        z={55}
        maxW="max-w-2xl"
      >
        {openLead && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-semibold shadow-sm">
                {(openLead.name || "L").trim()[0]?.toUpperCase?.() || "L"}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{openLead.name || "—"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                    {openLead.status || "New"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={14} /> {openLead.enquiry_date ? formatDate(openLead.enquiry_date) : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-gray-500 mb-1">Phone</div>
                <div className="flex items-center gap-2 font-medium text-gray-800">
                  <Phone size={16} className="text-gray-400" />
                  {openLead.contact_number || "—"}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-gray-500 mb-1">Email</div>
                <div className="flex items-center gap-2 font-medium text-gray-800 break-all">
                  <Mail size={16} className="text-gray-400" />
                  {openLead.email || "—"}
                </div>
              </div>

              {/* Bill of Material + Requirements */}
              <div className="md:col-span-2 rounded-xl border bg-white p-3">
                <div className="text-xs text-gray-500 mb-2">Bill of Material</div>
                {items.length ? (
                  <ul className="space-y-2">
                    {items.map((it, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Package2 size={16} className="mt-1 text-gray-400" />
                        <div className="text-sm">
                          <span className="font-medium">{it.bill_of_material || "—"}</span>
                          {it.quantity ? <span className="text-gray-600"> × {it.quantity}</span> : null}
                          {it.requirements ? (
                            <span className="text-gray-500"> — {it.requirements}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button className="w-full px-4 py-2 rounded-lg border hover:bg-gray-50" onClick={() => setShowHistory(true)}>
                  View status history
                </button>
                <button className="w-full px-4 py-2 rounded-lg border hover:bg-gray-50" onClick={() => setShowQuotes(true)}>
                  View quotation history
                </button>
                <button className="w-full px-4 py-2 rounded-lg border hover:bg-gray-50" onClick={() => setShowProposals(true)}>
                  View proposals
                </button>
              </div>
              <button className="w-full px-5 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setShowStatus(true)}>
                Update status
              </button>
            </div>
          </div>
        )}
      </Modal>

      {openLead && (
        <>
          <CorporateStatusModal
            open={showStatus}
            onClose={() => setShowStatus(false)}
            lead={openLead}
            onSaved={refreshAfterSave}
            onProposalUploaded={() => setProposalRefreshKey((k) => k + 1)}
          />
          <CorporateHistoryModal open={showHistory} onClose={() => setShowHistory(false)} history={history} />
          <CorporateQuotesModal open={showQuotes} onClose={() => setShowQuotes(false)} corporate_lead_id={openLead.corporate_lead_id} />
          <CorporateProposalsModal open={showProposals} onClose={() => setShowProposals(false)} corporate_lead_id={openLead.corporate_lead_id} refreshKey={proposalRefreshKey} />
        </>
      )}
    </div>
  );
}
