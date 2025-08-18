import { createPortal } from 'react-dom'
import { useEffect, useMemo } from 'react'
import DarkVeil from './DarkVeil'

export default function GlobalBackground({ children }) {
  // Create a dedicated root on <body> so layout wrappers can't clip it
  const mount = useMemo(() => {
    const el = document.createElement('div')
    el.setAttribute('data-bg-root', 'dark-veil')
    return el
  }, [])

  useEffect(() => {
    document.body.appendChild(mount)
    return () => { document.body.removeChild(mount) }
  }, [mount])

  // Styles: full viewport, behind all content, ignore pointer events
  const bg = (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,            // push behind everything
        pointerEvents: 'none', // never block clicks
      }}
    >
      <DarkVeil
        hueShift={0}
        noiseIntensity={0.06}
        scanlineIntensity={0.15}
        scanlineFrequency={0.08}
        speed={0.5}
        warpAmount={0.12}
        resolutionScale={1}    // lower to 0.75/0.5 if needed
      />
    </div>
  )

  return (
    <>
      {createPortal(bg, mount)}
      {/* normal app content */}
      <div style={{ position: 'relative', zIndex: 0 }}>{children}</div>
    </>
  )
}