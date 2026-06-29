import { AlertTriangle, Clock } from "lucide-react"

export default function Notifications({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-10">
        <AlertTriangle size={28} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Tidak ada notifikasi akses ditolak.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Notifikasi akses ditolak</h3>
      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id} className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-700 font-medium">Kartu tidak dikenal terdeteksi</p>
              <p className="text-xs font-mono text-red-400 mt-0.5">{log.uid}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-red-400 shrink-0">
              <Clock size={11} />
              {log.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}