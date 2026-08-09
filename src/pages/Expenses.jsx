import { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, Search, TrendingDown } from 'lucide-react'
import Helper from '../utils/Helper'
import ExpenseModal from '../components/ExpenseModal'

function Expenses() {
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [expenseToDelete, setExpenseToDelete] = useState(null)
    const now = new Date()
    const [startDate, setStartDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
    const [endDate, setEndDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)

    useEffect(() => {
        loadExpenses()
    }, [startDate, endDate])

    const loadExpenses = async () => {
        setLoading(true)
        if (window.api) {
            try {
                const data = await window.api.expenses.getByDateRange(startDate, endDate)
                setExpenses(data)
            } catch (err) {
                console.error('Error loading expenses:', err)
            }
        } else {
            // Demo data
            setExpenses([
                { id: 1, title: 'Elektrik Faturası', amount: 450.50, date: '2025-02-10 14:30:00' },
                { id: 2, title: 'Mutfak Alışverişi', amount: 150.00, date: '2025-02-11 09:15:00' },
                { id: 3, title: 'Personel Yemeği', amount: 200.00, date: '2025-02-12 12:00:00' }
            ])
        }
        setLoading(false)
    }

    const handleAddExpense = async (expenseData) => {
        if (window.api) {
            await window.api.expenses.add(expenseData)
            loadExpenses()
        } else {
            const newExpense = {
                id: Date.now(),
                ...expenseData,
                date: new Date().toISOString()
            }
            setExpenses([newExpense, ...expenses])
        }
    }

    const handleDelete = (expense) => {
        setExpenseToDelete(expense)
        setShowDeleteModal(true)
    }

    const confirmDelete = async () => {
        if (!expenseToDelete) return

        if (window.api) {
            await window.api.expenses.delete(expenseToDelete.id)
            loadExpenses()
        } else {
            setExpenses(expenses.filter(e => e.id !== expenseToDelete.id))
        }
        setShowDeleteModal(false)
        setExpenseToDelete(null)
    }

    const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0)

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 bg-[#1e293b] p-2 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-400 ml-2" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-slate-200 border-none outline-none p-2"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-slate-200 border-none outline-none p-2"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-red-500/10 px-6 py-3 rounded-xl border border-red-500/20 flex flex-col items-end">
                        <span className="text-xs text-red-400 font-medium">TOPLAM GİDER</span>
                        <span className="text-2xl font-bold text-red-400">{Helper.formatCurrency(totalAmount)}</span>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="btn-primary bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-xl flex items-center gap-2 shadow-lg shadow-red-900/20"
                    >
                        <Plus size={20} />
                        Gider Ekle
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50 bg-slate-800/30">
                                <th className="text-left p-4 text-slate-400 font-medium w-48">Tarih</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Açıklama</th>
                                <th className="text-right p-4 text-slate-400 font-medium w-48">Tutar</th>
                                <th className="text-center p-4 text-slate-400 font-medium w-24">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500">
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : expenses.length > 0 ? (
                                expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-700/10 transition-colors group">
                                        <td className="p-4 text-slate-400">
                                            {Helper.formatDate(expense.date)}
                                        </td>
                                        <td className="p-4 text-slate-200 font-medium">
                                            {expense.title}
                                        </td>
                                        <td className="p-4 text-right text-red-400 font-bold font-mono text-lg">
                                            -{Helper.formatCurrency(expense.amount)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleDelete(expense)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Sil"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-500">
                                            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                                                <TrendingDown size={32} />
                                            </div>
                                            <p>Bu tarih aralığında hiç gider kaydı yok.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <ExpenseModal
                    onClose={() => setShowModal(false)}
                    onSave={handleAddExpense}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="glass-card rounded-2xl w-full max-w-sm p-6 m-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-100 mb-2">Emin misiniz?</h3>
                        <p className="text-slate-400 mb-6">
                            Bu gider kaydını silmek üzeresiniz. Bu işlem geri alınamaz.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow-lg shadow-red-900/20"
                            >
                                Evet, Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Expenses
