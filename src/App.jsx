import { useState } from "react"
import Dashboard from "./pages/Dashboard"
import { Toaster } from "./components/Toaster"

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      <Dashboard />
    </div>
  )
}