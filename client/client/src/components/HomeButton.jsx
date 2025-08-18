import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function HomeButton({ to = '/mgr' }) {
  return (
    <Link
      to={to}
      title="Home"
      className="fixed left-6 top-6 md:left-8 md:top-8 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/90 backdrop-blur border shadow hover:bg-white"
    >
      <Home size={18} />
    </Link>
  )
}