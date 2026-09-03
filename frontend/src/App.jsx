import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Payments from './pages/Payments'
import PaymentDetail from './pages/PaymentDetail'
import Analytics from './pages/Analytics'
import AuditTrail from './pages/AuditTrail'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/:id" element={<PaymentDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/audit" element={<AuditTrail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
