import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import App from './App'
import './index.css'
import GlobalBackground from './components/GlobalBackground'
import SplashScreen from './components/SplashScreen'

function Root() {
  const { hydrated } = useAuth()
  const [minDelayDone, setMinDelayDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinDelayDone(true), 400) // prevents blink on fast loads
    return () => clearTimeout(t)
  }, [])

  const ready = hydrated && minDelayDone

  return (
    <>
      <SplashScreen ready={ready} />
      <GlobalBackground>
        <App />
      </GlobalBackground>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)