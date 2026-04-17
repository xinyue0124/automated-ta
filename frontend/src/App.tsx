import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useEffect } from 'react'
import Header from './components/Header'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import ChatPage from './pages/ChatPage'

function App() {
  const { token, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <Routes>
          <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/" />} />
          <Route path="/chat/:sessionId" element={token ? <ChatPage /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App

