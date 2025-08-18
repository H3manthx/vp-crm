import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import HomeButton from '../components/HomeButton'

export default function ManagerPerformance(){
  const [statusData, setStatusData] = useState([])
  const [team, setTeam] = useState([])

  useEffect(()=>{
    api.get('/retail/analytics/status', { params: { scope:'domain' } }).then(r=>setStatusData(r.data||[]))
    api.get('/retail/analytics/team-workload').then(r=>setTeam(r.data||[]))
  },[])

  const chartData = useMemo(()=> (statusData||[]).map(x=>({ name:x.status, count:Number(x.count) })), [statusData])

  return (
    <div className="relative">
      <HomeButton to="/mgr" />
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Performance</h2>

        <div className="bg-white rounded-xl shadow p-4 border">
          <div className="font-medium mb-2">Domain Status Mix</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" fill="#4f46e5" stroke="#4f46e5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <div className="font-medium mb-2">Team Overview (Assigned by Me)</div>
          <div className="grid grid-cols-12 text-xs text-gray-500 mb-2">
            <div className="col-span-4">Salesperson</div>
            <div className="col-span-2">Assigned</div>
            <div className="col-span-2">Open</div>
            <div className="col-span-2">Won</div>
            <div className="col-span-2">Won Value</div>
          </div>
          <div className="space-y-2">
            {team.map(t=>(
              <div key={t.employee_id || 'na'} className="grid grid-cols-12 items-center bg-white rounded-lg border p-2">
                <div className="col-span-4 text-sm">{t.name || `#${t.employee_id}`}</div>
                <div className="col-span-2 text-sm">{t.assigned_count}</div>
                <div className="col-span-2 text-sm">{t.open_count}</div>
                <div className="col-span-2 text-sm">{t.won_count}</div>
                <div className="col-span-2 text-sm">{Number(t.won_value||0).toLocaleString()}</div>
              </div>
            ))}
            {!team.length && <div className="text-sm text-gray-500">No data</div>}
          </div>
        </div>
      </div>
    </div>
  )
}