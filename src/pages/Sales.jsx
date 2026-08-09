import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Search,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    CheckCircle,
    AlertCircle,
    X,
    Percent,
    Scan,
    Camera,
    Barcode,
    TrendingUp,
    CreditCard,
    Banknote,
    Landmark,
    Package as PackageIcon,
    Globe
} from 'lucide-react'
import { useBarcodeContext } from '../components/BarcodeContext'
import QRCodeModal from '../components/QRCodeModal'
import CategoryBar from '../components/CategoryBar'

function Sales({ pendingBarcode, onBarcodeConsumed, currentUser }) {
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('Tümü')

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [cart, setCart] = useState(() => {
        try {
            const savedCart = localStorage.getItem('cart_backup')
            return savedCart ? JSON.parse(savedCart) : []
        } catch (error) {
            console.error('Error loading cart from storage:', error)
            return []
        }
    })

    // Persist cart to localStorage
    useEffect(() => {
        localStorage.setItem('cart_backup', JSON.stringify(cart))
    }, [cart])

    const [discount, setDiscount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('nakit') // 'nakit', 'kart', 'iban', 'online', 'parçalı'
    const [cashAmount, setCashAmount] = useState('')
    const [cardAmount, setCardAmount] = useState('')
    const [saleNote, setSaleNote] = useState('')
    const [orderType, setOrderType] = useState('Dükkan') // 'Dükkan', 'Paket Servis', 'Alo Mama', 'Online/Trendyol'
    
    const [showResults, setShowResults] = useState(false)
    const [notification, setNotification] = useState(null)
    const notificationTimer = useRef(null)
    const searchRef = useRef(null)
    const searchInputRef = useRef(null)

    const [variantProducts, setVariantProducts] = useState([])
    const [showVariantModal, setShowVariantModal] = useState(false)
    const [showQRCodeModal, setShowQRCodeModal] = useState(false)
    const [showProfit, setShowProfit] = useState(false)

    // Load settings logic
    useEffect(() => {
        const loadSettings = () => {
            const savedSettings = localStorage.getItem('generalSettings')
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings)
                setShowProfit(parsed.showProfit || false)
            }
        }

        loadSettings()

        // Listen for settings changes
        const handleSettingsChange = () => loadSettings()
        window.addEventListener('settings-changed', handleSettingsChange)

        return () => window.removeEventListener('settings-changed', handleSettingsChange)
    }, [])

    // Barcode context for audio feedback
    const { playSuccess, playError } = useBarcodeContext()

    // Auto-focus on search input when component mounts
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [])

    // Helper
    const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount)

    // Derived values
    const cartTotal = cart.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0)
    const cartCost = cart.reduce((sum, item) => sum + ((item.purchase_price || 0) * item.quantity), 0)
    const discountAmount = parseFloat(discount) || 0
    const finalAmount = Math.max(0, cartTotal - discountAmount)
    const totalProfit = finalAmount - cartCost
    const profitMargin = finalAmount > 0 ? ((totalProfit / finalAmount) * 100) : 0

    // Split Payment Handlers
    const handleCashChange = (val) => {
        let cash = parseFloat(val);
        if (isNaN(cash)) {
            setCashAmount('');
            setCardAmount(finalAmount);
            return;
        }
        if (cash > finalAmount) cash = finalAmount;
        setCashAmount(cash);
        setCardAmount(finalAmount - cash);
    }

    const handleCardChange = (val) => {
        let card = parseFloat(val);
        if (isNaN(card)) {
            setCardAmount('');
            setCashAmount(finalAmount);
            return;
        }
        if (card > finalAmount) card = finalAmount;
        setCardAmount(card);
        setCashAmount(finalAmount - card);
    }

    // Sound effects
    const playSound = useCallback((type) => {
        if (type === 'success') playSuccess()
        else playError()
    }, [playSuccess, playError])

    // Search Handler
    const handleSearch = async (query) => {
        setSearchQuery(query)
        setShowResults(true)
        if (query.length >= 2) {
            try {
                const results = await window.api.products.search(query)
                setSearchResults(results)
            } catch (error) {
                console.error('Search error:', error)
            }
        } else {
            setSearchResults([])
        }
    }

    // Add to Cart Logic
    const addToCart = useCallback((product) => {
        if (!product) return

        if (product.stock_quantity <= 0) {
            playSound('error')
            if (notificationTimer.current) clearTimeout(notificationTimer.current)
            setNotification({ type: 'error', message: 'Stokta yok!' })
            notificationTimer.current = setTimeout(() => setNotification(null), 3000)
            return
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id && item.is_skt_discount === Boolean(product.is_skt_discount))
            if (existing) {
                // Stok aşımı kontrolü
                if (existing.quantity >= product.stock_quantity) {
                    playSound('error')
                    if (notificationTimer.current) clearTimeout(notificationTimer.current)
                    setNotification({ type: 'error', message: `Stok yetersiz! Mevcut: ${product.stock_quantity}` })
                    notificationTimer.current = setTimeout(() => setNotification(null), 3000)
                    return prev
                }
                return prev.map(item =>
                    item.id === product.id && item.is_skt_discount === Boolean(product.is_skt_discount)
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }
            // SKT Check
            let finalPrice = product.sale_price;
            let isSktDiscount = false;

            if (product.expiration_date && product.skt_discount_rate > 0) {
                const expDate = new Date(product.expiration_date);
                const alertDays = product.skt_alert_days || 30;
                const thresholdDate = new Date(expDate.getTime() - (alertDays * 24 * 60 * 60 * 1000));

                if (new Date() >= thresholdDate) {
                    isSktDiscount = true;
                    const discountAmount = finalPrice * (product.skt_discount_rate / 100);
                    finalPrice = finalPrice - discountAmount;
                }
            }

            return [...prev, { ...product, quantity: 1, sale_price: finalPrice, is_skt_discount: isSktDiscount, original_price: product.sale_price }]
        })

        playSound('success')
        if (notificationTimer.current) clearTimeout(notificationTimer.current)
        setNotification({ type: 'success', message: `${product.name} sepete eklendi` })
        notificationTimer.current = setTimeout(() => setNotification(null), 3000)

        setSearchQuery('')
        setSearchResults([])
        setShowResults(false)
        if (searchInputRef.current) searchInputRef.current.focus()
    }, [playSound])

    // Remove from Cart
    const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id))
    }

    // Update Quantity
    const updateQuantity = (id, change) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + change)
                return { ...item, quantity: newQty }
            }
            return item
        }))
    }

    // Barkod tarama işleme fonksiyonu
    const handleScan = useCallback(async (barcode) => {
        if (!barcode || barcode.length < 3) return

        // Check if multiple variants
        const products = await window.api.products.search(barcode)
        // Exact match filter
        const exactMatches = products.filter(p => p.barcode === barcode)

        if (exactMatches.length === 1) {
            addToCart(exactMatches[0])
            setShowQRCodeModal(false)
        } else if (exactMatches.length > 1) {
            setVariantProducts(exactMatches)
            setShowVariantModal(true)
            setShowQRCodeModal(false)
        } else if (products.length > 0) {
            // Fallback to first search result if no exact match but search returned something
            addToCart(products[0])
            setShowQRCodeModal(false)
        } else {
            playSound('error')
            if (notificationTimer.current) clearTimeout(notificationTimer.current)
            setNotification({ type: 'error', message: 'Ürün bulunamadı' })
            notificationTimer.current = setTimeout(() => setNotification(null), 3000)
        }

        // Her zaman input'u temizle ve odakla
        setSearchQuery('')
        setSearchResults([])
        setShowResults(false)
        if (searchInputRef.current) {
            searchInputRef.current.value = ''
            searchInputRef.current.focus()
        }
    }, [addToCart, playSound])

    // Handle Barcode Scan from Hardware/Mobile
    useEffect(() => {
        // Listen for internal events (from main process)
        const removeListener = window.api.onBarcodeScanned((barcode) => {
            handleScan(barcode)
        })

        // Listen for barcode-scanned custom event (from BarcodeContext global listener)
        const handleBarcodeEvent = (e) => {
            handleScan(e.detail)
        }
        window.addEventListener('barcode-scanned', handleBarcodeEvent)

        if (pendingBarcode) {
            handleScan(pendingBarcode)
            if (onBarcodeConsumed) onBarcodeConsumed()
        }

        return () => {
            removeListener()
            window.removeEventListener('barcode-scanned', handleBarcodeEvent)
        }
    }, [pendingBarcode, onBarcodeConsumed, handleScan])

    // Keyboard Navigation in Search
    const handleKeyDown = async (e) => {
        if (e.key === 'Escape') {
            setShowResults(false)
            setSearchQuery('')
        } else if (e.key === 'Enter') {
            e.preventDefault()
            const query = (e.target.value || searchQuery).trim()
            if (query.length >= 3) {
                // Hızlı barkod okuyucular için input'u anında temizle
                setSearchQuery('')
                e.target.value = ''
                await handleScan(query)
            } else if (searchResults.length > 0) {
                addToCart(searchResults[0])
            }
        }
    }

    const handleVariantSelect = (product) => {
        addToCart(product)
        setShowVariantModal(false)
        setVariantProducts([])
    }

    const completeSale = async () => {
        try {
            if (cart.length === 0) return

            // Sepetteki ürünleri backend'den kontrol et
            const allProducts = await window.api.products.search('')
            const productMap = new Map(allProducts.map(p => [p.id, p]))

            const invalidItems = cart.filter(item => !productMap.has(item.id))
            if (invalidItems.length > 0) {
                const names = invalidItems.map(i => i.name).join(', ')
                if (notificationTimer.current) clearTimeout(notificationTimer.current)
                setNotification({ type: 'error', message: `Bu ürünler artık mevcut değil: ${names}. Sepeti temizleyin.` })
                notificationTimer.current = setTimeout(() => setNotification(null), 5000)
                // Otomatik olarak geçersiz ürünleri sepetten kaldır
                setCart(prev => prev.filter(item => productMap.has(item.id)))
                return
            }

            const items = cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity
            }))

            let pCash = 0;
            let pCard = 0;

            if (paymentMethod === 'nakit') {
                pCash = finalAmount;
            } else if (paymentMethod === 'kart') {
                pCard = finalAmount;
            } else if (paymentMethod === 'parçalı') {
                pCash = parseFloat(cashAmount) || 0;
                pCard = parseFloat(cardAmount) || 0;
                if (Math.abs(pCash + pCard - finalAmount) > 0.01) {
                    playSound('error')
                    setNotification({ type: 'error', message: 'Parçalı ödeme toplamı net tutara eşit olmalıdır!' })
                    return;
                }
            } else if (paymentMethod === 'iban' || paymentMethod === 'online') {
                pCard = finalAmount; // or whatever logic you prefer, storing in card for simplicity
            }

            const paymentDetails = {
                method: paymentMethod,
                cashAmount: pCash,
                cardAmount: pCard,
                note: saleNote,
                orderType: orderType
            }

            await window.api.sales.createBatch(items, discountAmount, paymentDetails)

            setCart([])
            localStorage.removeItem('cart_backup')
            setDiscount('')
            setPaymentMethod('nakit')
            setSaleNote('')
            setOrderType('Dükkan')
            setCashAmount('')
            setCardAmount('')
            playSound('success')
            if (notificationTimer.current) clearTimeout(notificationTimer.current)
            setNotification({ type: 'success', message: 'Satış tamamlandı!' })
            notificationTimer.current = setTimeout(() => setNotification(null), 3000)

            // Refresh products to update stock
            const all = await window.api.products.search('')
            setProducts(all)

        } catch (error) {
            console.error('Sale error:', error)
            const errMsg = error?.message || 'Bilinmeyen hata'
            if (notificationTimer.current) clearTimeout(notificationTimer.current)
            setNotification({ type: 'error', message: `Satış hatası: ${errMsg}` })
            notificationTimer.current = setTimeout(() => setNotification(null), 5000)
        }
    }

    // Load products and categories
    useEffect(() => {
        const loadData = async () => {
            try {
                const [productsData, categoriesData] = await Promise.all([
                    window.api.products.search(''),
                    window.api.categories.getAll()
                ])
                setProducts(productsData)
                setCategories(categoriesData)
            } catch (err) {
                console.error('Error loading data:', err)
            }
        }
        loadData()

        // Listen for updates
        const removeUpdateListener = window.api.onProductsRefresh ? window.api.onProductsRefresh(() => {
            loadData()
        }) : () => { }

        return () => removeUpdateListener()
    }, [])

    // Filter Logic for Grid
    const filteredGridProducts = products.filter(p => {
        if (p.stock_quantity <= 0) return false
        if (selectedCategory === 'Tümü') return true
        return p.category?.trim() === selectedCategory?.trim()
    }).sort((a, b) => {
        const aInCart = cart.some(c => c.id === a.id)
        const bInCart = cart.some(c => c.id === b.id)
        if (aInCart && !bInCart) return -1
        if (!aInCart && bInCart) return 1
        return 0
    })

    return (
        <div className="flex h-full w-full overflow-hidden bg-gray-900 gap-4 md:gap-6 animate-fade-in relative">
            {/* QRCode Modal */}
            <QRCodeModal
                isOpen={showQRCodeModal}
                onClose={() => setShowQRCodeModal(false)}
            />

            {/* Multi-Variant Selection Modal */}
            {showVariantModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-8 max-w-4xl w-full mx-4 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-100">Ürün Seçimi</h3>
                                <p className="text-slate-400">Aynı barkoda sahip birden fazla ürün bulundu. Lütfen seçiniz.</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowVariantModal(false)
                                    setVariantProducts([])
                                }}
                                className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-8 h-8 text-slate-400" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-1">
                            {variantProducts.map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => handleVariantSelect(product)}
                                    className="p-6 glass rounded-2xl hover:bg-purple-500/20 hover:border-purple-500/50 transition-all text-left group border border-slate-700/50 flex flex-col gap-3"
                                >
                                    <div className="w-full aspect-video bg-slate-800/50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-purple-500/10 transition-colors">
                                        <ShoppingCart className="w-12 h-12 text-slate-600 group-hover:text-purple-400 transition-colors" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-slate-200 line-clamp-2">{product.name}</h4>
                                    <div className="mt-auto flex justify-between items-end w-full">
                                        <div>
                                            <p className="text-xs text-slate-500 mb-1">Stok: {product.stock_quantity}</p>
                                            <div className="px-3 py-1 rounded-lg bg-slate-800/80 text-xs text-slate-400 border border-slate-700">
                                                {product.barcode}
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-purple-300">{formatCurrency(product.sale_price)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Notification */}
            {notification && (
                <div className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl animate-slide-in ${notification.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                    : 'bg-red-500/20 border border-red-500/30 text-red-300'
                    }`}>
                    {notification.type === 'success'
                        ? <CheckCircle className="w-5 h-5" />
                        : <AlertCircle className="w-5 h-5" />
                    }
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Product Search Panel */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden glass-card rounded-2xl p-4 md:p-6">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h2 className="text-xl font-semibold text-slate-100">Ürün Seçimi</h2>

                    {/* NEW BUTTONS */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowQRCodeModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-xl hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                        >
                            <Camera className="w-5 h-5" />
                            <span className="font-medium">Fotoğraf Çek & Ekle</span>
                        </button>
                        <button
                            onClick={() => {
                                searchInputRef.current?.focus()
                                showNotification('Lütfen barkodu okutunuz', 'success')
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-700/70 transition-colors border border-slate-600/50"
                        >
                            <Barcode className="w-5 h-5" />
                            <span className="font-medium">Barkod Okut & Ekle</span>
                        </button>
                    </div>
                </div>

                {/* Search Input */}
                <div ref={searchRef} className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Scan className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400/50" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Ürün adı veya barkod ile arayın..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                        className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    />

                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-xl shadow-2xl overflow-hidden z-20 max-h-80 overflow-y-auto">
                            {searchResults.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-purple-500/10 transition-colors border-b border-slate-700/30 last:border-0"
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="w-10 h-10 rounded-lg bg-slate-700 overflow-hidden shrink-0">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <PackageIcon className="w-5 h-5 text-slate-500" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-slate-100 font-medium">{product.name}</p>
                                            <p className="text-sm text-slate-500">Stok: {product.stock_quantity}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-purple-300 font-semibold">{formatCurrency(product.sale_price)}</p>
                                        <Plus className="w-5 h-5 text-slate-400 ml-auto" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {showResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-xl p-4 z-20">
                            <p className="text-slate-500 text-center">Ürün bulunamadı</p>
                        </div>
                    )}
                </div>

                {/* CATEGORY BAR */}
                <div className="mb-2 shrink-0 overflow-x-auto whitespace-nowrap no-scrollbar">
                    <CategoryBar
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelect={setSelectedCategory}
                        showAddButton={false}
                    />
                </div>

                {/* Quick Products Grid */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <h3 className="text-sm text-slate-400 mb-4 shrink-0">Hızlı Seçim ({selectedCategory})</h3>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pr-2 pb-2">
                        {filteredGridProducts.length > 0 ? (
                            filteredGridProducts
                                .slice(0, 50) // Limit display for performance
                                .map((product) => {
                                    const isInCart = cart.some(c => c.id === product.id)
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => addToCart(product)}
                                            className={`p-4 rounded-xl hover:bg-purple-500/10 transition-all text-left group ${isInCart
                                                ? 'bg-green-500/20 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                                                : 'glass'
                                                }`}
                                        >
                                            <div className="relative">
                                                {product.image_url ? (
                                                    <img
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        loading="lazy"
                                                        className="w-full h-32 object-cover rounded-lg mb-3 bg-slate-800"
                                                    />
                                                ) : (
                                                    <div className="w-full h-32 bg-slate-800 rounded-lg mb-3 flex items-center justify-center">
                                                        <PackageIcon className="w-8 h-8 text-slate-600" />
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-start">
                                                    <p className="text-slate-200 font-medium text-sm mb-1 line-clamp-2 flex-1 pr-2">{product.name}</p>
                                                    <Plus className={`w-4 h-4 shrink-0 transition-colors ${isInCart ? 'text-green-400' : 'text-slate-500 group-hover:text-purple-400'}`} />
                                                </div>
                                                <p className="text-purple-300 font-bold">{formatCurrency(product.sale_price)}</p>
                                            </div>
                                        </button>
                                    )
                                })
                        ) : (
                            <div className="col-span-full text-center py-8 text-slate-500">
                                <p>Bu kategoride ürün bulunamadı.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart Panel */}
            <div className="w-80 md:w-96 flex-shrink-0 h-full overflow-y-auto glass-card rounded-2xl p-3 md:p-4 flex flex-col text-sm">
                <div className="flex items-center gap-2 mb-3 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-100">Sepet</h2>
                    {cart.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                            {cart.length} ürün
                        </span>
                    )}
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-lg">Sepet boş</p>
                            <p className="text-sm">Ürün eklemek için arama yapın</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.id} className="glass rounded-xl p-3 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 pr-2">
                                        <p className="text-slate-100 font-semibold text-base leading-snug">{item.name}</p>
                                        {currentUser?.role !== 'cashier' && (
                                            <span className="text-xs text-slate-400 mt-1 block">Maliyet: {formatCurrency(item.purchase_price)}</span>
                                        )}
                                        {item.is_skt_discount && (
                                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                                                🚨 SKT İndirimi (%{item.skt_discount_rate})
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
                                        <button
                                            onClick={() => updateQuantity(item.id, -1)}
                                            className="w-8 h-8 rounded-md bg-slate-700/50 flex items-center justify-center hover:bg-slate-600/50 transition-colors hover:text-white text-slate-300"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-8 text-center text-slate-100 font-bold text-base">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.id, 1)}
                                            className="w-8 h-8 rounded-md bg-slate-700/50 flex items-center justify-center hover:bg-slate-600/50 transition-colors hover:text-white text-slate-300"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-purple-300 font-bold text-lg">
                                        {formatCurrency(item.sale_price * item.quantity)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Summary & Checkout */}
                {cart.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                        {/* Order Type Selection */}
                        <div className="mb-2">
                            <label className="text-[10px] sm:text-xs text-slate-400 mb-1 block">Sipariş Türü</label>
                            <div className="flex flex-wrap gap-1.5">
                                {['Dükkan', 'Paket Servis', 'Alo Mama', 'Online/Trendyol'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setOrderType(type)}
                                        className={`px-2 py-1 rounded-md text-[10px] sm:text-xs font-medium border transition-colors ${orderType === type
                                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5 mb-2">
                            <div className="flex justify-between text-slate-400 text-xs">
                                <span>Brüt Tutar</span>
                                <span>{formatCurrency(cartTotal)}</span>
                            </div>

                            {/* Discount Input */}
                            <div className="glass rounded-md p-1.5 flex items-center justify-between gap-2">
                                <label className="flex items-center gap-1 text-[10px] text-slate-400 whitespace-nowrap">
                                    <Percent className="w-2.5 h-2.5" />
                                    İskonto
                                </label>
                                <div className="flex gap-1 flex-1 justify-end">
                                    <input
                                        type="number"
                                        value={discount}
                                        onChange={(e) => setDiscount(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        max={cartTotal}
                                        className="w-20 px-2 py-0.5 bg-slate-800/50 border border-slate-700 rounded text-slate-100 text-right text-xs"
                                    />
                                    <span className="py-0.5 text-slate-400 text-xs">TL</span>
                                </div>
                            </div>

                            {discountAmount > 0 && (
                                <div className="flex justify-between text-orange-400 text-xs">
                                    <span>İndirim</span>
                                    <span>-{formatCurrency(discountAmount)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-base font-bold text-slate-100 pt-1 border-t border-slate-700/30">
                                <span>Net Tutar</span>
                                <span className="gradient-text">{formatCurrency(finalAmount)}</span>
                            </div>

                            {/* Profit and Cost Display (Conditional) */}
                            {showProfit && (
                                <>
                                    <div className="flex justify-between text-xs pt-2 border-t border-slate-700/30 animate-fade-in">
                                        <span className="text-blue-400/80 font-medium">Toplam Maliyet</span>
                                        <span className="text-blue-400 font-bold">
                                            {formatCurrency(cartCost)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs pt-1 animate-fade-in">
                                        <span className="text-green-400/80 font-medium">Tahmini Kar</span>
                                        <span className="text-green-400 font-bold">
                                            {formatCurrency(totalProfit)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Ödeme Yöntemi Seçimi */}
                        <div className="mb-2 grid grid-cols-5 gap-1">
                            <button
                                onClick={() => setPaymentMethod('nakit')}
                                className={`flex flex-col sm:flex-row items-center justify-center gap-1 p-1.5 rounded-md border transition-all ${paymentMethod === 'nakit'
                                    ? 'bg-green-500/20 border-green-500/50 text-green-300'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                                    }`}
                            >
                                <Banknote className="w-3.5 h-3.5" />
                                <span className="text-[10px] sm:text-[11px] font-medium leading-none">Nakit</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('kart')}
                                className={`flex flex-col sm:flex-row items-center justify-center gap-1 p-1.5 rounded-md border transition-all ${paymentMethod === 'kart'
                                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                                    }`}
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span className="text-[10px] sm:text-[11px] font-medium leading-none">Kart</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('iban')}
                                className={`flex flex-col sm:flex-row items-center justify-center gap-1 p-1.5 rounded-md border transition-all ${paymentMethod === 'iban'
                                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                                    }`}
                            >
                                <Landmark className="w-3.5 h-3.5" />
                                <span className="text-[10px] sm:text-[11px] font-medium leading-none">IBAN</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('online')}
                                className={`flex flex-col sm:flex-row items-center justify-center gap-1 p-1.5 rounded-md border transition-all ${paymentMethod === 'online'
                                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                                    }`}
                            >
                                <Globe className="w-3.5 h-3.5" />
                                <span className="text-[10px] sm:text-[11px] font-medium leading-none">Online</span>
                            </button>
                            <button
                                onClick={() => {
                                    setPaymentMethod('parçalı');
                                    setCashAmount('');
                                    setCardAmount(finalAmount);
                                }}
                                className={`flex flex-col sm:flex-row items-center justify-center gap-1 p-1.5 rounded-md border transition-all ${paymentMethod === 'parçalı'
                                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                                    }`}
                            >
                                <Banknote className="w-3.5 h-3.5" />
                                <span className="text-[10px] sm:text-[11px] font-medium leading-none">Parçalı</span>
                            </button>
                        </div>

                        {/* Parçalı Ödeme Girişleri */}
                        {paymentMethod === 'parçalı' && (
                            <div className="flex gap-2 mb-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
                                <div className="flex-1">
                                    <label className="block text-[10px] text-slate-400 mb-0.5">Nakit (TL)</label>
                                    <input
                                        type="number"
                                        value={cashAmount}
                                        onChange={(e) => handleCashChange(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-slate-800/80 border border-slate-600 rounded-md text-slate-100 text-xs focus:border-green-500 focus:ring-1 focus:ring-green-500/50"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] text-slate-400 mb-0.5">Kart (TL)</label>
                                    <input
                                        type="number"
                                        value={cardAmount}
                                        onChange={(e) => handleCardChange(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-slate-800/80 border border-slate-600 rounded-md text-slate-100 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Sipariş Notu */}
                        <div className="mb-2">
                            <textarea
                                value={saleNote}
                                onChange={(e) => setSaleNote(e.target.value)}
                                placeholder="Siparişe özel not ekleyebilirsiniz..."
                                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 text-xs placeholder-slate-500 resize-none h-10"
                            ></textarea>
                        </div>

                        <button
                            onClick={completeSale}
                            disabled={finalAmount < 0}
                            className="w-full btn-primary py-2.5 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Satışı Tamamla
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Sales
