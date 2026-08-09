import { useState, useEffect } from 'react'
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    X,
    Save,
    Package,
    AlertTriangle,
    Loader,
    Globe,
    Check,
    Skull,
    Camera
} from 'lucide-react'
import CategoryBar from '../components/CategoryBar'

function Products({ currentUser }) {
    const [products, setProducts] = useState([])
    const [filteredProducts, setFilteredProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('Tümü')

    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [loading, setLoading] = useState(true)
    const [barcodeLoading, setBarcodeLoading] = useState(false)
    const [barcodeMessage, setBarcodeMessage] = useState(null)
    const [showWasteModal, setShowWasteModal] = useState(false)
    const [wasteProduct, setWasteProduct] = useState(null)
    const [wasteData, setWasteData] = useState({ quantity: '1', reason: 'Öldü' })

    // Category Modal State
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')

    // Camera States
    const [showCamera, setShowCamera] = useState(false)
    const [stream, setStream] = useState(null)
    const [cameraLoading, setCameraLoading] = useState(false)

    const [formData, setFormData] = useState({
        barcode: '',
        name: '',
        category: 'Genel',
        image_url: '',
        purchase_price: '',
        sale_price: '',
        stock_quantity: '',
        critical_stock_level: '5',
        expiration_date: '',
        skt_discount_rate: '0',
        skt_alert_days: '30'
    })

    useEffect(() => {
        loadData()

        const handleBarcodeEvent = (e) => {
            const barcode = e.detail
            if (!barcode) return

            if (showModal) {
                setFormData(prev => ({ ...prev, barcode }))
                // handleBarcodeSearch(barcode) // Otomatik arama kapatıldı (Kullanıcı isteği)
            } else {
                openModal()
                setTimeout(() => {
                    setFormData(prev => ({
                        ...prev,
                        barcode,
                        name: '',
                        category: selectedCategory !== 'Tümü' ? selectedCategory : 'Genel',
                        image_url: '',
                        purchase_price: '',
                        sale_price: '',
                        stock_quantity: '',
                        critical_stock_level: '5',
                        expiration_date: '',
                        skt_discount_rate: '0',
                        skt_alert_days: '30'
                    }))
                    // handleBarcodeSearch(barcode) // Otomatik arama kapatıldı (Kullanıcı isteği)
                }, 300)
            }
        }

        window.addEventListener('barcode-scanned', handleBarcodeEvent)
        return () => window.removeEventListener('barcode-scanned', handleBarcodeEvent)
    }, [showModal])

    useEffect(() => {
        filterProducts()
    }, [products, searchQuery, selectedCategory])

    const loadData = async () => {
        setLoading(true)
        if (window.api) {
            try {
                const [productsData, categoriesData] = await Promise.all([
                    window.api.products.getAll(),
                    window.api.categories.getAll()
                ])
                setProducts(productsData)
                setCategories(categoriesData)
            } catch (err) {
                console.error('Error loading data:', err)
            }
        } else {
            // Demo data
            setProducts([
                { id: 1, name: 'Royal Canin Kedi Maması 2kg', category: 'Kedi Maması', purchase_price: 350, sale_price: 450, stock_quantity: 15, critical_stock_level: 5 },
                { id: 2, name: 'Whiskas Yavru Mama 1kg', category: 'Kedi Maması', purchase_price: 120, sale_price: 160, stock_quantity: 3, critical_stock_level: 5 },
                { id: 3, name: 'Pro Plan Köpek Maması 3kg', category: 'Köpek Maması', purchase_price: 480, sale_price: 580, stock_quantity: 8, critical_stock_level: 5 },
            ])
            setCategories([
                { id: 1, name: 'Genel' }, { id: 2, name: 'Kedi Maması' }, { id: 3, name: 'Köpek Maması' }
            ])
        }
        setLoading(false)
    }

    const filterProducts = () => {
        let filtered = products

        // Category filter
        if (selectedCategory !== 'Tümü') {
            console.log('Filtering by:', selectedCategory)
            console.log('First product category:', filtered[0]?.category)
            filtered = filtered.filter(p => p.category?.trim() === selectedCategory?.trim())
        }

        // Search filter
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase()
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(lowerQuery) ||
                (p.barcode && p.barcode.includes(lowerQuery))
            )
        }

        setFilteredProducts(filtered)
    }

    const loadCategories = async () => {
        if (window.api) {
            const data = await window.api.categories.getAll()
            setCategories(data)
        }
    }

    const handleSearch = (query) => {
        setSearchQuery(query)
    }

    const handleAddCategory = () => {
        setNewCategoryName('')
        setShowCategoryModal(true)
    }

    const confirmAddCategory = async () => {
        if (!newCategoryName.trim()) return

        if (window.api) {
            try {
                await window.api.categories.add(newCategoryName.trim())
                loadCategories()
                setShowCategoryModal(false)
            } catch (err) {
                alert('Hata: ' + err.message)
            }
        } else {
            setCategories(prev => [...prev, { id: Date.now(), name: newCategoryName.trim() }])
            setShowCategoryModal(false)
        }
    }

    const openModal = (product = null) => {
        setBarcodeMessage(null)
        if (product) {
            setEditingProduct(product)
            setFormData({
                barcode: product.barcode || '',
                name: product.name,
                category: product.category || 'Genel',
                image_url: product.image_url || '',
                purchase_price: product.purchase_price.toString(),
                sale_price: product.sale_price.toString(),
                stock_quantity: product.stock_quantity.toString(),
                critical_stock_level: product.critical_stock_level.toString(),
                expiration_date: product.expiration_date || '',
                skt_discount_rate: (product.skt_discount_rate || 0).toString(),
                skt_alert_days: (product.skt_alert_days || 30).toString()
            })
        } else {
            setEditingProduct(null)
            setFormData({
                barcode: '',
                name: '',
                category: selectedCategory !== 'Tümü' ? selectedCategory : 'Genel',
                image_url: '',
                purchase_price: '',
                sale_price: '',
                stock_quantity: '',
                critical_stock_level: '5',
                expiration_date: '',
                skt_discount_rate: '0',
                skt_alert_days: '30'
            })
        }
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingProduct(null)
        setBarcodeMessage(null)
    }

    const handleBarcodeSearch = async (barcode) => {
        if (!barcode || barcode.length < 5) return

        setBarcodeLoading(true)
        setBarcodeMessage(null)

        try {
            if (window.api) {
                const existingProduct = await window.api.products.getByBarcode(barcode)
                if (existingProduct) {
                    setBarcodeMessage({ type: 'warning', text: 'Bu barkod zaten kayıtlı!' })
                    setBarcodeLoading(false)
                    return
                }

                const result = await window.api.products.lookupBarcode(barcode)

                if (result.found && result.name) {
                    setFormData(prev => ({
                        ...prev,
                        name: result.name,
                        image_url: result.image_url || ''
                    }))
                    setBarcodeMessage({ type: 'success', text: 'İnternetten bulundu! ✨' })
                } else if (result.error) {
                    setBarcodeMessage({ type: 'error', text: 'Bağlantı hatası' })
                } else {
                    setBarcodeMessage({ type: 'error', text: 'Bulunamadı' })
                }
            }
        } catch (err) {
            console.error('Barcode lookup error:', err)
        }
        setBarcodeLoading(false)
    }

    const handleBarcodeKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleBarcodeSearch(formData.barcode)
        }
    }

    const handleSave = async () => {
        const productData = {
            barcode: formData.barcode || null,
            name: formData.name,
            category: formData.category,
            image_url: formData.image_url || null,
            purchase_price: parseFloat(formData.purchase_price) || 0,
            sale_price: parseFloat(formData.sale_price) || 0,
            stock_quantity: parseInt(formData.stock_quantity) || 0,
            critical_stock_level: parseInt(formData.critical_stock_level) || 5,
            expiration_date: formData.expiration_date || null,
            skt_discount_rate: parseFloat(formData.skt_discount_rate) || 0,
            skt_alert_days: parseInt(formData.skt_alert_days) || 30
        }

        if (window.api) {
            try {
                if (editingProduct) {
                    await window.api.products.update(editingProduct.id, productData)
                } else {
                    await window.api.products.create(productData)
                }
                loadData()
            } catch (err) {
                console.error('Error saving product:', err)
                alert(`Hata: ${err.message || 'Ürün kaydedilemedi! Bu barkod zaten başkasına atanmış olabilir veya veri hatası oluştu.'}`)
                return
            }
        }
        closeModal()
    }

    const handleDelete = async (id) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return

        if (window.api) {
            try {
                await window.api.products.delete(id)
                loadData()
            } catch (err) {
                console.error('Error deleting product:', err)
            }
        }
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)
    }

    // Waste Logic
    const openWasteModal = (product) => {
        setWasteProduct(product)
        setWasteData({ quantity: '1', reason: 'Öldü' })
        setShowWasteModal(true)
    }

    const handleWaste = async () => {
        if (!wasteProduct) return
        const qty = parseInt(wasteData.quantity) || 0
        if (qty <= 0) return alert('Adet 0\'dan büyük olmalı!')
        if (qty > wasteProduct.stock_quantity) return alert(`Yetersiz stok! Mevcut: ${wasteProduct.stock_quantity}`)

        if (window.api) {
            try {
                const result = await window.api.waste.create(wasteProduct.id, qty, wasteData.reason)
                alert(`✅ Zayi kaydedildi!\n${wasteProduct.name}\n${qty} adet - Sebep: ${wasteData.reason}\nZarar: ${formatCurrency(result.total_loss)}`)
                loadData()
            } catch (err) {
                console.error('Waste error:', err)
                alert('Hata: ' + (err.message || 'Zayi kaydedilemedi'))
                return
            }
        } else {
            // Demo mode
            setProducts(prev => prev.map(p =>
                p.id === wasteProduct.id
                    ? { ...p, stock_quantity: p.stock_quantity - qty }
                    : p
            ))
            alert(`✅ (Demo) Zayi kaydedildi! ${qty} adet - ${wasteData.reason}`)
        }
        setShowWasteModal(false)
        setWasteProduct(null)
    }

    // Camera Logic
    const startCamera = async () => {
        try {
            setCameraLoading(true)
            setShowCamera(true)
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
            setStream(mediaStream)
            const video = document.getElementById('camera-preview')
            if (video) {
                video.srcObject = mediaStream
                video.play()
            }
        } catch (err) {
            alert('Kamera açılamadı!')
            setShowCamera(false)
        } finally {
            setCameraLoading(false)
        }
    }

    const stopCamera = () => {
        if (stream) stream.getTracks().forEach(track => track.stop())
        setStream(null)
        setShowCamera(false)
    }

    const capturePhoto = async () => {
        const video = document.getElementById('camera-preview')
        const canvas = document.createElement('canvas')
        if (video) {
            // Resize image (Max 800px)
            const MAX_SIZE = 800
            let width = video.videoWidth
            let height = video.videoHeight

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width
                    width = MAX_SIZE
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height
                    height = MAX_SIZE
                }
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(video, 0, 0, width, height)
            const base64Data = canvas.toDataURL('image/jpeg', 0.8)

            if (window.api && window.api.products.saveImage) {
                try {
                    const savedPath = await window.api.products.saveImage(base64Data)
                    setFormData(prev => ({ ...prev, image_url: savedPath }))
                } catch (err) {
                    console.error('Save photo error:', err)
                }
            }
            stopCamera()
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Category Bar */}
            <CategoryBar
                categories={categories}
                selectedCategory={selectedCategory}
                onSelect={setSelectedCategory}
                onAddCategory={handleAddCategory}
                showAddButton={true}
            />

            {/* Header / Search */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Ürün ara..."
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
                    Yeni Ürün
                </button>
            </div>

            {/* Products Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-left p-4 text-slate-400 font-medium">Ürün Adı</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Kategori</th>
                                <th className="text-left p-4 text-slate-400 font-medium">SKT & Stok</th>
                                {currentUser?.role !== 'cashier' && <th className="text-right p-4 text-slate-400 font-medium">Alış Fiyatı</th>}
                                <th className="text-right p-4 text-slate-400 font-medium">Satış Fiyatı</th>
                                {currentUser?.role !== 'cashier' && <th className="text-right p-4 text-slate-400 font-medium">Kâr</th>}
                                <th className="text-center p-4 text-slate-400 font-medium">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((product) => {
                                const isCritical = product.stock_quantity <= product.critical_stock_level
                                const profit = product.sale_price - product.purchase_price

                                return (
                                    <tr key={product.id} className="table-row border-b border-slate-700/30">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-600/20 flex items-center justify-center overflow-hidden">
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package className="w-5 h-5 text-purple-400" />
                                                    )}
                                                </div>
                                                <span className="text-slate-100 font-medium">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-300">
                                            <span className="px-2 py-1 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">
                                                {product.category || 'Genel'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${isCritical
                                                    ? 'bg-red-500/20 text-red-300 badge-critical'
                                                    : 'bg-green-500/20 text-green-300'
                                                    }`}>
                                                    {isCritical && <AlertTriangle className="w-3 h-3" />}
                                                    Stok: {product.stock_quantity}
                                                </span>
                                                {product.expiration_date && (
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${new Date() >= new Date(new Date(product.expiration_date).getTime() - (product.skt_alert_days * 24 * 60 * 60 * 1000))
                                                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                                        }`}>
                                                        SKT: {new Date(product.expiration_date).toLocaleDateString('tr-TR')}
                                                        {product.skt_discount_rate > 0 && ` (%${product.skt_discount_rate} İnd.)`}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {currentUser?.role !== 'cashier' && <td className="p-4 text-right text-slate-300">{formatCurrency(product.purchase_price)}</td>}
                                        <td className="p-4 text-right text-slate-100 font-medium">{formatCurrency(product.sale_price)}</td>
                                        {currentUser?.role !== 'cashier' && <td className="p-4 text-right text-green-400 font-medium">{formatCurrency(profit)}</td>}
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openWasteModal(product)}
                                                    className="p-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                                                    title="Zayi / Fire Gir"
                                                >
                                                    <Skull className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal(product)}
                                                    className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
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

                {filteredProducts.length === 0 && (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500">Ürün bulunamadı</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="glass-card rounded-2xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-slate-100">
                                {editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
                            </h3>
                            <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Image Preview & Camera Buttons (Same as before) - Kept simple for brevity */}
                            {formData.image_url && (
                                <div className="flex justify-center mb-4">
                                    <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 group">
                                        <img
                                            src={formData.image_url}
                                            alt="Ürün Resmi"
                                            className="w-full h-full object-contain"
                                        />
                                        <button
                                            onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                                            className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Resmi Kaldır"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Resim URL (opsiyonel)"
                                    value={formData.image_url}
                                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                                    className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 text-sm"
                                />
                                <button onClick={startCamera} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2">
                                    <Camera className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Barcode */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Barkod</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.barcode}
                                        onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                                        onKeyDown={handleBarcodeKeyDown}
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 pr-12"
                                        placeholder="Barkod okutun veya girin..."
                                    />
                                    {barcodeLoading && <div className="absolute right-3 top-3"><Loader className="w-5 h-5 animate-spin" /></div>}
                                </div>
                                {barcodeMessage && <p className={`text-xs mt-1 ${barcodeMessage.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{barcodeMessage.text}</p>}
                            </div>

                            {/* Category Selection */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Kategori</label>
                                <div className="flex gap-2">
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 appearance-none"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddCategory}
                                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300"
                                        title="Yeni Kategori Ekle"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Ürün Adı</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                    placeholder="Ürün adını girin"
                                />
                            </div>

                            {/* Prices */}
                            <div className="grid grid-cols-2 gap-4">
                                {currentUser?.role !== 'cashier' && (
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Alış Fiyatı (₺)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.purchase_price}
                                            onChange={(e) => setFormData(prev => ({ ...prev, purchase_price: e.target.value }))}
                                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Satış Fiyatı (₺)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.sale_price}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sale_price: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                    />
                                </div>
                            </div>

                            {/* Stock */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Stok</label>
                                    <input
                                        type="number"
                                        value={formData.stock_quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Kritik Seviye</label>
                                    <input
                                        type="number"
                                        value={formData.critical_stock_level}
                                        onChange={(e) => setFormData(prev => ({ ...prev, critical_stock_level: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                    />
                                </div>
                            </div>

                            {/* SKT (Son Kullanma Tarihi) ve İndirim */}
                            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-4">
                                <div>
                                    <label className="block text-sm text-purple-300 mb-2 flex justify-between">
                                        <span>Son Kullanma Tarihi (SKT)</span>
                                        <span className="text-xs text-slate-500">Opsiyonel</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.expiration_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, expiration_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-slate-100 focus:border-purple-500 transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-purple-300 mb-2" title="Gününe bu kadar kalınca satış ekranında otomatik indirim yap!">
                                            İndirim Başlasın (Gün)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.skt_alert_days}
                                                onChange={(e) => setFormData(prev => ({ ...prev, skt_alert_days: e.target.value }))}
                                                className="w-full px-4 py-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-slate-100"
                                            />
                                            <span className="text-sm text-slate-500">Kalınca</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-purple-300 mb-2">
                                            Otomatik İndirim (%)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={formData.skt_discount_rate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, skt_discount_rate: e.target.value }))}
                                                className="w-full px-4 py-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-slate-100 pr-8"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={closeModal} className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50">İptal</button>
                            <button onClick={handleSave} className="flex-1 btn-primary px-4 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Waste Modal - (Simplified for redundancy check, assume kept same logic) */}
            {showWasteModal && wasteProduct && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="glass-card rounded-2xl w-full max-w-sm p-6 m-4">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                                    <Skull className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-100">Zayi / Fire Girişi</h3>
                            </div>
                            <button onClick={() => setShowWasteModal(false)} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Ürün Bilgisi */}
                        <div className="p-3 glass rounded-xl mb-4">
                            <p className="text-slate-200 font-medium">{wasteProduct.name}</p>
                            <p className="text-sm text-slate-400">Mevcut Stok: <span className="text-slate-200 font-medium">{wasteProduct.stock_quantity}</span></p>
                            <p className="text-sm text-slate-400">Alış Fiyatı: <span className="text-slate-200 font-medium">{formatCurrency(wasteProduct.purchase_price)}</span></p>
                        </div>

                        <div className="space-y-4">
                            {/* Adet */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Zayi Adedi</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={wasteProduct.stock_quantity}
                                    value={wasteData.quantity}
                                    onChange={(e) => setWasteData(prev => ({ ...prev, quantity: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                    autoFocus
                                />
                            </div>

                            {/* Sebep */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Sebep</label>
                                <select
                                    value={wasteData.reason}
                                    onChange={(e) => setWasteData(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 appearance-none"
                                >
                                    <option value="Öldü">🐟 Öldü</option>
                                    <option value="Kırıldı">💔 Kırıldı</option>
                                    <option value="SKT Doldu">📅 SKT Doldu</option>
                                    <option value="Kayıp">❓ Kayıp</option>
                                    <option value="Diğer">📝 Diğer</option>
                                </select>
                            </div>

                            {/* Tahmini Zarar */}
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-sm text-red-400">Tahmini Zarar:</p>
                                <p className="text-xl font-bold text-red-300">
                                    {formatCurrency((parseInt(wasteData.quantity) || 0) * wasteProduct.purchase_price)}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowWasteModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleWaste}
                                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-600 text-white font-medium flex items-center justify-center gap-2 hover:from-red-600 hover:to-orange-700 transition-all"
                            >
                                <Skull className="w-4 h-4" />
                                Zayi Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Modal (Reuse existing) */}
            {showCamera && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in">
                    <div className="glass-card rounded-2xl w-full max-w-lg p-6 m-4 flex flex-col items-center">
                        <div className="flex items-center justify-between w-full mb-4">
                            <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                                <Camera className="w-5 h-5 text-blue-400" />
                                Fotoğraf Çek
                            </h3>
                            <button onClick={stopCamera} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-6 border-2 border-slate-700">
                            <video
                                id="camera-preview"
                                className="w-full h-full object-cover"
                                autoPlay
                                playsInline
                                muted
                            ></video>
                            {cameraLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <Loader className="w-8 h-8 text-blue-400 animate-spin" />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={capturePhoto}
                                className="flex-1 btn-primary py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 text-lg"
                            >
                                <Camera className="w-6 h-6" />
                                Fotoğrafı Çek ve Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="glass-card rounded-2xl w-full max-w-sm p-6 m-4">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-slate-100">Yeni Kategori Ekle</h3>
                            <button onClick={() => setShowCategoryModal(false)} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Kategori Adı</label>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100"
                                    placeholder="Örn: Balık Yemi"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && confirmAddCategory()}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmAddCategory}
                                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Products
