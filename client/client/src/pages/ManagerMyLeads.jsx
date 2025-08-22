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

            {/* fields */}
            {(() => {
              const lead = detail?.lead ?? openLead;
              const it = detail?.items?.[0] || {};
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Customer name</label>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      readOnly
                      value={lead?.name || ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Enquiry date</label>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      readOnly
                      value={prettyDate ? fmtDate(prettyDate) : "—"}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Product type</label>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      readOnly
                      value={catLabel(it.category || lead?.category)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Brand</label>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      readOnly
                      value={it.brand || ""}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-500">Product details</label>
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      readOnly
                      value={it.item_description || ""}
                    />
                  </div>
                </div>
              );
            })()}

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
