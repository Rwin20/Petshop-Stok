import { useState, useEffect } from 'react'
import {
    Calendar,
    TrendingUp,
    DollarSign,
    ShoppingBag,
    ChevronLeft,
    ChevronRight,
    BarChart3,
    Download,
    Skull,
    CreditCard,
    Banknote,
    Landmark,
    TrendingDown,
    Trash2,
    Globe
} from 'lucide-react'

function Reports({ currentUser }) {
    const [activeTab, setActiveTab] = useState('daily')
    const now = new Date()
    const [selectedDate, setSelectedDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [dailyReport, setDailyReport] = useState(null)
    const [monthlyReport, setMonthlyReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [notification, setNotification] = useState(null)

    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [saleToDelete, setSaleToDelete] = useState(null)
    const [adminPin, setAdminPin] = useState('')
    const [pinError, setPinError] = useState('')

    const handleDeleteSale = (sale) => {
        setSaleToDelete(sale)
        setAdminPin('')
        setPinError('')
        setShowDeleteModal(true)
    }

    const confirmDelete = async () => {
        if (!saleToDelete) return

        if (!adminPin) {
            setPinError('Yönetici PIN kodu gerekli')
            return
        }

        try {
            await window.api.sales.delete(saleToDelete.id, adminPin)
            setNotification({ type: 'success', message: 'Satış başarıyla silindi ve stok geri yüklendi' })
            if (activeTab === 'daily') {
                loadDailyReport()
            } else {
                loadMonthlyReport()
            }
        } catch (error) {
            console.error('Delete error:', error)
            const errorMsg = error.message || 'Satış silinirken hata oluştu'
            if (errorMsg.includes('Yönetici şifresi') || errorMsg.includes('PIN')) {
                setPinError(errorMsg.replace('Error: ', ''))
                return // Don't close modal on pin error
            }
            setNotification({ type: 'error', message: 'Satış silinirken hata oluştu' })
        } finally {
            setShowDeleteModal(false)
            setSaleToDelete(null)
            setTimeout(() => setNotification(null), 3000)
        }
    }

    useEffect(() => {
        if (activeTab === 'daily') {
            loadDailyReport()
        } else {
            loadMonthlyReport()
        }
    }, [activeTab, selectedDate, selectedMonth, selectedYear])

    const loadDailyReport = async () => {
        setLoading(true)
        if (window.api) {
            try {
                const data = await window.api.reports.daily(selectedDate)
                // Fetch expenses for the day
                const expenses = await window.api.expenses.getByDate(selectedDate)
                setDailyReport({ ...data, expenses, total_expenses: expenses.reduce((sum, e) => sum + e.amount, 0) })
            } catch (err) {
                console.error('Error loading daily report:', err)
            }
        } else {
            // Demo data
            setDailyReport({
                total_sales: 15,
                total_revenue: 2680.50,
                total_profit: 745.00,
                total_items: 23,
                sales: [
                    { id: 1, product_name: 'Royal Canin Kedi Maması 2kg', quantity: 2, total_price: 900, profit: 200, sale_date: '2025-02-07 14:30:00' },
                    { id: 2, product_name: 'Kedi Kumu 10L', quantity: 3, total_price: 270, profit: 75, sale_date: '2025-02-07 13:15:00' },
                    { id: 3, product_name: 'Köpek Tasması M', quantity: 1, total_price: 85, profit: 40, sale_date: '2025-02-07 11:45:00' },
                    { id: 4, product_name: 'Whiskas Yavru Mama 1kg', quantity: 4, total_price: 640, profit: 160, sale_date: '2025-02-07 10:20:00' },
                    { id: 5, product_name: 'Balık Yemi 100g', quantity: 5, total_price: 75, profit: 25, sale_date: '2025-02-07 09:30:00' },
                ]
            })
        }
        setLoading(false)
    }

    const loadMonthlyReport = async () => {
        setLoading(true)
        if (window.api) {
            try {
                const data = await window.api.reports.monthly(selectedYear, selectedMonth)

                // Calculate start and end date for expenses
                const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
                const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31`
                const expenses = await window.api.expenses.getByDateRange(startDate, endDate)

                setMonthlyReport({ ...data, expenses, total_expenses: expenses.reduce((sum, e) => sum + e.amount, 0) })
            } catch (err) {
                console.error('Error loading monthly report:', err)
            }
        } else {
            // Demo data
            const days = []
            for (let i = 1; i <= 28; i++) {
                if (Math.random() > 0.3) {
                    days.push({
                        date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
                        sales_count: Math.floor(Math.random() * 20) + 5,
                        revenue: Math.random() * 5000 + 1000,
                        profit: Math.random() * 1500 + 300
                    })
                }
            }
            setMonthlyReport({
                total_sales: days.reduce((sum, d) => sum + d.sales_count, 0),
                total_revenue: days.reduce((sum, d) => sum + d.revenue, 0),
                total_profit: days.reduce((sum, d) => sum + d.profit, 0),
                total_items: days.reduce((sum, d) => sum + d.sales_count * 2, 0),
                daily_breakdown: days
            })
        }
        setLoading(false)
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        // Ensure the date is treated as UTC
        const date = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'))
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    }

    const formatTime = (dateStr) => {
        if (!dateStr) return '-'
        // Ensure the date is treated as UTC
        const date = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'))
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    }

    const monthNames = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ]

    const navigateMonth = (delta) => {
        let newMonth = selectedMonth + delta
        let newYear = selectedYear

        if (newMonth > 12) {
            newMonth = 1
            newYear++
        } else if (newMonth < 1) {
            newMonth = 12
            newYear--
        }

        setSelectedMonth(newMonth)
        setSelectedYear(newYear)
    }

    const handleExport = async () => {
        if (!window.api) return
        setExporting(true)

        try {
            let result
            if (activeTab === 'daily') {
                result = await window.api.export.daily(selectedDate)
            } else {
                result = await window.api.export.monthly(selectedYear, selectedMonth)
            }

            if (result && (result.buffer || result.text)) {
                const content = result.buffer || result.text
                const saveResult = await window.api.export.saveFile(result.filename, content)
                if (saveResult.success) {
                    alert(`Rapor başarıyla kaydedildi!\n${saveResult.path}`)
                }
            }
        } catch (err) {
            console.error('Export error:', err)
            alert('Rapor dışa aktarılırken hata oluştu')
        }

        setExporting(false)
        setExporting(false)
    }

    const handleEndOfDay = async () => {
        if (!dailyReport) return

        try {
            setExporting(true)

            // Format: YYYY-MM-DD_GunSonu.pdf
            // selectedDate is already "YYYY-MM-DD" string
            const filename = `${selectedDate}_GunSonu.pdf`

            const result = await window.api.export.daily(selectedDate)

            if (result && (result.buffer || result.text)) {
                const content = result.buffer || result.text
                const saveResult = await window.api.export.saveDailyReportAuto(filename, content)

                if (saveResult.success) {
                    alert(`Gün sonu raporu başarıyla kaydedildi!\nKlasör: Belgeler/PetshopStok/Raporlar\nDosya: ${filename}`)
                } else {
                    alert(`Hata: ${saveResult.error}`)
                }
            }
        } catch (err) {
            console.error('End of day export error:', err)
            alert('Gün sonu raporu alınırken hata oluştu')
        } finally {
            setExporting(false)
        }
    }

    const report = activeTab === 'daily' ? dailyReport : monthlyReport

    return (
        <>
            {/* Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-slate-100 mb-4">Satışı Sil</h3>
                        <p className="text-slate-300 mb-6">
                            Bu satışı silmek istediğinize emin misiniz?
                            <br />
                            <span className="text-orange-400 text-sm mt-2 block">
                                Dikkat: Ürün stoku ({saleToDelete?.quantity} adet) geri yüklenecektir.
                            </span>
                        </p>
                        <div className="mb-6">
                            <label className="block text-sm text-slate-400 mb-2">Yönetici PIN Kodu</label>
                            <input
                                type="password"
                                value={adminPin}
                                onChange={(e) => {
                                    setAdminPin(e.target.value)
                                    setPinError('')
                                }}
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                placeholder="****"
                                maxLength={4}
                                autoFocus
                            />
                            {pinError && <p className="text-red-400 text-sm mt-1">{pinError}</p>}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/30"
                            >
                                Evet, Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in ${notification.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                    {notification.type === 'success' ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <Skull className="w-5 h-5" />
                        </div>
                    )}
                    <div>
                        <h4 className="font-bold text-sm">
                            {notification.type === 'success' ? 'Başarılı' : 'Hata'}
                        </h4>
                        <p className="text-sm opacity-80">{notification.message}</p>
                    </div>
                </div>
            )}

            <div className="space-y-6 animate-fade-in">
                {/* Tabs */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'daily'
                            ? 'btn-primary text-white'
                            : 'glass text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Günlük Rapor
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'monthly'
                            ? 'btn-primary text-white'
                            : 'glass text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Aylık Rapor
                    </button>
                    <div className="flex gap-2">
                        {activeTab === 'daily' && (
                            <button
                                onClick={handleEndOfDay}
                                disabled={exporting || !dailyReport}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download size={18} />
                                {exporting ? 'İşleniyor...' : 'Gün Sonu Al'}
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            disabled={exporting || loading}
                            className="ml-auto flex items-center gap-2 px-6 py-3 rounded-xl font-medium glass text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
                        >
                            {exporting ? 'PDF Oluşturuluyor...' : (
                                <>
                                    <Download size={20} />
                                    PDF Rapor Al
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Date Selector */}
                <div className="glass-card rounded-2xl p-4">
                    {activeTab === 'daily' ? (
                        <div className="flex items-center gap-4">
                            <Calendar className="w-5 h-5 text-purple-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                            />
                            <span className="text-slate-400">
                                {new Date(selectedDate).toLocaleDateString('tr-TR', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Calendar className="w-5 h-5 text-purple-400" />
                            <button
                                onClick={() => navigateMonth(-1)}
                                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-slate-400" />
                            </button>
                            <span className="text-xl font-semibold text-slate-100 min-w-[180px] text-center">
                                {monthNames[selectedMonth - 1]} {selectedYear}
                            </span>
                            <button
                                onClick={() => navigateMonth(1)}
                                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="glass-card rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                                        <ShoppingBag className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-slate-400">Satış Adedi</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-100">{report?.total_sales || 0}</p>
                            </div>

                            <div className="glass-card rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                        <DollarSign className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-slate-400">Toplam Ciro</span>
                                </div>
                                <p className="text-3xl font-bold text-slate-100">{formatCurrency(report?.total_revenue || 0)}</p>
                            </div>

                            <div className="glass-card rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-slate-400">Net Kâr</span>
                                </div>
                                <p className="text-3xl font-bold text-green-400">
                                    {formatCurrency((report?.total_profit || 0) - (report?.total_waste_cost || 0) - (report?.total_expenses || 0))}
                                </p>
                            </div>

                            <div className="glass-card rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                                        <TrendingDown className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-slate-400">Giderler</span>
                                </div>
                                <p className="text-3xl font-bold text-orange-400">{formatCurrency(report?.total_expenses || 0)}</p>
                            </div>

                            <div className="glass-card rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                                        <Skull className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-slate-400">Zayi Maliyeti</span>
                                </div>
                                <p className="text-3xl font-bold text-red-400">{formatCurrency(report?.total_waste_cost || 0)}</p>
                            </div>
                        </div>

                        {/* Payment Breakdown Cards */}
                        {report?.payment_breakdown && report.payment_breakdown.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {report.payment_breakdown.map((item) => {
                                    let icon = <Banknote className="w-5 h-5 text-white" />
                                    let color = "from-green-500 to-emerald-600"
                                    let label = "Nakit"

                                    if (item.payment_method === 'kart') {
                                        icon = <CreditCard className="w-5 h-5 text-white" />
                                        color = "from-blue-500 to-cyan-600"
                                        label = "Kredi Kartı"
                                    } else if (item.payment_method === 'iban') {
                                        icon = <Landmark className="w-5 h-5 text-white" />
                                        color = "from-purple-500 to-violet-600"
                                        label = "IBAN"
                                    } else if (item.payment_method === 'online') {
                                        icon = <Globe className="w-5 h-5 text-white" />
                                        color = "from-orange-500 to-amber-600"
                                        label = "Online"
                                    }

                                    return (
                                        <div key={item.payment_method} className="glass-card rounded-2xl p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                                                        {icon}
                                                    </div>
                                                    <span className="text-slate-400 font-medium">{label}</span>
                                                </div>
                                                <span className="text-xs bg-slate-800/50 text-slate-400 px-3 py-1 rounded-full border border-slate-700/50">
                                                    {item.count} Satış
                                                </span>
                                            </div>
                                            <p className="text-3xl font-bold text-slate-100">{formatCurrency(item.total)}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Details */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-slate-100 mb-6">
                                {activeTab === 'daily' ? 'Satış Detayları' : 'Günlük Dağılım'}
                            </h3>

                            {activeTab === 'daily' ? (
                                <>
                                    <div className="overflow-x-auto">
                                        {dailyReport?.sales?.length > 0 ? (
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-700/50">
                                                        <th className="text-left p-3 text-slate-400 font-medium">Saat</th>
                                                        <th className="text-left p-3 text-slate-400 font-medium">Ödeme</th>
                                                        <th className="text-left p-3 text-slate-400 font-medium">Tür</th>
                                                        <th className="text-left p-3 text-slate-400 font-medium">Kategori</th>
                                                        <th className="text-left p-3 text-slate-400 font-medium">Ürün</th>
                                                        <th className="text-center p-3 text-slate-400 font-medium">Adet</th>
                                                        <th className="text-right p-3 text-slate-400 font-medium">İndirim</th>
                                                        <th className="text-right p-3 text-slate-400 font-medium">Tutar</th>
                                                        <th className="text-right p-3 text-slate-400 font-medium">Kâr</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dailyReport.sales.map((sale) => {
                                                        const itemDiscount = sale.discount_amount || 0;

                                                        let PaymentIcon = Banknote
                                                        let iconColor = "text-green-400"
                                                        const pMethod = sale.order_payment_method || sale.payment_method || 'nakit';

                                                        if (pMethod === 'kart') {
                                                            PaymentIcon = CreditCard
                                                            iconColor = "text-blue-400"
                                                        } else if (pMethod === 'iban') {
                                                            PaymentIcon = Landmark
                                                            iconColor = "text-purple-400"
                                                        } else if (pMethod === 'online') {
                                                            PaymentIcon = Globe
                                                            iconColor = "text-orange-400"
                                                        } else if (pMethod === 'parçalı') {
                                                            iconColor = "text-yellow-400"
                                                        }

                                                        return (
                                                            <tr key={sale.id} className="table-row border-b border-slate-700/30">
                                                                <td className="p-3 text-slate-400">{formatTime(sale.sale_date)}</td>
                                                                <td className="p-3 text-left">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center">
                                                                            <PaymentIcon className={`w-4 h-4 ${iconColor}`} />
                                                                            <span className="ml-2 text-xs text-slate-400 capitalize">{pMethod}</span>
                                                                        </div>
                                                                        {pMethod === 'parçalı' && (
                                                                            <span className="text-[10px] text-slate-500 mt-1 block">N:{sale.cash_amount} K:{sale.card_amount}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-xs text-slate-300 border border-slate-700">
                                                                        {sale.order_type || 'Dükkan'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-slate-400 text-sm">{sale.category || '-'}</td>
                                                                <td className="p-3 text-slate-200">
                                                                    <div>{sale.product_name}</div>
                                                                    {sale.sale_note && <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><span>Not:</span> {sale.sale_note}</div>}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-300">{sale.quantity}</td>
                                                                <td className="p-3 text-right text-orange-400">
                                                                    {itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : '-'}
                                                                </td>
                                                                <td className="p-3 text-right text-slate-100 font-medium">{formatCurrency(sale.total_price)}</td>
                                                                <td className="p-3 text-right text-green-400 font-medium">+{formatCurrency(sale.profit)}</td>
                                                                <td className="p-3 text-right">
                                                                    <button
                                                                        onClick={() => handleDeleteSale(sale)}
                                                                        className="p-1 hover:bg-red-500/20 rounded-lg group transition-colors"
                                                                        title="Satışı Sil (Stok Geri Yüklenir)"
                                                                    >
                                                                        <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                {dailyReport.total_discount > 0 && (
                                                    <tfoot>
                                                        <tr className="border-t border-slate-600">
                                                            <td colSpan="5" className="p-3 text-right text-slate-400 font-medium">Toplam İndirim:</td>
                                                            <td className="p-3 text-right text-orange-400 font-bold">-{formatCurrency(dailyReport.total_discount)}</td>
                                                            <td colSpan="2"></td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        ) : (
                                            <p className="text-slate-500 text-center py-8">Bu tarihte satış yok</p>
                                        )}
                                    </div>

                                    {/* Zayi/Fire Detayları */}
                                    {dailyReport?.waste_logs?.length > 0 && (
                                        <div className="mt-6">
                                            <h4 className="text-md font-semibold text-red-400 mb-3 flex items-center gap-2">
                                                <Skull className="w-4 h-4" />
                                                Zayi / Fire Kayıtları
                                            </h4>
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-red-700/30">
                                                        <th className="text-left p-3 text-red-400/70 font-medium">Saat</th>
                                                        <th className="text-left p-3 text-red-400/70 font-medium">Ürün</th>
                                                        <th className="text-center p-3 text-red-400/70 font-medium">Adet</th>
                                                        <th className="text-left p-3 text-red-400/70 font-medium">Sebep</th>
                                                        <th className="text-right p-3 text-red-400/70 font-medium">Zarar</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dailyReport.waste_logs.map((log) => (
                                                        <tr key={log.id} className="table-row border-b border-red-700/20">
                                                            <td className="p-3 text-slate-400">{formatTime(log.date)}</td>
                                                            <td className="p-3 text-slate-200">{log.product_name}</td>
                                                            <td className="p-3 text-center text-slate-300">{log.quantity}</td>
                                                            <td className="p-3 text-orange-400">{log.reason}</td>
                                                            <td className="p-3 text-right text-red-400 font-medium">-{formatCurrency(log.quantity * log.cost_price)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-2">
                                    {monthlyReport?.daily_breakdown?.length > 0 ? (
                                        monthlyReport.daily_breakdown.map((day) => (
                                            <div key={day.date} className="flex items-center gap-4 p-3 glass rounded-xl">
                                                <span className="w-24 text-slate-400">{formatDate(day.date)}</span>
                                                <div className="flex-1">
                                                    <div
                                                        className="h-6 rounded-lg bg-gradient-to-r from-purple-500/30 to-violet-500/30"
                                                        style={{
                                                            width: `${Math.min((day.revenue / ((monthlyReport.total_revenue / monthlyReport.daily_breakdown.length * 3) || 1)) * 100, 100)}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="w-20 text-center text-slate-300">{day.sales_count} satış</span>
                                                <span className="w-28 text-right text-slate-100 font-medium">{formatCurrency(day.revenue)}</span>
                                                <span className="w-24 text-right text-green-400">+{formatCurrency(day.profit)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-slate-500 text-center py-8">Bu ayda satış yok</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

export default Reports
