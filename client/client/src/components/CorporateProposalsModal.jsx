import { useEffect, useState } from "react";
import Modal from "./Modal";
import api from "../lib/api";

function resolveHref(p) {
  // 1) Prefer absolute URL from server
  if (p?.file_url && /^https?:\/\//.test(p.file_url)) return p.file_url;

  // 2) Else build from env base
  const sp = p?.stored_path || "";
  if (/^https?:\/\//.test(sp)) return sp;
  const base = (import.meta.env.VITE_FILE_BASE || "").replace(/\/$/, "");
  if (base) return `${base}${sp.startsWith("/") ? "" : "/"}${sp}`;

  // 3) Last resort (will likely route to SPA if on 5173)
  return sp || "#";
}

export default function CorporateProposalsModal({ open, onClose, corporate_lead_id, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !corporate_lead_id) return;
    setLoading(true);
    setErr("");
    api
      .get(`/corporate/leads/proposals/${corporate_lead_id}`)
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        setRows(data);
      })
      .catch((e) => setErr(e?.response?.data?.error || "Failed to load proposals"))
      .finally(() => setLoading(false));
  }, [open, corporate_lead_id, refreshKey]);

  return (
    <Modal open={open} onClose={onClose} title="Proposals (PDF)" z={60} maxW="max-w-xl">
      {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {rows.map((p) => {
            const href = resolveHref(p);
            return (
              <div key={p.doc_id} className="rounded-xl border p-3">
                <div className="font-medium break-all">{p.file_name}</div>
                <div className="text-sm text-gray-600">
                  {(p.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(p.uploaded_at).toLocaleString()}
                </div>
                <div className="mt-2">
                  <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                    Open PDF
                  </a>
                </div>
              </div>
            );
          })}
          {!rows.length && <div className="text-sm text-gray-500">No proposals uploaded yet.</div>}
        </div>
      )}
    </Modal>
  );
}