import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../lib/api'

export default function LeadDetail(){
  const { id } = useParams()
  const [data,setData] = useState(null)
  const [err,setErr] = useState('')
  const [status,setStatus] = useState('')
  const [notes,setNotes] = useState('')
  const [value,setValue] = useState('')

  const load = ()=> api.get(`/retail/leads/${id}`).then(r=>{ setData(r.data); setStatus(r.data.lead.status||''); }).catch(e=>setErr(e?.response?.data?.error||'Failed to load'))
  useEffect(()=>{ load() },[id])

  const updateStatus = async ()=>{
    try{
      await api.post('/retail/leads/status', { lead_id: Number(id), status, notes: notes || null, value_closed: value? Number(value): null })
      setNotes(''); load()
    }catch(e){ setErr(e?.response?.data?.error || 'Update failed') }
  }

  const [newItem,setNewItem] = useState({ item_description:'', category:'laptop', brand:'', quantity:1 })
  const addItem = async ()=>{
    try{
      await api.post('/retail/leads/items', { lead_id: Number(id), items:[{...newItem, quantity:Number(newItem.quantity||1)}] })
      setNewItem({ item_description:'', category:'laptop', brand:'', quantity:1 }); load()
    }catch(e){ setErr(e?.response?.data?.error || 'Add item failed') }
  }

  if(!data) return <div className="text-gray-600">Loading...</div>
  const { lead, items, history } = data

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4 border">
        <h2 className="text-lg font-semibold">Lead #{lead.lead_id} – {lead.name}</h2>
        <div className="text-sm text-gray-600">Contact: {lead.contact_number} {lead.email?`• ${lead.email}`:''}</div>
        <div className="text-sm text-gray-600">Status: <span className="font-medium">{lead.status}</span></div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Items */}
        <div className="md:col-span-2 space-y-3">
          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="font-medium mb-3">Items</div>
            <div className="space-y-2">
              {items.map(it=> (
                <div key={it.lead_item_id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div>
                    <div className="font-medium">{it.brand} × {it.quantity}</div>
                    <div className="text-xs text-gray-500">{it.category}{it.item_description?` • ${it.item_description}`:''}</div>
                  </div>
                </div>
              ))}
              {!items.length && <div className="text-sm text-gray-500">No items yet</div>}
            </div>
            <div className="mt-4 grid md:grid-cols-4 gap-2">
              <input className="border rounded-lg px-3 py-2" placeholder="Description" value={newItem.item_description} onChange={e=>setNewItem(s=>({...s,item_description:e.target.value}))} />
              <select className="border rounded-lg px-3 py-2" value={newItem.category} onChange={e=>setNewItem(s=>({...s,category:e.target.value}))}>
                <option value="laptop">Laptop</option>
                <option value="pc_component">PC Component</option>
              </select>
              <input className="border rounded-lg px-3 py-2" placeholder="Brand" value={newItem.brand} onChange={e=>setNewItem(s=>({...s,brand:e.target.value}))} />
              <input type="number" min="1" className="border rounded-lg px-3 py-2" placeholder="Qty" value={newItem.quantity} onChange={e=>setNewItem(s=>({...s,quantity:e.target.value}))} />
            </div>
            <div className="mt-2"><button onClick={addItem} className="px-3 py-2 rounded-lg bg-brand-600 text-white">Add Item</button></div>
          </div>
        </div>

        {/* Status & History */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="font-medium mb-2">Update Status</div>
            <select className="border rounded-lg px-3 py-2 w-full mb-2" value={status} onChange={e=>setStatus(e.target.value)}>
              <option>New</option>
              <option>In Progress</option>
              <option>Closed Won</option>
              <option>Closed Lost</option>
            </select>
            <input className="border rounded-lg px-3 py-2 w-full mb-2" placeholder="Value (optional, when closing)" value={value} onChange={e=>setValue(e.target.value)} />
            <textarea className="border rounded-lg px-3 py-2 w-full" rows={3} placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} />
            <div className="mt-2"><button onClick={updateStatus} className="px-3 py-2 rounded-lg bg-gray-900 text-white">Save</button></div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="font-medium mb-2">History</div>
            <div className="space-y-2 max-h-72 overflow-auto">
              {history.map(h=> (
                <div key={h.status_id} className="border rounded-lg px-3 py-2">
                  <div className="text-sm"><span className="font-medium">{h.status}</span> • {new Date(h.update_timestamp).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">by {h.updated_by_name || ('#'+h.updated_by)}</div>
                  {h.notes && <div className="text-sm text-gray-700 mt-1">{h.notes}</div>}
                </div>
              ))}
              {!history.length && <div className="text-sm text-gray-500">No history yet</div>}
            </div>
          </div>
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}
    </div>
  )
}