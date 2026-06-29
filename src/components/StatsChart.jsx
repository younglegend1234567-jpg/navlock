import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"

function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      date: d.toISOString().slice(0, 10),
      accepted: 0,
      denied: 0
    })
  }
  return days
}

export default function StatsChart({ logs }) {
  const days = getLast7Days()

  logs.forEach(log => {
    const logDate = log.date || new Date().toISOString().slice(0, 10)
    const day = days.find(d => d.date === logDate)
    if (day) {
      if (log.status === "accepted") day.accepted++
      else if (log.status === "denied") day.denied++
    }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={days} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(val, name) => [val, name === "accepted" ? "Diterima" : "Ditolak"]}
          labelFormatter={(l) => `Hari: ${l}`}
        />
        <Legend formatter={(val) => val === "accepted" ? "Diterima" : "Ditolak"} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="accepted" fill="#22c55e" radius={[3,3,0,0]} />
        <Bar dataKey="denied" fill="#f87171" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}