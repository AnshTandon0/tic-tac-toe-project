import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { NakamaProvider } from 'context/NakamaContext'
import ProtectedRoute from 'components/layout/ProtectedRoute'
import LoginPage   from 'pages/LoginPage'
import LobbyPage   from 'pages/LobbyPage'
import GamePage    from 'pages/GamePage'
import ResultsPage from 'pages/ResultsPage'

const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/lobby',   element: <LobbyPage />   },
      { path: '/game',    element: <GamePage />    },
      { path: '/results', element: <ResultsPage /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/',      element: <Navigate to="/login" replace /> },
])

export default function App() {
  return (
    <NakamaProvider>
      <RouterProvider router={router} />
    </NakamaProvider>
  )
}
