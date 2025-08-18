import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import HomeButton from '../components/HomeButton';

export default function SalesPerformance(){
  const [statusData, setStatusData] = useState([])
  const [perf, setPerf] = useState(null)

  useEffect(()=>{
    api.get('/retail/analytics/status', { params: { scope: 'me' } }).then(r=>setStatusData(r.data||[]))
    api.get('/retail/analytics/performance', { params: { scope: 'me', period:'month' } }).then(r=>setPerf(r.data))
  },[])

  const chartData = useMemo(()=> (statusData||[]).map(x=>({ name:x.status, count:Number(x.count) })), [statusData])

  return (
    <div className="space-y-6">
      <HomeButton to="/sales" />
      <h2 className="text-xl font-semibold">Performance</h2>

      <div className="bg-white rounded-xl shadow p-4 border">
        <div className="font-medium mb-2">Pipeline by Status</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" fill="#6366f1" stroke="#6366f1" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 border">
        <div className="font-medium mb-3">This Month</div>
        {!perf ? <div className="text-sm text-gray-600">Loading…</div> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 border rounded-lg">
              <div className="text-gray-500 text-sm">Won Deals</div>
              <div className="text-xl font-semibold">{perf.won_count}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-gray-500 text-sm">Won Value</div>
              <div className="text-xl font-semibold">{Number(perf.won_value||0).toLocaleString()}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-gray-500 text-sm">Lost Deals</div>
              <div className="text-xl font-semibold">{perf.lost_count}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-gray-500 text-sm">Activities</div>
              <div className="text-xl font-semibold">{perf.activity_count}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}