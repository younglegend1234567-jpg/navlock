import { useState } from "react"
import { db } from "../firebase"
import { ref, push, remove, update } from "firebase/database"
import toast from "react-hot-toast"
import { CreditCard, Trash2, Edit2, Plus, Check, X } from "lucide-react"

function normalizeUid(uid) {
  return uid.trim().toUpperCase().replace(/[^0-9A-F]/g, "")
}

function isValidUid(uid) {
  const normalized = normalizeUid(uid)
  return /^[0-9A-F]{8,}$/i.test(normalized)
}

export default function RFIDManager({ cards }) {
  const [adding, setAdding] = useState(false)
  const [newUID, setNewUID] = useState("")
  const [newName, setNewName] = useState("")
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState("")

  const addCard = async () => {
    const uid = newUID.trim()
    const name = newName.trim()

    if (!uid || !name) {
      toast.error("UID dan nama kartu wajib diisi.")
      return
    }

    if (!isValidUid(uid)) {
      toast.error("UID tidak valid. Gunakan karakter heksadesimal yang benar.")
      return
    }

    const normalizedUid = normalizeUid(uid)
    const duplicate = cards.some(card => normalizeUid(card.uid) === normalizedUid)
    if (duplicate) {
      toast.error("UID ini sudah terdaftar.")
      return
    }

    try {
      await push(ref(db, "smart-door-lock/cards"), {
        uid: uid.toUpperCase(),
        name
      })
      toast.success("Kartu RFID berhasil ditambahkan.")
      setNewUID("")
      setNewName("")
      setAdding(false)
    } catch (error) {
      console.error("Failed to add card:", error)
      toast.error("Gagal menambahkan kartu. Coba lagi.")
    }
  }

  const deleteCard = async (id) => {
    if (!confirm("Hapus kartu ini?")) return
    try {
      await remove(ref(db, `smart-door-lock/cards/${id}`))
      toast.success("Kartu berhasil dihapus.")
    } catch (error) {
      console.error("Failed to delete card:", error)
      toast.error("Gagal menghapus kartu. Coba lagi.")
    }
  }

  const saveEdit = async (id) => {
    const name = editName.trim()
    if (!name) {
      toast.error("Nama kartu tidak boleh kosong.")
      return
    }

    try {
      await update(ref(db, `smart-door-lock/cards/${id}`), { name })
      toast.success("Nama kartu berhasil diperbarui.")
      setEditId(null)
    } catch (error) {
      console.error("Failed to update card:", error)
      toast.error("Gagal memperbarui kartu. Coba lagi.")
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Kartu RFID terdaftar</h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus size={13} /> Tambah kartu
        </button>
      </div>

      {adding && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
          <p className="text-xs text-gray-500 font-medium">Kartu baru</p>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="UID kartu (contoh: 9F:3A:2B:FA)"
            value={newUID}
            onChange={e => setNewUID(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Nama kartu (contoh: Kartu ibu)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={addCard}
              className="flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check size={13} /> Simpan
            </button>
            <button
              onClick={() => { setAdding(false); setNewUID(""); setNewName("") }}
              className="flex items-center gap-1 text-xs text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={13} /> Batal
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Belum ada kartu terdaftar.</p>
      )}

      <div className="divide-y divide-gray-100">
        {cards.map(card => (
          <div key={card.id} className="flex items-center gap-3 py-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <CreditCard size={15} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              {editId === card.id ? (
                <input
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                />
              ) : (
                <p className="text-sm font-medium text-gray-700">{card.name}</p>
              )}
              <p className="text-xs font-mono text-blue-500 mt-0.5">{card.uid}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {editId === card.id ? (
                <>
                  <button onClick={() => saveEdit(card.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X size={14} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(card.id); setEditName(card.name) }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => deleteCard(card.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}