import { CheckCircle, XCircle } from "lucide-react"

export default function AccessLog({ logs, compact = false }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Belum ada riwayat akses.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 py-2.5">
          {log.status === "accepted"
            ? <CheckCircle size={16} className="text-green-500 shrink-0" />
            : <XCircle size={16} className="text-red-400 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 font-medium truncate">
              {log.cardName || "Tidak dikenal"}
            </p>
            {!compact && (
              <p className="text-xs text-gray-400 font-mono">{log.uid}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              log.status === "accepted"
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-500"
            }`}>
              {log.status === "accepted" ? "Diterima" : "Ditolak"}
            </span>
            <p className="text-xs text-gray-400 mt-0.5">{log.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}