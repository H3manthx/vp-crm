// client/src/pages/ManagerMyLeads.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import HomeButton from "../components/HomeButton";
import Modal from "../components/Modal";
import StatusModal from "../components/StatusModal";
import HistoryModal from "../components/HistoryModal";
import { Calendar } from "lucide-react";

// ---- helpers (same as Assigned-by-me page) ----
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Pretty "X day(s), Y hour(s)" label.
// Uses API fields active_days/active_hours_rem when available,
// otherwise falls back to active_hours or enquiry_date.
function ageLabel(row) {
  let days, remHours;

  if (
    row &&
    Number.isFinite(row.active_days) &&
    Number.isFinite(row.active_hours_rem)
  ) {
    days = Math.max(0, Math.floor(row.active_days));
    remHours = Math.max(0, Math.floor(row.active_hours_rem));
  } else {
    let hours;
    if (row && Number.isFinite(row.active_hours)) {
      hours = Math.max(0, Math.floor(row.active_hours));
    } else if (row?.enquiry_date) {
      const ms = Date.now() - new Date(row.enquiry_date).getTime();
      hours = Math.max(0, Math.floor(ms / 3600000));
    } else {
      return "—";
    }
    days = Math.floor(hours / 24);
    remHours = hours % 24;
  }

  const dPart = days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "";
  const hPart = `${remHours} hour${remHours === 1 ? "" : "s"}`;

  return dPart ? `${dPart}, ${hPart}` : hPart;
}

const cap = (s = "") => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const catLabel = (c) =>
  c === "pc_component" ? "PC Component" : cap((c || "").replace("_", " "));

export default function ManagerMyLeads() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest"); // newest | oldest | name
  const [viewMode, setViewMode] = useState("list"); // list | month

  const [openLead, setOpenLead] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false); // NEW
  const [history, setHistory] = useState([]);
  const [showStatus, setShowStatus] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = () =>
    api
      .get("/retail/leads", { params: { assigned_to: "me", limit: 500, offset: 0 } })
      .then((r) => setRows(r.data.data || r.data || []))
      .catch((e) => setErr(e?.response?.data?.error || "Failed to load"));

  useEffect(() => {
    load();
  }, []);

  // ----- filter + sort -----
  const filtered = useMemo(() => {
    let list = [...rows];
    if (q.trim()) {
      const v = q.toLowerCase();
      list = list.filter(
        (x) =>
          String(x.lead_id).includes(v) ||
          (x.name || "").toLowerCase().includes(v) ||
          (x.email || "").toLowerCase().includes(v) ||
          (x.contact_number || "").toLowerCase().includes(v)
      );
    }
    if (status) list = list.filter((x) => (x.status || "New") === status);

    if (sort === "newest") list.sort((a, b) => b.lead_id - a.lead_id);
    else if (sort === "oldest") list.sort((a, b) => a.lead_id - b.lead_id);
    else if (sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return list;
  }, [rows, q, status, sort]);

  // ----- month groups (same as corporate) -----
  const monthGroups = useMemo(() => {
    const map = new Map();
    for (const lead of filtered) {
      if (!lead.enquiry_date) continue;
      const d = new Date(lead.enquiry_date);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const key = monthStart.toISOString().slice(0, 10);
      if (!map.has(key)) {
        const label = monthStart.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        });
        map.set(key, { key, monthStart, label, items: [] });
      }
      map.get(key).items.push(lead);
    }
    const groups = Array.from(map.values()).sort((a, b) => b.monthStart - a.monthStart);
    for (const g of groups) {
      if (sort === "name") g.items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      else if (sort === "oldest") g.items.sort((a, b) => a.lead_id - b.lead_id);
      else g.items.sort((a, b) => b.lead_id - a.lead_id);
    }
    return groups;
  }, [filtered, sort]);

  // ----- open modal (fetch detail + history) -----
  const openLeadModal = async (lead) => {
    setOpenLead(lead);
    setDetail(null);
    setHistory([]);
    setDetailLoading(true);
    try {
      const r = await api.get(`/retail/leads/${lead.lead_id}`);
      setDetail(r.data || {});
      setHistory(r.data?.history || []);
    } catch {
      setDetail({ error: "Failed to fetch lead" });
      setHistory([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterSave = async () => {
    await load();
    if (openLead) {
      const fresh = rows.find((r) => r.lead_id === openLead.lead_id) || openLead;
      setOpenLead(fresh);
      setDetailLoading(true);
      try {
        const r = await api.get(`/retail/leads/${fresh.lead_id}`);
        setDetail(r.data || {});
        setHistory(r.data?.history || []);
      } catch {
        // ignore
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const resetFilters = () => {
    setQ("");
    setStatus("");
    setSort("newest");
  };

  // ----- UI bits -----
  const Initial = ({ name }) => {
    const ch = (name || "L").trim()[0]?.toUpperCase?.() || "L";
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-semibold shadow-sm">
        {ch}
      </div>
    );
  };

  // NEW: build preview data for cards from either items[0] or flat fields
  const getPreview = (r) => {
    const it = r.items?.[0] || {};
    const category = (it.category || r.category || "").toString();
    const brand = it.brand || r.brand || "";
    const desc = it.item_description || r.product_description || "";
    return {
      topLine: [catLabel(category), brand].filter(Boolean).join(" • "),
      desc,
    };
  };

  function LeadCard({ r }) {
    const { topLine, desc } = getPreview(r);
    return (
      <button
        onClick={() => openLeadModal(r)}
        className="text-left rounded-2xl border bg-white shadow-sm hover:shadow-md transition p-4 focus:outline-none"
      >
        <div className="flex items-start gap-3">
          <Initial name={r.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold truncate">{r.name || "—"}</div>

                {topLine && (
                  <div className="mt-0.5 text-sm text-gray-700 truncate">{topLine}</div>
                )}
                {desc && (
                  <div className="mt-0.5 text-sm text-gray-600 truncate">{desc}</div>
                )}

                <div className="mt-1 text-sm text-gray-600">
                  Active for {ageLabel(r)}
                </div>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {r.enquiry_date ? fmtDate(r.enquiry_date) : "—"}
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
              {r.status || "New"}
            </div>
          </div>
        </div>
      </button>
    );
  }

  const prettyDate = detail?.lead?.enquiry_date || openLead?.enquiry_date;

  return (
    <div className="relative min-h-screen bg-gray-50 pb-24">
      <HomeButton to="/mgr" />

      {/* Header — corporate style */}
      <div className="pt-10 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 bg-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6M9 9h6m-8 8h10a2 2 0 002-2V7a2 2 0 00-2-2h-2.5a2 2 0 01-2-2h-3a2 2 0 01-2 2H6a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <span className="text-xs font-medium text-gray-600">My workload</span>
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">
          My assigned leads
        </h1>
        <p className="mt-1 text-sm md:text-base text-gray-500">
          {filtered.length} lead(s)
        </p>
        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* Filters + view toggle — corporate look */}
      <section className="mx-auto max-w-6xl px-4 md:px-0 mt-6">
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            className="w-full md:w-80 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Search by name or #id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option>New</option>
              <option>Assigned</option>
              <option>In Progress</option>
              <option>Closed Won</option>
              <option>Closed Lost</option>
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>

            <button
              onClick={resetFilters}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Reset
            </button>

            <div className="ml-2 inline-flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm ${
                  viewMode === "list"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-2 text-sm ${
                  viewMode === "month"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                By month
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      {viewMode === "list" ? (
        <main className="mx-auto max-w-6xl px-4 md:px-0 py-6">
          {err && (
            <div className="mb-4 rounded-xl border bg-red-50 text-red-700 px-4 py-3 text-center">
              {err}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!filtered.length && (
              <div className="col-span-full text-center text-gray-500 py-10">
                No leads assigned to you.
              </div>
            )}
            {filtered.map((r) => (
              <LeadCard key={r.lead_id} r={r} />
            ))}
          </div>
        </main>
      ) : (
        <div className="mt-6 max-w-6xl mx-auto px-4 md:px-0 space-y-8">
          {monthGroups.length === 0 && (
            <div className="text-center text-gray-500">No leads assigned to you.</div>
          )}
          {monthGroups.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{g.label}</h3>
                <span className="text-sm text-gray-500">{g.items.length} lead(s)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.items.map((r) => (
                  <LeadCard key={r.lead_id} r={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Lead detail modal (corporate look inside) */}
      <Modal
        open={!!openLead}
        onClose={() => {
          setOpenLead(null);
          setDetail(null);
        }}
        title={openLead ? `Lead #${openLead.lead_id}` : ""}
        z={55}
        maxW="max-w-2xl"
      >
        {openLead && (
          <div className="space-y-5">
            {/* header block with avatar + chips */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-semibold shadow-sm">
                {(openLead.name || "L").trim()[0]?.toUpperCase?.() || "L"}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">
                  {detail?.lead?.name ?? openLead.name ?? "—"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                    {detail?.lead?.status ?? openLead.status ?? "New"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={14} /> {prettyDate ? fmtDate(prettyDate) : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
                    Active for {ageLabel(openLead)}
                  </span>
                </div>
              </div>
            </div>

            {/* detail states + fields (mirror Assigned-by-me) */}
            {detailLoading && <div className="text-gray-600">Loading…</div>}

            {!detailLoading && detail?.error && (
              <div className="rounded-lg border bg-red-50 text-red-700 px-3 py-2">{detail.error}</div>
            )}

            {!detailLoading && detail && !detail.error && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Customer name</label>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                    readOnly
                    value={detail.lead?.name || ""}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Enquiry date</label>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                    readOnly
                    value={detail.lead?.enquiry_date ? fmtDate(detail.lead.enquiry_date) : "—"}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Product type</label>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                    readOnly
                    value={catLabel(detail.items?.[0]?.category)}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Brand</label>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                    readOnly
                    value={detail.items?.[0]?.brand || ""}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500">Product details</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                    readOnly
                    value={detail.items?.[0]?.item_description || ""}
                  />
                </div>
                {detail.lead?.status === "Closed Won" && (
                  <div>
                    <label className="text-sm text-gray-500">Lead value</label>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 font-semibold bg-white"
                      readOnly
                      value={Number(detail.lead?.value_closed || 0).toLocaleString()}
                    />
                  </div>
                )}
              </div>
            )}

            {/* actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                className="w-full px-4 py-2 rounded-lg border hover:bg-gray-50"
                onClick={() => setShowHistory(true)}
              >
                View status history
              </button>
              <button
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => setShowStatus(true)}
              >
                Update status
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stacked modals */}
      {openLead && (
        <>
          <StatusModal
            open={showStatus}
            onClose={() => setShowStatus(false)}
            lead={detail?.lead ?? openLead}
            onSaved={refreshAfterSave}
          />
          <HistoryModal
            open={showHistory}
            onClose={() => setShowHistory(false)}
            history={history}
          />
        </>
      )}
    </div>
  );
}
