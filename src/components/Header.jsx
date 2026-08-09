import { Bell, X, AlertTriangle, Package, Smartphone, Wifi } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import QRCodeModal from './QRCodeModal'

const pageTitles = {
    dashboard: 'Kontrol Paneli',
    products: 'Ürün Yönetimi',
    sales: 'Satış İşlemleri',
    customers: 'Veresiye Takibi',
    reports: 'Raporlar & Analizler',
    settings: 'Ayarlar'
}

function Header({ currentPage, currentUser, onLogout }) {
    const [currentTime, setCurrentTime] = useState(new Date())
    const [criticalProducts, setCriticalProducts] = useState([])
    const [showNotifications, setShowNotifications] = useState(false)
    const [showQRModal, setShowQRModal] = useState(false)
    const [connectedDevices, setConnectedDevices] = useState(0)
    const buttonRef = useRef(null)
    const dropdownRef = useRef(null)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const loadCriticalProducts = async () => {
            if (window.api) {
                try {
                    const products = await window.api.products.getCritical()
                    setCriticalProducts(products)
                } catch (err) {
                    console.error('Error loading critical stock:', err)
                }
            }
        }
        loadCriticalProducts()
        const interval = setInterval(loadCriticalProducts, 30000)
        return () => clearInterval(interval)
    }, [])

    // Scanner bağlantı durumunu dinle
    useEffect(() => {
        if (window.api?.scanner) {
            window.api.scanner.getServerInfo().then(info => {
                setConnectedDevices(info?.connectedDevices || 0)
            }).catch(() => { })

            window.api.scanner.onDeviceCountChange((count) => {
                setConnectedDevices(count)
            })
        }

        return () => {
            if (window.api?.scanner) {
                window.api.scanner.removeListeners()
            }
        }
    }, [])

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setShowNotifications(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const criticalCount = criticalProducts.length

    // We will render the dropdown directly instead of creating a component on the fly

    return (
        <header className="h-16 glass-card border-b border-slate-700/50 px-6 flex items-center justify-between">
            <div>
                <h2 className="text-xl font-semibold text-slate-100">
                    {pageTitles[currentPage]}
                </h2>
                <p className="text-sm text-slate-500">
                    {currentTime.toLocaleDateString('tr-TR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </p>
            </div>

            <div className="flex items-center gap-4">
                {/* Mobile Scanner Button */}
                <button
                    onClick={() => setShowQRModal(true)}
                    className="relative flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-purple-500/10 transition-colors group"
                    title="Mobil Okuyucu Bağla"
                >
                    <Smartphone className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
                    <span className="text-sm text-slate-300 group-hover:text-slate-100">Mobil Okuyucu</span>
                    {connectedDevices > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                            <Wifi className="w-3 h-3" />
                            {connectedDevices}
                        </span>
                    )}
                </button>

                {/* Logout Button */}
                {currentUser && (
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl glass hover:bg-red-500/10 transition-colors group border border-slate-700 hover:border-red-500/30"
                        title="Oturumu Kapat"
                    >
                        <span className="text-sm font-medium text-slate-300 group-hover:text-red-400">
                            {currentUser.fullname} ({currentUser.role === 'admin' ? 'Yönetici' : 'Kasiyer'})
                        </span>
                        <div className="w-px h-4 bg-slate-700 mx-1"></div>
                        <span className="text-sm text-red-400 group-hover:text-red-300 font-semibold">Kilitle</span>
                    </button>
                )}

                {/* Time */}
                <div className="glass px-4 py-2 rounded-xl">
                    <span className="text-lg font-mono text-purple-300">
                        {currentTime.toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>

                {/* Notifications */}
                <button
                    ref={buttonRef}
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-xl glass hover:bg-slate-700/50 transition-colors"
                >
                    <Bell className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-400' : 'text-slate-400'}`} />
                    {criticalCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold badge-critical">
                            {criticalCount}
                        </span>
                    )}
                </button>

                {showNotifications && createPortal(
                    <div
                        ref={dropdownRef}
                        className="fixed right-6 top-20 w-80 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-fade-in"
                        style={{ zIndex: 99999 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                <h3 className="font-semibold text-slate-100">Bildirimler</h3>
                            </div>
                            <button
                                onClick={() => setShowNotifications(false)}
                                className="p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="max-h-80 overflow-y-auto bg-slate-900">
                            {criticalCount > 0 ? (
                                <div className="p-2">
                                    <p className="text-xs text-slate-500 px-2 py-1 mb-2">
                                        Kritik stok seviyesinde {criticalCount} ürün var
                                    </p>
                                    {criticalProducts.map((product) => (
                                        <div
                                            key={product.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="w-5 h-5 text-red-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-200 truncate">
                                                    {product.name}
                                                </p>
                                                <p className="text-xs text-red-400">
                                                    Stok: {product.stock_quantity} / Min: {product.critical_stock_level}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                                        <Bell className="w-6 h-6 text-green-400" />
                                    </div>
                                    <p className="text-slate-400 text-sm">Bildirim yok</p>
                                    <p className="text-slate-500 text-xs mt-1">Tüm stoklar yeterli seviyede</p>
                                </div>
                            )}
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {/* QR Code Modal */}
            <QRCodeModal isOpen={showQRModal} onClose={() => setShowQRModal(false)} />
        </header>
    )
}

export default Header
