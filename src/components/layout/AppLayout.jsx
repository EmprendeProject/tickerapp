import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Topbar />
        <Outlet />
      </main>
    </div>
  )
}
