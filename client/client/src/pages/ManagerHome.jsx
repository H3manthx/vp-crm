// client/src/pages/ManagerHome.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, ClipboardList, BarChart3, Power, Download } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, ''); // e.g. https://vp-crm-...run.app/api

export default function ManagerHome() {
  const { user, logout } = useAuth();

  const roleLabel =
    user?.role === 'pc_manager' ? 'PC Components Manager' :
    user?.role === 'laptop_manager' ? 'Laptop Manager' :
    (user?.role || 'Manager');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-6xl px-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <h1 className="font-black tracking-tight text-5xl md:text-6xl">
            Welcome, {user?.name || 'User'}
          </h1>
          <div className="text-gray-500 text-lg">{roleLabel}</div>

          {/* circular logout */}
          <button
            onClick={logout}
            title="Logout"
            className="mt-1 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white hover:bg-gray-800 shadow"
          >
            <Power size={18} />
          </button>
        </div>

        {/* Shortcuts */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card to="/mgr/create"        icon={<Plus size={18} />}          title="Create Leads"          desc="Log a new lead in your domain." />
          <Card to="/mgr/unassigned"     icon={<Users size={18} />}         title="Unassigned Leads"      desc="Distribute new leads to sales." />
          <Card to="/mgr/assigned-by-me" icon={<Users size={18} />}         title="Track Assigned Leads"  desc="See all assignments you made." />
          <Card to="/mgr/my-leads"       icon={<ClipboardList size={18} />} title="My Leads"              desc="Leads you’re personally handling." />
          <Card to="/mgr/performance"    icon={<BarChart3 size={18} />}     title="Performance"           desc="Status mix and team overview." />

          {/* Export Leads (direct download from API origin) */}
          <CardAnchor
            href={`${API_BASE}/mgr/export`}
            icon={<Download size={18} />}
            title="Export Leads"
            desc="Download all leads as Excel."
          />
        </div>
      </div>
    </div>
  );
}

function Card({ to, icon, title, desc }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border bg-white/90 backdrop-blur p-5 shadow hover:shadow-lg transition"
    >
      <div className="flex items-start gap-4">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-gray-600">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

function CardAnchor({ href, icon, title, desc }) {
  return (
    <a
      href={href}
      className="block rounded-2xl border bg-white/90 backdrop-blur p-5 shadow hover:shadow-lg transition"
      target="_blank"     /* keep SPA open; downloads in new tab */
      rel="noopener"
    >
      <div className="flex items-start gap-4">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-gray-600">{desc}</div>
        </div>
      </div>
    </a>
  );
}
