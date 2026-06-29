import { useState, useEffect } from "react"
import { db } from "../firebase"
import { ref, onValue, set, push } from "firebase/database"
import toast from "react-hot-toast"
import StatusCard from "../components/StatusCard"
import DoorControl from "../components/DoorControl"
import AccessLog from "../components/AccessLog"
import RFIDManager from "../components/RFIDManager"
import StatsChart from "../components/StatsChart"
import Notifications from "../components/Notifications"
import { Lock, Wifi, WifiOff, Bell } from "lucide-react"

export default function Dashboard() {
  const [doorStatus, setDoorStatus] = useState("locked")
  const [logs, setLogs] = useState([])
  const [cards, setCards] = useState([])
  const [online, setOnline] = useState(false)
  const [stats, setStats] = useState({ accepted: 0, denied: 0, total: 0, lastOpen: "-" })
  const [unreadNotif, setUnreadNotif] = useState(0)
  const [activeTab, setActiveTab] = useState("dashboard")

  useEffect(() => {
    // Listen door status
    const doorRef = ref(db, "smart-door-lock/door")
    const unsubDoor = onValue(doorRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val()
        setDoorStatus(data.status || "locked")
        setOnline(true)
      }
    })

    // Listen logs
    const logsRef = ref(db, "smart-door-lock/logs")
    const unsubLogs = onValue(logsRef, (snap) => {
      if (snap.exists()) {
        const raw = snap.val()
        const arr = Object.entries(raw)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.id - a.id)
          .slice(0, 50)
        setLogs(arr)

        const accepted = arr.filter(l => l.status === "accepted").length
        const denied = arr.filter(l => l.status === "denied").length
        const lastAccepted = arr.find(l => l.status === "accepted")
        setStats({
          accepted,
          denied,
          total: arr.length,
          lastOpen: lastAccepted?.time || "-"
        })
        setUnreadNotif(arr.filter(l => l.status === "denied" && !l.read).length)
      }
    })

    // Listen cards
    const cardsRef = ref(db, "smart-door-lock/cards")
    const unsubCards = onValue(cardsRef, (snap) => {
      if (snap.exists()) {
        const raw = snap.val()
        const arr = Object.entries(raw).map(([id, v]) => ({ id, ...v }))
        setCards(arr)
      }
    })

    return () => {
      unsubDoor()
      unsubLogs()
      unsubCards()
    }
  }, [])

  const sendCommand = async (cmd) => {
    try {
      await set(ref(db, "smart-door-lock/door/command"), cmd)
      toast.success(`Perintah ${cmd === "unlock" ? "buka" : "kunci"} terkirim`)
    } catch (error) {
      console.error("Failed to send door command:", error)
      toast.error("Gagal mengirim perintah pintu. Coba lagi.")
    }
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "logs", label: "Log Akses" },
    { id: "cards", label: "Kartu RFID" },
    { id: "notif", label: "Notifikasi" },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-0">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Lock size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-800 text-base">Smart Door Lock</span>
        </div>
        <div className="flex items-center gap-3">
          {online
            ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><Wifi size={13} /> ESP32 online</span>
            : <span className="flex items-center gap-1 text-red-400 text-xs"><WifiOff size={13} /> Offline</span>
          }
          <div className="relative">
            <Bell size={18} className="text-gray-500" />
            {unreadNotif > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{unreadNotif}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.id === "notif" && unreadNotif > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{unreadNotif}</span>
            )}
          </button>
        ))}
      </div>

      <div className="py-5 space-y-4">
        {activeTab === "dashboard" && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatusCard label="Akses diterima" value={stats.accepted} sub="Hari ini" color="green" />
              <StatusCard label="Akses ditolak" value={stats.denied} sub="Hari ini" color="red" />
              <StatusCard label="Kartu terdaftar" value={cards.length} sub="Aktif" color="blue" />
              <StatusCard label="Terakhir dibuka" value={stats.lastOpen} sub="Waktu" color="gray" />
            </div>

            {/* Door control + recent log */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DoorControl status={doorStatus} onCommand={sendCommand} />
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Log terbaru</h3>
                <AccessLog logs={logs.slice(0, 5)} compact />
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Statistik akses harian</h3>
              <StatsChart logs={logs} />
            </div>
          </>
        )}

        {activeTab === "logs" && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Semua riwayat akses</h3>
            <AccessLog logs={logs} />
          </div>
        )}

        {activeTab === "cards" && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <RFIDManager cards={cards} />
          </div>
        )}

        {activeTab === "notif" && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Notifications logs={logs.filter(l => l.status === "denied")} />
          </div>
        )}
      </div>
    </div>
  )
}