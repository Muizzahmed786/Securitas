import { BrowserRouter, Navigate, Outlet, Route, Routes, Link } from 'react-router-dom'
import AuthProvider from './context/AuthProvider'
import { useAuth } from './context/AuthContext'
import { Spinner } from './components/UI'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Signatures from './pages/Signatures'
import Keys from './pages/Keys'
import Profile from './pages/Profile'
import Landing from './pages/Landing'
function ProtectedRoute({ permissions }: { permissions?: string[] }) {
  const { user, loading, permissionsLoading, can, permissionError } = useAuth()
  if (loading) return <div role="status" className="flex min-h-screen items-center justify-center gap-2 bg-blue-50 text-sm text-slate-500"><Spinner />Opening your workspace…</div>
  if (!user) return <Navigate to="/login" replace />
  if (permissions && permissionsLoading) return <div role="status" className="flex items-center gap-2 p-8 text-sm text-slate-500"><Spinner />Loading permissions…</div>
  if (permissions && !permissions.some(can)) return <div className="p-8"><h1 className="text-xl font-bold text-slate-800">This action is unavailable</h1><p className="my-4 text-sm text-slate-500">{permissionError || 'Your account does not have permission to use this page.'}</p><Link to="/workspace/dashboard" className="btn-secondary">Back to dashboard</Link></div>
  return <Outlet />
}
export default function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/" element={<Navigate to="/home" replace />} /><Route path="/home" element={<Landing />} /><Route path="/login" element={<Auth />} /><Route path="/register" element={<Auth register />} /><Route element={<ProtectedRoute />}><Route path="/workspace" element={<Layout />}><Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<Dashboard />} /><Route path="profile" element={<Profile />} /><Route element={<ProtectedRoute permissions={['documents.upload']} />}><Route path="upload" element={<Upload />} /></Route><Route element={<ProtectedRoute permissions={['documents.sign','documents.verify']} />}><Route path="signatures" element={<Signatures />} /></Route><Route element={<ProtectedRoute permissions={['crypto_keys.create']} />}><Route path="keys" element={<Keys />} /></Route></Route></Route><Route path="*" element={<div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-50"><h1 className="text-3xl font-bold text-slate-800">Page not found</h1><Link to="/home" className="btn-primary">Back to home</Link></div>} /></Routes></AuthProvider></BrowserRouter>
}
