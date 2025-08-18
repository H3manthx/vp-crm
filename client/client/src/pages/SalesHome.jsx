import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, ClipboardList, BarChart3, Power } from 'lucide-react';

export default function SalesHome() {
  const { user, logout } = useAuth();

  const displayName = user?.name || 'User';
  const roleLabel = 'Salesperson';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-6xl px-6">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <h1 className="font-black tracking-tight text-5xl md:text-6xl">
            Welcome, {displayName}
          </h1>
          <div className="text-gray-500 text-lg">{roleLabel}</div>
          <button
            onClick={logout}
            title="Logout"
            className="mt-1 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white hover:bg-gray-800 shadow"
          >
            <Power size={18} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card to="/sales/create"     icon={<Plus />}          title="Create Lead"       desc="Log a new customer lead." />
          <Card to="/sales/assigned"   icon={<ClipboardList />} title="Assigned to Me"    desc="Leads you’re currently handling." />
          <Card to="/sales/performance"icon={<BarChart3 />}     title="Performance"       desc="Your pipeline and monthly stats." />
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