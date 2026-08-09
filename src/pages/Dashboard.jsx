import { useState, useEffect } from 'react'
import {
    TrendingUp,
    TrendingDown,
    Package,
    ShoppingCart,
    AlertTriangle,
    DollarSign,
    ArrowRight,
    Skull
} from 'lucide-react'

function Dashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [expiringProducts, setExpiringProducts] = useState([])

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        if (window.api) {
            try {
                const [data, expiring] = await Promise.all([
                    window.api.reports.dashboard(),
                    window.api.products.getExpiring()
                ])
                setStats(data)
                setExpiringProducts(expiring)
            } catch (err) {
                console.error('Error loading dashboard:', err)
            }
        } else {
            // Demo data for development
            setStats({
                today: { revenue: 2450.50, profit: 680.75, sales_count: 12 },
                thisMonth: { revenue: 45680.00, profit: 12450.00, sales_count: 234 },
                totalProducts: 156,
                criticalStockCount: 8,
                criticalStockProducts: [
                    { id: 1, name: 'Royal Canin Kedi Maması 2kg', stock_quantity: 2, critical_stock_level: 5 },
                    { id: 2, name: 'Whiskas Yavru Mama 1kg', stock_quantity: 3, critical_stock_level: 5 },
                    { id: 3, name: 'Pro Plan Köpek Maması', stock_quantity: 1, critical_stock_level: 5 },
                ],
                recentSales: [
                    { id: 1, product_name: 'Kedi Kumu 10L', quantity: 2, total_price: 180.00, profit: 40.00 },
                    { id: 2, product_name: 'Köpek Tasması', quantity: 1, total_price: 85.00, profit: 25.00 },
                    { id: 3, product_name: 'Balık Yemi 100g', quantity: 3, total_price: 45.00, profit: 15.00 },
                ]
            })
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Today Revenue */}
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-sm text-slate-400 mb-1">Bugünkü Ciro</p>
                    <p className="text-2xl font-bold text-slate-100">
                        {formatCurrency(stats?.today?.revenue || 0)}
                    </p>
                </div>

                {/* Today Profit */}
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-green-400 text-sm font-medium">+{stats?.today?.revenue > 0 ? ((stats.today.profit / stats.today.revenue) * 100).toFixed(1) : '0.0'}%</span>
                    </div>
                    <p className="text-sm text-slate-400 mb-1">Bugünkü Kâr</p>
                    <p className="text-2xl font-bold text-slate-100">
                        {formatCurrency(stats?.today?.profit || 0)}
                    </p>
                </div>

                {/* Total Products */}
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                            <Package className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <p className="text-sm text-slate-400 mb-1">Toplam Ürün</p>
                    <p className="text-2xl font-bold text-slate-100">{stats?.totalProducts || 0}</p>
                </div>

                {/* Today Sales Count */}
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <p className="text-sm text-slate-400 mb-1">Bugünkü Satış</p>
                    <p className="text-2xl font-bold text-slate-100">{stats?.today?.sales_count || 0} adet</p>
                </div>
            </div>

            {/* Monthly Summary */}
            <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Aylık Özet</h3>
                <div className="grid grid-cols-4 gap-6">
                    <div className="text-center p-4 glass rounded-xl">
                        <p className="text-sm text-slate-400 mb-2">Aylık Ciro</p>
                        <p className="text-xl font-bold gradient-text">{formatCurrency(stats?.thisMonth?.revenue || 0)}</p>
                    </div>
                    <div className="text-center p-4 glass rounded-xl">
                        <p className="text-sm text-slate-400 mb-2">Aylık Kâr</p>
                        <p className="text-xl font-bold text-green-400">{formatCurrency((stats?.thisMonth?.profit || 0) - (stats?.monthWasteCost || 0))}</p>
                    </div>
                    <div className="text-center p-4 glass rounded-xl">
                        <p className="text-sm text-slate-400 mb-2">Toplam Satış</p>
                        <p className="text-xl font-bold text-slate-100">{stats?.thisMonth?.sales_count || 0}</p>
                    </div>
                    <div className="text-center p-4 glass rounded-xl">
                        <p className="text-sm text-slate-400 mb-2 flex items-center justify-center gap-1">
                            <Skull className="w-3.5 h-3.5 text-red-400" />
                            Aylık Zayi
                        </p>
                        <p className="text-xl font-bold text-red-400">{formatCurrency(stats?.monthWasteCost || 0)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Critical Stock Alert */}
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-100">Kritik Stok</h3>
                        </div>
                        {stats?.criticalStockCount > 0 && (
                            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium badge-critical">
                                {stats.criticalStockCount} ürün
                            </span>
                        )}
                    </div>

                    {stats?.criticalStockProducts?.length > 0 ? (
                        <div className="space-y-3">
                            {stats.criticalStockProducts.map((product) => (
                                <div key={product.id} className="flex items-center justify-between p-3 glass rounded-xl">
                                    <span className="text-slate-200">{product.name}</span>
                                    <span className={`px-2 py-1 rounded-lg text-sm font-medium ${product.stock_quantity === 0
                                        ? 'bg-red-500/30 text-red-300'
                                        : 'bg-orange-500/30 text-orange-300'
                                        }`}>
                                        {product.stock_quantity} adet
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-8">Kritik stok yok 🎉</p>
                    )}
                </div>

                {/* Recent Sales */}
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-100">Son Satışlar</h3>
                        </div>
                    </div>

                    {stats?.recentSales?.length > 0 ? (
                        <div className="space-y-3">
                            {stats.recentSales.map((sale) => (
                                <div key={sale.id} className="flex items-center justify-between p-3 glass rounded-xl">
                                    <div>
                                        <p className="text-slate-200">{sale.product_name}</p>
                                        <p className="text-sm text-slate-500">{sale.quantity} adet</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-100 font-medium">{formatCurrency(sale.total_price)}</p>
                                        <p className="text-sm text-green-400">+{formatCurrency(sale.profit)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-8">Henüz satış yok</p>
                    )}
                </div>
            </div>

            {/* Expiring Products Alert Panel */}
            <div className="glass-card rounded-2xl p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                            <Skull className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-100">Yaklaşan SKT & İndirimler</h3>
                    </div>
                </div>

                <div className="space-y-4">
                    {expiringProducts.length === 0 ? (
                        <p className="text-slate-500 text-center py-4">SKT uyarısı veren ürün bulunmuyor.</p>
                    ) : (
                        expiringProducts.map(product => {
                            const expDate = new Date(product.expiration_date)
                            const today = new Date()
                            const isExpired = today >= expDate

                            return (
                                <div key={product.id} className={`glass p-4 rounded-xl flex items-center justify-between border ${isExpired ? 'border-red-500/50 bg-red-500/10' : 'border-orange-500/30'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <Package className="w-5 h-5 text-slate-500" />
                                            )}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isExpired ? 'text-red-300' : 'text-slate-200'}`}>{product.name}</p>
                                            <div className="flex gap-2 text-xs mt-1">
                                                <span className={`${isExpired ? 'text-red-400' : 'text-orange-400'}`}>
                                                    SKT: {expDate.toLocaleDateString('tr-TR')}
                                                </span>
                                                {product.skt_discount_rate > 0 && (
                                                    <span className="text-purple-400 bg-purple-500/20 px-1.5 rounded">
                                                        %{product.skt_discount_rate} İndirim Aktif
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-300 font-bold text-lg">{product.stock_quantity}</p>
                                        <p className="text-xs text-slate-500">Stok</p>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
