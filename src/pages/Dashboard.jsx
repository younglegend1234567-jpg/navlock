import { useState, useEffect, useCallback, useRef } from "react"
import toast from "react-hot-toast"
import { supabase } from "../lib/supabase"
import { createMqttClient, MQTT_TOPICS } from "../lib/mqtt"
import StatusCard from "../components/StatusCard"
import DoorControl from "../components/DoorControl"
import AccessLog from "../components/AccessLog"
import RFIDManager from "../components/RFIDManager"
import StatsChart from "../components/StatsChart"
import Notifications from "../components/Notifications"
import { Lock, Wifi, WifiOff, Bell, LayoutDashboard, ClipboardList, CreditCard } from "lucide-react"

function formatLog(row) {
  const createdAt = row.created_at ? new Date(row.created_at) : new Date()
  return {
    id: row.id,
    uid: row.uid,
    status: row.status,
    cardName: row.card_name,
    time: row.time || createdAt.toLocaleTimeString("id-ID"),
    date: row.date || createdAt.toISOString().slice(0, 10),
    read: row.read,
  }
}

export default function Dashboard() {
  const [doorStatus, setDoorStatus] = useState("locked")
  const [logs, setLogs] = useState([])
  const [cards, setCards] = useState([])
  const [online, setOnline] = useState(false)
  const [lastSeen, setLastSeen] = useState("-")
  const [stats, setStats] = useState({ accepted: 0, denied: 0, total: 0, lastOpen: "-" })
  const [unreadNotif, setUnreadNotif] = useState(0)
  const [activeTab, setActiveTab] = useState("dashboard")
  const mqttClientRef = useRef(null)

  const refreshLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("access_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Failed to load logs:", error)
      toast.error("Gagal memuat log akses.")
      return
    }

    const arr = (data || []).map(formatLog)
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
  }, [])

  const refreshCards = useCallback(async () => {
    const { data, error } = await supabase
      .from("rfid_cards")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Failed to load cards:", error)
      toast.error("Gagal memuat kartu RFID.")
      return
    }

    setCards(data || [])
  }, [])

  const refreshDoorState = useCallback(async () => {
    const { data, error } = await supabase
      .from("door_states")
      .select("*")
      .eq("id", "main")
      .maybeSingle()

    if (error) {
      console.error("Failed to load door state:", error)
      return
    }

    if (data) {
      setDoorStatus(data.status || "locked")
      setOnline(data.online === true)
      setLastSeen(data.last_seen ? new Date(data.last_seen).toLocaleTimeString("id-ID") : "-")
    }
  }, [])

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      refreshDoorState()
      refreshLogs()
      refreshCards()
    }, 0)

    const channel = supabase
      .channel("navlock-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "access_logs" }, refreshLogs)
      .on("postgres_changes", { event: "*", schema: "public", table: "rfid_cards" }, refreshCards)
      .on("postgres_changes", { event: "*", schema: "public", table: "door_states" }, refreshDoorState)
      .subscribe()

    return () => {
      clearTimeout(loadTimer)
      supabase.removeChannel(channel)
    }
  }, [refreshCards, refreshDoorState, refreshLogs])

  useEffect(() => {
    const client = createMqttClient()
    if (!client) return

    const handleConnect = () => {
      client.subscribe([MQTT_TOPICS.status, MQTT_TOPICS.online, MQTT_TOPICS.log])
    }

    const handleMessage = (topic, payload) => {
      const message = payload.toString()

      if (topic === MQTT_TOPICS.status) {
        setDoorStatus(message)
        setLastSeen(new Date().toLocaleTimeString("id-ID"))
      }

      if (topic === MQTT_TOPICS.online) {
        setOnline(message === "true" || message === "1" || message === "online")
        setLastSeen(new Date().toLocaleTimeString("id-ID"))
      }

      if (topic === MQTT_TOPICS.log) {
        refreshLogs()
      }
    }

    client.on("connect", handleConnect)
    client.on("message", handleMessage)
    client.on("error", (error) => console.error("MQTT error:", error))
    mqttClientRef.current = client

    return () => {
      client.off("connect", handleConnect)
      client.off("message", handleMessage)
      client.end(true)
      mqttClientRef.current = null
    }
  }, [refreshLogs])

  const sendCommand = async (cmd) => {
    try {
      const mqttClient = mqttClientRef.current
      if (mqttClient?.connected) {
        mqttClient.publish(MQTT_TOPICS.command, cmd, { qos: 1, retain: false })
      }

      const { error } = await supabase.from("door_states").upsert({
        id: "main",
        command: cmd,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error

      toast.success(`Perintah ${cmd === "unlock" ? "buka" : "kunci"} terkirim`)
    } catch (error) {
      console.error("Failed to send door command:", error)
      toast.error("Gagal mengirim perintah pintu. Coba lagi.")
    }
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "logs", label: "Log Akses", icon: ClipboardList },
    { id: "cards", label: "Kartu RFID", icon: CreditCard },
    { id: "notif", label: "Notifikasi", icon: Bell },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
      <div className="bg-white border border-gray-200 rounded-3xl px-4 py-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sticky top-4 z-10">
        <div className="flex items-center gap-2">
          <Lock size={20} className="text-blue-600" />
          <div>
            <p className="font-semibold text-gray-800 text-base">Smart Door Lock</p>
            <p className="text-xs text-gray-500">Kontrol pintu dan akses RFID</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
            {online ? <Wifi size={14} className="text-green-600" /> : <WifiOff size={14} className="text-red-500" />}
            {online ? "ESP32 online" : "Offline"}
          </div>
          <div className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 border border-gray-200">
            <Bell size={18} className="text-gray-500" />
            {unreadNotif > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{unreadNotif}</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
          {tabs.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-3xl border px-3 py-4 text-xs font-semibold transition ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700"
                }`}
              >
                <div className={`inline-flex items-center justify-center rounded-2xl p-2 ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  <Icon size={18} />
                </div>
                <span>{t.label}</span>
                {t.id === "notif" && unreadNotif > 0 && (
                  <span className="absolute translate-y-[-42px] translate-x-[15px] rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{unreadNotif}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="py-5 space-y-4">
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <StatusCard label="Akses diterima" value={stats.accepted} sub="Hari ini" color="green" />
              <StatusCard label="Akses ditolak" value={stats.denied} sub="Hari ini" color="red" />
              <StatusCard label="Kartu terdaftar" value={cards.length} sub="Aktif" color="blue" />
              <StatusCard label="Terakhir dibuka" value={stats.lastOpen} sub={lastSeen === "-" ? "Waktu" : `ESP32 ${lastSeen}`} color="gray" />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
              <DoorControl status={doorStatus} onCommand={sendCommand} />
              <div className="bg-white rounded-3xl border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Log terbaru</h3>
                <AccessLog logs={logs.slice(0, 5)} compact />
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Statistik akses harian</h3>
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
