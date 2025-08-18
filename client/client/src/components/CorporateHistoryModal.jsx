import Modal from "./Modal";

export default function CorporateHistoryModal({ open, onClose, history = [] }) {
  return (
    <Modal open={open} onClose={onClose} title="Status history" z={60} maxW="max-w-2xl">
      <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
        {history.map(h => (
          <div key={h.status_id || `${h.status}-${h.update_timestamp}`} className="rounded-xl border p-3">
            <div className="font-medium">
              {h.status} <span className="text-gray-500">• {new Date(h.update_timestamp).toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              by {h.updated_by_name || `#${h.updated_by || "—"}`}
            </div>
            {h.notes ? <div className="mt-2 text-sm">{h.notes}</div> : null}
          </div>
        ))}
        {!history.length && (
          <div className="text-sm text-gray-500">No history found for this lead.</div>
        )}
      </div>
    </Modal>
  );
}