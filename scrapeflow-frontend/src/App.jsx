import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Dashboard from './pages/Dashboard'
import Catalog from './pages/Catalog'
import AdminPanel from './pages/AdminPanel'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/catalog" 
          element={
            <ProtectedRoute>
              <Catalog />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App