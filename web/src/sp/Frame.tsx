import { Outlet } from 'react-router-dom'
import { AppProvider, useApp } from './state'

function Inner() {
  const { dark } = useApp()
  return <div className={`sp ${dark ? 'dark' : ''}`}><Outlet /></div>
}

export function Frame() {
  return <AppProvider><Inner /></AppProvider>
}
