import { useEffect, useState } from "react";
import Modal from "./Modal";
import api from "../lib/api";

export default function CorporateQuotesModal({ open, onClose, corporate_lead_id }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !corporate_lead_id) return;
    api.get(`/corporate/leads/quotes/${corporate_lead_id}`)
      .then(r => setRows(r.data || []))
      .catch(e => setErr(e?.response?.data?.error || "Failed to load quotes"));
  }, [open, corporate_lead_id]);

  return (
    <Modal open={open} onClose={onClose} title="Quotation history" z={60} maxW="max-w-xl">
      {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
      <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
        {rows.map(q => (
          <div key={q.quote_id} className="rounded-xl border p-3">
            <div className="font-medium">₹{Number(q.amount).toLocaleString("en-IN")}</div>
            <div className="text-sm text-gray-600">
              {new Date(q.created_at).toLocaleString()}
            </div>
            {q.notes ? <div className="text-sm mt-1">{q.notes}</div> : null}
          </div>
        ))}
        {!rows.length && <div className="text-sm text-gray-500">No quotations added yet.</div>}
      </div>
    </Modal>
  );
}