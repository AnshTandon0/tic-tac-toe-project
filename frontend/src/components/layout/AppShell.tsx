import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="logo">Tic-Tac-Toe</span>
      </header>
      <main className="page-content">
        {children}
      </main>
    </div>
  )
}
