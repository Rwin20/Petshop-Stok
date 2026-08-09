import { useState, useEffect } from 'react'
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    X,
    Save,
    Users,
    Wallet,
    CreditCard,
    ArrowDownCircle,
    ArrowUpCircle,
    Phone,
    FileText,
    Eye,
    ChevronLeft
} from 'lucide-react'

function Customers() {
    const [customers, setCustomers] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [transactions, setTransactions] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [transactionForm, setTransactionForm] = useState({ amount: '', description: '', type: 'debt' })
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        notes: ''
    })

    useEffect(() => {
        loadCustomers()
        loadStats()
    }, [])

    const loadCustomers = async () => {
        if (window.api) {
            try {
                const data = await window.api.customers.getAll()
                setCustomers(data)
            } catch (err) {
                console.error('Error loading customers:', err)
            }
        } else {
            // Demo data
            setCustomers([
                { id: 1, name: 'Ahmet Yılmaz', phone: '0532 123 4567', total_debt: 450, total_paid: 200 },
                { id: 2, name: 'Fatma Demir', phone: '0533 234 5678', total_debt: 320, total_paid: 320 },
                { id: 3, name: 'Mehmet Kaya', phone: '0534 345 6789', total_debt: 780, total_paid: 100 },
                { id: 4, name: 'Ayşe Çelik', phone: '0535 456 7890', total_debt: 150, total_paid: 0 },
            ])
        }
        setLoading(false)
    }

    const loadStats = async () => {
        if (window.api) {
            try {
                const data = await window.api.customers.getDebtStats()
                setStats(data)
            } catch (err) {
                console.error('Error loading stats:', err)
            }
        } else {
            setStats({
                total_debt: 1700,
                total_paid: 620,
                outstanding: 1080,
                customer_count: 4,
                debtor_count: 3
            })
        }
    }

    const loadTransactions = async (customerId) => {
        if (window.api) {
            try {
                const data = await window.api.credit.getTransactions(customerId)
                setTransactions(data)
            } catch (err) {
                console.error('Error loading transactions:', err)
            }
        } else {
            // Demo data
            setTransactions([
                { id: 1, type: 'debt', amount: 250, description: 'Kedi maması', transaction_date: '2025-02-06 14:30:00' },
                { id: 2, type: 'payment', amount: 100, description: 'Nakit ödeme', transaction_date: '2025-02-05 10:15:00' },
                { id: 3, type: 'debt', amount: 200, description: 'Köpek tasması', transaction_date: '2025-02-03 16:45:00' },
            ])
        }
    }

    const handleSearch = async (query) => {
        setSearchQuery(query)
        if (window.api && query) {
            try {
                const data = await window.api.customers.search(query)
                setCustomers(data)
            } catch (err) {
                console.error('Error searching customers:', err)
            }
        } else if (!query) {
            loadCustomers()
        }
    }

    const openModal = (customer = null) => {
        if (customer) {
            setEditingCustomer(customer)
            setFormData({
                name: customer.name,
                phone: customer.phone || '',
                notes: customer.notes || ''
            })
        } else {
            setEditingCustomer(null)
            setFormData({ name: '', phone: '', notes: '' })
        }
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingCustomer(null)
    }

    const openDetailModal = async (customer) => {
        setSelectedCustomer(customer)
        await loadTransactions(customer.id)
        setTransactionForm({ amount: '', description: '', type: 'debt' })
        setShowDetailModal(true)
    }

    const closeDetailModal = () => {
        setShowDetailModal(false)
        setSelectedCustomer(null)
        setTransactions([])
    }

    const handleSave = async () => {
        const customerData = {
            name: formData.name,
            phone: formData.phone,
            notes: formData.notes
        }

        if (window.api) {
            try {
                if (editingCustomer) {
                    await window.api.customers.update(editingCustomer.id, customerData)
                } else {
                    await window.api.customers.create(customerData)
                }
                loadCustomers()
                loadStats()
            } catch (err) {
                console.error('Error saving customer:', err)
                alert(`Hata: ${err.message || 'Müşteri kaydedilemedi!'}`)
                return
            }
        } else {
            if (editingCustomer) {
                setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...customerData, id: editingCustomer.id, total_debt: c.total_debt, total_paid: c.total_paid } : c))
            } else {
                setCustomers(prev => [...prev, { ...customerData, id: Date.now(), total_debt: 0, total_paid: 0 }])
            }
        }
        closeModal()
    }

    const handleDelete = async (id) => {
        if (!confirm('Bu müşteriyi ve tüm veresiye geçmişini silmek istediğinize emin misiniz?')) return

        if (window.api) {
            try {
                await window.api.customers.delete(id)
                loadCustomers()
                loadStats()
            } catch (err) {
                console.error('Error deleting customer:', err)
            }
        } else {
            setCustomers(prev => prev.filter(c => c.id !== id))
        }
    }

    const handleAddTransaction = async () => {
        const amount = parseFloat(transactionForm.amount)
        if (!amount || amount <= 0) return

        if (window.api) {
            try {
                if (transactionForm.type === 'debt') {
                    await window.api.credit.addDebt(selectedCustomer.id, amount, transactionForm.description)
                } else {
                    await window.api.credit.addPayment(selectedCustomer.id, amount, transactionForm.description)
                }
                await loadTransactions(selectedCustomer.id)
                loadCustomers()
                loadStats()

                // Update selected customer balance
                const updated = await window.api.customers.getById(selectedCustomer.id)
                setSelectedCustomer(updated)
            } catch (err) {
                console.error('Error adding transaction:', err)
                alert(`Hata: ${err.message || 'İşlem gerçekleştirilemedi!'}`)
                return
            }
        } else {
            setTransactions(prev => [{
                id: Date.now(),
                type: transactionForm.type,
                amount,
                description: transactionForm.description,
                transaction_date: new Date().toISOString()
            }, ...prev])

            // Update demo customer balance
            if (transactionForm.type === 'debt') {
                setSelectedCustomer(prev => ({ ...prev, total_debt: (prev.total_debt || 0) + amount }))
            } else {
                setSelectedCustomer(prev => ({ ...prev, total_paid: (prev.total_paid || 0) + amount }))
            }
        }

        setTransactionForm({ amount: '', description: '', type: 'debt' })
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value || 0)
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        // Ensure the date is treated as UTC
        const date = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'))
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getBalance = (customer) => {
        return (customer.total_debt || 0) - (customer.total_paid || 0)
    }

    // Backend zaten filtrelenmiş sonuç döndürüyor
    const filteredCustomers = customers

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-slate-400 text-sm">Toplam Müşteri</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-100">{stats?.customer_count || 0}</p>
                </div>

                <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-slate-400 text-sm">Toplam Veresiye</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(stats?.outstanding)}</p>
                </div>

                <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-slate-400 text-sm">Borçlu Müşteri</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-400">{stats?.debtor_count || 0}</p>
                </div>

                <div className="glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <ArrowDownCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-slate-400 text-sm">Toplam Tahsilat</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.total_paid)}</p>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Müşteri ara (isim veya telefon)..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500"
                    />
                </div>
                <button
                    onClick={() => openModal()}
                    className="btn-primary px-6 py-3 rounded-xl text-white font-medium flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Yeni Müşteri
                </button>
            </div>

            {/* Customers Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left p-4 text-slate-400 font-medium">Müşteri</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Telefon</th>
                                <th className="text-right p-4 text-slate-400 font-medium">Toplam Borç</th>
                                <th className="text-right p-4 text-slate-400 font-medium">Ödenen</th>
                                <th className="text-right p-4 text-slate-400 font-medium">Bakiye</th>
                                <th className="text-center p-4 text-slate-400 font-medium">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map((customer) => {
                                const balance = getBalance(customer)

                                return (
                                    <tr key={customer.id} className="table-row border-b border-slate-700/30">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-violet-600/30 flex items-center justify-center">
                                                    <span className="text-purple-300 font-semibold">{customer.name.charAt(0)}</span>
                                                </div>
                                                <span className="text-slate-100 font-medium">{customer.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-400">{customer.phone || '-'}</td>
                                        <td className="p-4 text-right text-slate-300">{formatCurrency(customer.total_debt)}</td>
                                        <td className="p-4 text-right text-green-400">{formatCurrency(customer.total_paid)}</td>
                                        <td className="p-4 text-right">
                                            <span className={`font-semibold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                {formatCurrency(balance)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openDetailModal(customer)}
                                                    className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                                    title="Detay"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal(customer)}
                                                    className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(customer.id)}
                                                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredCustomers.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500">Müşteri bulunamadı</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Customer Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="glass-card rounded-2xl w-full max-w-md p-6 m-4">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-slate-100">
                                {editingCustomer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
                            </h3>
                            <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Müşteri Adı *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                    placeholder="Müşteri adını girin"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Telefon</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                        placeholder="0532 123 4567"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Notlar</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 resize-none"
                                    rows="3"
                                    placeholder="Opsiyonel notlar..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={closeModal}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!formData.name.trim()}
                                className="flex-1 btn-primary px-4 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Detail Modal */}
            {showDetailModal && selectedCustomer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="glass-card rounded-2xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <button onClick={closeDetailModal} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                                </button>
                                <div>
                                    <h3 className="text-xl font-semibold text-slate-100">{selectedCustomer.name}</h3>
                                    {selectedCustomer.phone && (
                                        <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>
                                    )}
                                </div>
                            </div>
                            <button onClick={closeDetailModal} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Balance Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="glass rounded-xl p-4 text-center">
                                <p className="text-sm text-slate-500 mb-1">Toplam Borç</p>
                                <p className="text-xl font-bold text-slate-100">{formatCurrency(selectedCustomer.total_debt)}</p>
                            </div>
                            <div className="glass rounded-xl p-4 text-center">
                                <p className="text-sm text-slate-500 mb-1">Ödenen</p>
                                <p className="text-xl font-bold text-green-400">{formatCurrency(selectedCustomer.total_paid)}</p>
                            </div>
                            <div className="glass rounded-xl p-4 text-center">
                                <p className="text-sm text-slate-500 mb-1">Kalan Bakiye</p>
                                <p className={`text-xl font-bold ${getBalance(selectedCustomer) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {formatCurrency(getBalance(selectedCustomer))}
                                </p>
                            </div>
                        </div>

                        {/* Add Transaction Form */}
                        <div className="glass rounded-xl p-4 mb-4">
                            <h4 className="text-sm font-medium text-slate-300 mb-3">İşlem Ekle</h4>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <select
                                    value={transactionForm.type}
                                    onChange={(e) => setTransactionForm(prev => ({ ...prev, type: e.target.value }))}
                                    className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 w-full sm:w-auto"
                                >
                                    <option value="debt">Borç Ekle</option>
                                    <option value="payment">Ödeme Al</option>
                                </select>
                                <input
                                    type="number"
                                    placeholder="Tutar"
                                    value={transactionForm.amount}
                                    onChange={(e) => setTransactionForm(prev => ({ ...prev, amount: e.target.value }))}
                                    className="flex-1 w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 min-w-0"
                                />
                                <input
                                    type="text"
                                    placeholder="Açıklama (opsiyonel)"
                                    value={transactionForm.description}
                                    onChange={(e) => setTransactionForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="flex-1 w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 min-w-0"
                                />
                                <button
                                    onClick={handleAddTransaction}
                                    disabled={!transactionForm.amount}
                                    className={`w-full sm:w-16 flex-shrink-0 h-10 sm:h-auto flex items-center justify-center rounded-xl text-white font-medium disabled:opacity-50 ${transactionForm.type === 'debt'
                                        ? 'bg-red-500 hover:bg-red-600'
                                        : 'bg-green-500 hover:bg-green-600'
                                        }`}
                                >
                                    {transactionForm.type === 'debt' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Transaction History */}
                        <div className="flex-1 overflow-auto">
                            <h4 className="text-sm font-medium text-slate-400 mb-3">İşlem Geçmişi</h4>
                            {transactions.length > 0 ? (
                                <div className="space-y-2">
                                    {transactions.map((tx) => (
                                        <div key={tx.id} className={`flex items-center justify-between p-3 rounded-xl ${tx.type === 'debt' ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                {tx.type === 'debt'
                                                    ? <ArrowUpCircle className="w-5 h-5 text-red-400" />
                                                    : <ArrowDownCircle className="w-5 h-5 text-green-400" />
                                                }
                                                <div>
                                                    <p className="text-slate-200">{tx.description || (tx.type === 'debt' ? 'Borç' : 'Ödeme')}</p>
                                                    <p className="text-xs text-slate-500">{formatDate(tx.transaction_date)}</p>
                                                </div>
                                            </div>
                                            <span className={`font-semibold ${tx.type === 'debt' ? 'text-red-400' : 'text-green-400'}`}>
                                                {tx.type === 'debt' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                                    <p className="text-slate-500">Henüz işlem yok</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Customers
