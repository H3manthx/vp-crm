import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Bell, Power, ListChecks } from 'lucide-react';
import CorporateRemindersBar from '../components/CorporateRemindersBar';

export default function CorporateHome() {
  const { user, logout } = useAuth();
  const displayName = user?.name || 'User';
  const roleLabel = 'Corporate Manager';

  return (
    // center EVERYTHING in the viewport
    <div className="min-h-screen bg-gray-50 flex">
      <div className="m-auto w-full max-w-6xl px-6">
        {/* Pills only (centered) */}
        <CorporateRemindersBar />

        {/* Centered hero */}
        <div className="mt-6 flex flex-col items-center text-center gap-2 mb-6">
          <h1 className="font-black tracking-tight text-5xl md:text-6xl">
            Welcome, {displayName}
          </h1>
          <div className="text-gray-500 text-base">{roleLabel}</div>
          <button
            onClick={logout}
            title="Logout"
            className="mt-2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white hover:bg-gray-800 shadow"
          >
            <Power size={18} />
          </button>
        </div>

        {/* Cards row (centered container) */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            to="/corp/create"
            icon={<Briefcase />}
            title="Create Leads"
            desc="Create corporate leads."
          />
          <Card
            to="/corp/my-leads"
            icon={<ListChecks />}
            title="View & Update Leads"
            desc="Browse, search, filter and update all corporate leads."
          />
          <Card
            to="#"
            icon={<Bell />}
            title="Reminders"
            desc="Follow-ups and scheduled tasks."
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
