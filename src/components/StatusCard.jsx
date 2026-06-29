const colorMap = {
  green: "text-green-600 bg-green-50",
  red:   "text-red-500 bg-red-50",
  blue:  "text-blue-600 bg-blue-50",
  gray:  "text-gray-600 bg-gray-50",
}

export default function StatusCard({ label, value, sub, color = "gray" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${colorMap[color].split(" ")[0]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}