import { useState } from 'react'
import { X, Save, DollarSign } from 'lucide-react'

function ExpenseModal({ onClose, onSave }) {
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title || !amount) return

        setLoading(true)
        try {
            await onSave({
                title,
                amount: parseFloat(amount),
                date: new Date().toISOString()
            })
            onClose()
        } catch (error) {
            console.error('Error saving expense:', error)
            alert('Gider kaydedilirken hata oluştu')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#1e293b] rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-red-400" />
                        Gider Ekle
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Açıklama / Başlık
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Örn: Elektrik Faturası, Mutfak Alışverişi..."
                            className="w-full bg-slate-800 border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 outline-none transition-all placeholder:text-slate-600"
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            Tutar (TL)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-800 border-slate-700 text-slate-100 rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-red-500/50 outline-none transition-all placeholder:text-slate-600 font-mono text-lg"
                                required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">TL</span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 font-medium transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !title || !amount}
                            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    Kaydet
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ExpenseModal
