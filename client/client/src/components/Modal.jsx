import { motion } from 'framer-motion'

export default function Modal({
  open,
  onClose,
  title,
  children,
  z = 50,                 // NEW: lets us stack modals
  maxW = 'max-w-2xl',     // NEW: optional width control
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 grid place-items-center bg-black/30 backdrop-blur-sm"
      style={{ zIndex: z }}
      onMouseDown={onClose}                     // click backdrop to close
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full ${maxW} bg-white rounded-2xl shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()} // don’t close when clicking panel
        role="dialog" aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="px-2 py-1 text-sm" onClick={onClose}>✕</button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </div>
  )
}
