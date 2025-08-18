import { useEffect, useMemo, useRef, useState } from 'react'
import logo from '../assets/vp logo.png' // adjust if your filename differs

export default function SplashScreen({ ready, minDuration = 700 }) {
  const [minPassed, setMinPassed] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [gone, setGone] = useState(false)
  const [spin, setSpin] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setMinPassed(true), minDuration)
    return () => clearTimeout(t)
  }, [minDuration])

  const shouldHide = useMemo(() => ready && minPassed, [ready, minPassed])

  useEffect(() => {
    if (!shouldHide) return
    setHiding(true)
    const t = setTimeout(() => setGone(true), 800)
    return () => clearTimeout(t)
  }, [shouldHide])

  if (gone) return null

  function onMove(e) {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = (e.clientX - cx) / (r.width / 2)
    const dy = (e.clientY - cy) / (r.height / 2)
    // Limit tilt
    const rx = (-dy * 8).toFixed(2)
    const ry = (dx * 10).toFixed(2)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
  }
  function onLeave() {
    const el = wrapRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }
  function spinOnce() {
    setSpin(true)
    setTimeout(() => setSpin(false), 700)
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] grid place-items-center overflow-hidden transition
                  ${hiding ? 'opacity-0 scale-[0.985] duration-[650ms] ease-out pointer-events-none' : 'opacity-100'}`}
      style={{ background: '#0b0d10' }}
      aria-hidden={hiding ? 'true' : 'false'}
    >
      {/* Soft background tint */}
      <div
        className="absolute -inset-[18%]"
        style={{
          background: `
            radial-gradient(1100px 700px at 50% 40%, rgba(255,255,255,.06), transparent 60%),
            radial-gradient(900px 560px at 50% 80%, rgba(255,255,255,.04), transparent 60%),
            linear-gradient(#0b0d10,#0b0d10)
          `
        }}
      />

      {/* Orbiting dots */}
      <div className="splash-orbit splash-orbit--a" />
      <div className="splash-orbit splash-orbit--b" />
      <div className="splash-orbit splash-orbit--c" />

      {/* Logo block with tilt + shine */}
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={spinOnce}
        className="relative select-none"
        style={{ perspective: '900px' }}
      >
        <img
          src={logo}
          alt="Logo"
          className={`splash-logo3d ${spin ? 'splash-spin-once' : ''}`}
        />
        {/* sheen sweep */}
        <div className="splash-shine" />
      </div>
    </div>
  )
}