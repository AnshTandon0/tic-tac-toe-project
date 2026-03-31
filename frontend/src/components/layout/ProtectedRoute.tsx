import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useNakama } from 'hooks/useNakama'
import { useSocket } from 'hooks/useSocket'

export default function ProtectedRoute() {
  const { session } = useNakama()
  const navigate = useNavigate()
  useSocket(navigate)
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
