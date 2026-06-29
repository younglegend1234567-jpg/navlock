import { Lock, Unlock, Clock } from "lucide-react"

export default function DoorControl({ status, onCommand }) {
  const isLocked = status === "locked"

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Status pintu</h3>

      <div className="flex flex-col items-center py-2">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 transition-colors ${
          isLocked ? "bg-green-50" : "bg-yellow-50"
        }`}>
          {isLocked
            ? <Lock size={36} className="text-green-500" />
            : <Unlock size={36} className="text-yellow-500" />
          }
        </div>
        <p className="text-xl font-semibold text-gray-800">
          {isLocked ? "Terkunci" : "Terbuka"}
        </p>
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <Clock size={11} />
          {isLocked ? "Pintu aman" : "Pintu sedang terbuka"}
        </p>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onCommand("unlock")}
          disabled={!isLocked}
          className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
        >
          <Unlock size={14} /> Buka manual
        </button>
        <button
          onClick={() => onCommand("lock")}
          disabled={isLocked}
          className="flex-1 py-2.5 rounded-lg border border-blue-300 bg-blue-50 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
        >
          <Lock size={14} /> Kunci manual
        </button>
      </div>
    </div>
  )
}