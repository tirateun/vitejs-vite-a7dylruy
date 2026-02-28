import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import VentasDiarias from './pages/VentasDiarias'
import CierreInventario from './pages/CierreInventario'
import Compras from './pages/Compras'
import MermaAnalisis from './pages/MermaAnalisis'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs font-mono text-[var(--text-muted)]">Cargando sistema...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/ventas"    element={<ProtectedRoute><VentasDiarias /></ProtectedRoute>} />
      <Route path="/cierre"    element={<ProtectedRoute><CierreInventario /></ProtectedRoute>} />
      <Route path="/compras"   element={<ProtectedRoute><Compras /></ProtectedRoute>} />
      <Route path="/merma"     element={<ProtectedRoute><MermaAnalisis /></ProtectedRoute>} />
      <Route path="*"          element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
