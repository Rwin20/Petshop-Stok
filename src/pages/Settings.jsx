import { useState, useEffect } from 'react'
import {
    Settings as SettingsIcon,
    Trash2,
    AlertTriangle,
    CheckCircle,
    ShoppingCart,
    Users,
    Package,
    Database,
    Plus,
    X,
    Tag
} from 'lucide-react'

function Settings() {
    const [loading, setLoading] = useState(null)
    const [notification, setNotification] = useState(null)
    const [confirmAction, setConfirmAction] = useState(null)

    // Backup State
    const [loggedIn, setLoggedIn] = useState(false)
    const [backups, setBackups] = useState([])
    const [localBackups, setLocalBackups] = useState([])

    // Categories State
    const [categories, setCategories] = useState([])
    const [newCategoryName, setNewCategoryName] = useState('')

    // Users & Security State
    const [users, setUsers] = useState([])
    const [pinModalState, setPinModalState] = useState(null)
    const [pinForm, setPinForm] = useState({ oldPin: '', newPin: '', confirmPin: '' })

    // Load initial data
    useEffect(() => {
        const loadInit = async () => {
            if (window.api) {
                // Load Backup Config
                if (window.api.backup) {
                    const status = await window.api.backup.status()
                    setLoggedIn(status?.loggedIn || false)

                    if (status?.loggedIn) {
                        loadBackups()
                    }

                    window.addEventListener('cloud-backup:login-success', () => {
                        setLoggedIn(true)
                        loadBackups()
                    });
                }

                // Load Local Backups
                if (window.api.localBackup) {
                    const files = await window.api.localBackup.list();
                    setLocalBackups(files || []);
                }
            }

            // Load Categories
            loadCategories()
            
            // Load Users
            loadUsers()
        }
        loadInit()
    }, [])

    const loadUsers = async () => {
        try {
            if (window.api && window.api.auth && window.api.auth.getUsers) {
                const data = await window.api.auth.getUsers()
                setUsers(data)
            }
        } catch (error) {
            console.error('Failed to load users:', error)
        }
    }

    const handleChangePin = async () => {
        const { oldPin, newPin, confirmPin } = pinForm
        if (!oldPin || !newPin || !confirmPin) {
            showNotification('Lütfen tüm alanları doldurun.', 'error')
            return
        }
        if (newPin !== confirmPin) {
            showNotification('Yeni şifreler eşleşmiyor.', 'error')
            return
        }
        if (newPin.length !== 4) {
            showNotification('Yeni şifre 4 haneli olmalıdır.', 'error')
            return
        }
        
        setConfirmAction({
            title: 'PIN Kodunu Değiştir',
            message: `Güvenlik onayınız gerekiyor: "${pinModalState.fullname}" kullanıcısının PIN kodunu değiştirmek istediğinize emin misiniz?`,
            type: 'warning',
            onConfirm: async () => {
                setLoading('updatePin')
                try {
                    const result = await window.api.auth.updatePin(pinModalState.id, oldPin, newPin)
                    if (result.success) {
                        showNotification('PIN başarıyla güncellendi.', 'success')
                        setPinModalState(null)
                        setPinForm({ oldPin: '', newPin: '', confirmPin: '' })
                        loadUsers()
                    } else {
                        showNotification(result.error || 'PIN güncellenemedi.', 'error')
                    }
                } catch (e) {
                    showNotification('Hata: ' + e.message, 'error')
                }
                setLoading(null)
                setConfirmAction(null)
            }
        })
    }

    const loadCategories = async () => {
        try {
            const data = await window.api.categories.getAll()
            setCategories(data)
        } catch (error) {
            console.error('Failed to load categories:', error)
        }
    }

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return

        try {
            const trimmedName = newCategoryName.trim()
            // Client-side duplicate check (optional, but good for UX)
            if (categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
                showNotification('Bu kategori zaten mevcut.', 'error')
                return
            }

            await window.api.categories.add(trimmedName)
            showNotification('Kategori eklendi.', 'success')
            setNewCategoryName('')
            loadCategories()
        } catch (error) {
            showNotification(error.message || 'Kategori eklenemedi.', 'error')
        }
    }

    const handleDeleteCategory = (id, name) => {
        setConfirmAction({
            title: 'Kategori Sil',
            message: `"${name}" kategorisini silmek istediğinize emin misiniz? Bu kategoriye ait ürünler "Genel" kategorisine aktarılacaktır.`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    await window.api.categories.delete(id)
                    showNotification('Kategori silindi.', 'success')
                    loadCategories()
                } catch (error) {
                    showNotification('Kategori silinemedi.', 'error')
                }
                setConfirmAction(null)
            }
        })
    }

    const loadBackups = async () => {
        try {
            const result = await window.api.backup.list()
            if (result.success) {
                setBackups(result.files)
            }
        } catch (e) {
            console.error('Backup list error', e)
        }
    }

    const handleLogin = async () => {
        setLoading('login')
        const result = await window.api.backup.login()
        if (result.success) {
            showNotification(result.message, 'success')
        } else {
            showNotification('Hata: ' + result.error, 'error')
        }
        setLoading(null)
    }

    const handleLogout = async () => {
        setLoading('logout')
        const result = await window.api.backup.logout()
        if (result.success) {
            setLoggedIn(false)
            setBackups([])
            showNotification('Çıkış yapıldı.', 'success')
        }
        setLoading(null)
    }

    const handleBackup = async () => {
        setLoading('backup')
        const result = await window.api.backup.start()
        if (result.success) {
            showNotification('Yedekleme başarılı! 📦', 'success')
            loadBackups()
        } else {
            showNotification('Yedekleme hatası: ' + result.error, 'error')
        }
        setLoading(null)
    }

    const handleRestore = (fileName) => {
        setConfirmAction({
            title: 'Yedeği Geri Yükle',
            message: 'DİKKAT: Bu yedeği geri yüklerseniz mevcut verilerin üzerine yazılacaktır. Devam edilsin mi?',
            type: 'warning',
            onConfirm: async () => {
                setLoading('restore')
                const result = await window.api.backup.restore(fileName)
                if (result.success) {
                    alert(result.message)
                    // Optional: Reload app
                } else {
                    showNotification('Geri yükleme hatası: ' + result.error, 'error')
                }
                setLoading(null)
                setConfirmAction(null)
            }
        })
    }

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type })
        setTimeout(() => setNotification(null), 3000)
    }

    const handleReset = async (type) => {
        if (!window.api) return

        setLoading(type)
        try {
            let result
            switch (type) {
                case 'sales':
                    result = await window.api.reset.sales()
                    break
                case 'customers':
                    result = await window.api.reset.customers()
                    break
                case 'products':
                    result = await window.api.reset.products()
                    break
                case 'all':
                    result = await window.api.reset.all()
                    break
            }

            if (result?.success) {
                showNotification(result.message, 'success')
            }
        } catch (err) {
            console.error('Reset error:', err)
            showNotification('Hata: ' + err.message, 'error')
        }

        setLoading(null)
        // setConfirmAction(null) - Don't close here, let the modal close itself or handle it
    }

    const handleResetRequest = (option) => {
        setConfirmAction({
            title: option.title,
            message: option.description + ' Bu işlem geri alınamaz.',
            type: 'danger',
            onConfirm: async () => {
                await handleReset(option.id)
                setConfirmAction(null)
            }
        })
    }

    const resetOptions = [
        {
            id: 'sales',
            title: 'Satış Verilerini Sil',
            description: 'Tüm satış kayıtlarını ve siparişleri siler. Ürünler ve müşteriler korunur.',
            icon: ShoppingCart,
            color: 'orange'
        },
        {
            id: 'customers',
            title: 'Müşteri Verilerini Sil',
            description: 'Tüm müşteri ve veresiye kayıtlarını siler. Satış verileri korunur.',
            icon: Users,
            color: 'blue'
        },
        {
            id: 'products',
            title: 'Ürün Verilerini Sil',
            description: 'Tüm ürünleri ve bağlı satış kayıtlarını siler. Müşteriler korunur.',
            icon: Package,
            color: 'purple'
        },
        {
            id: 'all',
            title: 'TÜM VERİLERİ SİL',
            description: 'Uygulamadaki tüm verileri kalıcı olarak siler. Bu işlem geri alınamaz!',
            icon: Database,
            color: 'red'
        }
    ]

    const getColorClasses = (color) => {
        const colors = {
            orange: 'from-orange-500 to-amber-600 hover:shadow-orange-500/25',
            blue: 'from-blue-500 to-cyan-600 hover:shadow-blue-500/25',
            purple: 'from-purple-500 to-violet-600 hover:shadow-purple-500/25',
            red: 'from-red-500 to-rose-600 hover:shadow-red-500/25'
        }
        return colors[color] || colors.orange
    }

    // General Settings State
    const [generalSettings, setGeneralSettings] = useState({
        showProfit: false
    })

    useEffect(() => {
        const savedSettings = localStorage.getItem('generalSettings')
        if (savedSettings) {
            setGeneralSettings(JSON.parse(savedSettings))
        }
    }, [])

    const handleSettingChange = (key, value) => {
        const newSettings = { ...generalSettings, [key]: value }
        setGeneralSettings(newSettings)
        localStorage.setItem('generalSettings', JSON.stringify(newSettings))

        // Dispatch event for other components to listen
        window.dispatchEvent(new Event('settings-changed'))

        showNotification('Ayarlar güncellendi.', 'success')
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                        <SettingsIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100">Ayarlar</h2>
                        <p className="text-slate-400">Uygulama ayarları ve veri yönetimi</p>
                    </div>
                </div>
            </div>

            {/* Notification */}
            {notification && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg animate-fade-in ${notification.type === 'success'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                    }`}>
                    {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <span className="font-medium">{notification.message}</span>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmAction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${confirmAction.type === 'danger' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                                }`}>
                                <AlertTriangle className={`w-6 h-6 ${confirmAction.type === 'danger' ? 'text-red-400' : 'text-yellow-400'
                                    }`} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-100">{confirmAction.title}</h3>
                        </div>

                        <p className="text-slate-300 mb-6">
                            {confirmAction.message}
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 px-4 py-3 rounded-xl glass text-slate-300 hover:text-slate-100 transition-colors hover:bg-slate-700/50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmAction.onConfirm}
                                disabled={loading}
                                className={`flex-1 px-4 py-3 rounded-xl text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 ${confirmAction.type === 'danger'
                                    ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-red-500/20'
                                    : 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:shadow-yellow-500/20'
                                    }`}
                            >
                                {loading ? 'İşleniyor...' : (confirmAction.confirmText || 'Evet, Onayla')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Update Modal */}
            {pinModalState && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-100">{pinModalState.fullname} PIN Değiştir</h3>
                            <button onClick={() => setPinModalState(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Mevcut PIN</label>
                                <input 
                                    type="password" 
                                    maxLength="4" 
                                    value={pinForm.oldPin} 
                                    onChange={e => setPinForm({...pinForm, oldPin: e.target.value})} 
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white text-center tracking-[0.5em] focus:ring-2 focus:ring-purple-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Yeni PIN (4 Hane)</label>
                                <input 
                                    type="password" 
                                    maxLength="4" 
                                    value={pinForm.newPin} 
                                    onChange={e => setPinForm({...pinForm, newPin: e.target.value})} 
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white text-center tracking-[0.5em] focus:ring-2 focus:ring-purple-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Yeni PIN (Tekrar)</label>
                                <input 
                                    type="password" 
                                    maxLength="4" 
                                    value={pinForm.confirmPin} 
                                    onChange={e => setPinForm({...pinForm, confirmPin: e.target.value})} 
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white text-center tracking-[0.5em] focus:ring-2 focus:ring-purple-500" 
                                />
                            </div>
                            <button 
                                onClick={handleChangePin}
                                disabled={loading === 'updatePin'}
                                className="w-full py-3 mt-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors font-medium"
                            >
                                {loading === 'updatePin' ? 'Kaydediliyor...' : 'PIN Güncelle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Security Management Section */}
            <div className="glass-card rounded-2xl p-6 mb-6 border border-rose-500/20">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100">Personel & Güvenlik Yönetimi</h3>
                        <p className="text-sm text-slate-400">Patron ve Çalışan PIN kodlarını güncelleyin.</p>
                    </div>
                </div>

                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-4 glass rounded-xl border border-slate-700/30">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-200">{user.fullname}</h4>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {user.role === 'admin' ? 'Patron' : 'Çalışan'}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        setPinForm({ oldPin: '', newPin: '', confirmPin: '' })
                                        setPinModalState(user)
                                    }}
                                    className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                                >
                                    PIN Değiştir
                                </button>
                            </div>
                        ))}
                        {users.length === 0 && <p className="text-slate-500 col-span-2 text-center">Kullanıcı bulunamadı...</p>}
                    </div>
                </div>
            </div>

            {/* General Settings */}
            <div className="glass-card rounded-2xl p-6 mb-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                        <SettingsIcon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">Genel Ayarlar</h2>
                        <p className="text-sm text-slate-400">Uygulama genelindeki tercihlerinizi yönetin.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 glass rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <Tag className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-200">Satış Ekranında Kar Göster</h3>
                                <p className="text-sm text-slate-500">Satış yaparken sepetin tahmini kar oranını gösterir.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={generalSettings.showProfit}
                                onChange={(e) => handleSettingChange('showProfit', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Category Management Section */}
            <div className="glass-card rounded-2xl p-6 border border-purple-500/20">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Tag className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100">Kategori Yönetimi</h3>
                        <p className="text-sm text-slate-400">Ürün kategorilerini düzenleyin.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Add Category */}
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Yeni kategori adı..."
                            className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <button
                            onClick={handleAddCategory}
                            disabled={!newCategoryName.trim()}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-5 h-5" />
                            Ekle
                        </button>
                    </div>

                    {/* Category List */}
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                        <h4 className="text-sm font-medium text-slate-400 mb-3">Mevcut Kategoriler</h4>
                        <div className="flex flex-wrap gap-2">
                            {categories.map((cat) => (
                                <div
                                    key={cat.id || cat.name}
                                    className="group relative flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-600/30 transition-all"
                                >
                                    <span>{cat.name}</span>
                                    {cat.name !== 'Genel' && (
                                        <button
                                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                            className="ml-1 p-1 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                            title="Sil"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Local Backup Section */}
            <div className="glass-card rounded-2xl p-6 mb-6 border border-emerald-500/20">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Database className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100">Yerel Yedekleme</h3>
                        <p className="text-sm text-slate-400">Bilgisayarınızdaki yedekleri yönetin.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                setLoading('localBackup');
                                try {
                                    const result = await window.api.localBackup.create();
                                    if (result.success) {
                                        showNotification('Yedek başarıyla oluşturuldu!', 'success');
                                        // Refresh list
                                        const files = await window.api.localBackup.list();
                                        setLocalBackups(files);
                                    } else {
                                        showNotification('Hata: ' + result.error, 'error');
                                    }
                                } catch (e) {
                                    showNotification('Yedekleme hatası: ' + e.message, 'error');
                                }
                                setLoading(null);
                            }}
                            disabled={loading === 'localBackup'}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading === 'localBackup' ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Database className="w-4 h-4" />
                            )}
                            Yeni Yedek Al
                        </button>

                        <button
                            onClick={() => window.api.localBackup.openFolder()}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors font-medium"
                        >
                            Klasörü Aç
                        </button>
                    </div>

                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 h-[300px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-3 sticky top-0 bg-slate-900/0 backdrop-blur-sm py-2 border-b border-slate-700/50">
                            <h4 className="font-medium text-slate-300">Yedek Dosyaları</h4>
                            <button
                                onClick={async () => {
                                    const files = await window.api.localBackup.list();
                                    setLocalBackups(files);
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300"
                            >
                                Yenile
                            </button>
                        </div>

                        {localBackups.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">
                                <p>Henüz yerel yedek bulunmuyor.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {localBackups.map((file) => (
                                    <div key={file.name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                                <Database className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-200">{new Date(file.date).toLocaleString('tr-TR')}</div>
                                                <div className="text-xs text-slate-500">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setConfirmAction({
                                                    title: 'Yedeği Geri Yükle',
                                                    message: `"${file.name}" yedeğini geri yüklemek istediğinize emin misiniz? Mevcut veriler silinecektir (Otomatik güvenlik yedeği alınır). Uygulama yeniden başlatılacak.`,
                                                    type: 'danger',
                                                    confirmText: 'Geri Yükle ve Başlat',
                                                    onConfirm: async () => {
                                                        setLoading('localRestore');
                                                        try {
                                                            const result = await window.api.localBackup.restore(file.name);
                                                            if (!result.success) {
                                                                showNotification('Geri yükleme hatası: ' + result.error, 'error');
                                                            }
                                                        } catch (e) {
                                                            showNotification('Hata: ' + e.message, 'error');
                                                        }
                                                        setLoading(null);
                                                        setConfirmAction(null);
                                                    }
                                                });
                                            }}
                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg transition-colors border border-red-500/20"
                                        >
                                            Geri Yükle
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cloud Backup Section */}
            <div className="glass-card rounded-2xl p-6 mb-6 border border-blue-500/20">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <div className="text-blue-400">☁️</div>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100">Bulut Yedekleme (Supabase)</h3>
                        <p className="text-sm text-slate-400">Verilerinizi güvenli bir şekilde buluta yedekleyin.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Configuration */}
                    <div className="space-y-4">
                        {!loggedIn ? (
                            <div className="text-center py-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
                                <div className="mb-4">
                                    <h4 className="text-lg font-medium text-slate-200">Google Drive'a Bağlan</h4>
                                    <p className="text-sm text-slate-400 mt-2">Yedeklerinizi güvenle saklamak için Google hesabınızla giriş yapın.</p>
                                </div>
                                <button
                                    onClick={handleLogin}
                                    disabled={loading === 'login'}
                                    className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-medium transition-colors flex items-center justify-center gap-3 mx-auto disabled:opacity-50"
                                >
                                    {loading === 'login' ? 'Bekleniyor...' : (
                                        <>
                                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                            </svg>
                                            Google ile Giriş Yap
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-200">Google Drive Bağlı</p>
                                            <p className="text-xs text-slate-400">Yedeklemeye hazır.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        disabled={loading === 'logout'}
                                        className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                                    >
                                        Çıkış Yap
                                    </button>
                                </div>
                                <button
                                    onClick={handleBackup}
                                    disabled={loading === 'backup'}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 font-bold text-lg disabled:opacity-50"
                                >
                                    {loading === 'backup' ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Drive'a Yükleniyor... (birkaç dk sürebilir)
                                        </>
                                    ) : (
                                        <>
                                            <span>📦</span>
                                            Şimdi Yedekle
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Backup List */}
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 h-[300px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-3 sticky top-0 bg-slate-900/0 backdrop-blur-sm py-2 border-b border-slate-700/50">
                            <h4 className="font-medium text-slate-300">Geçmiş Yedekler</h4>
                            {loggedIn && (
                                <button onClick={loadBackups} className="text-xs text-blue-400 hover:text-blue-300">Yenile</button>
                            )}
                        </div>

                        {backups.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">
                                <p>Henüz yedek bulunmuyor.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {backups.map((file) => (
                                    <div key={file.name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                                📦
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-200">{new Date(file.created_at).toLocaleString('tr-TR')}</div>
                                                <div className="text-xs text-slate-500">{(file.metadata?.size / 1024 / 1024).toFixed(2)} MB</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestore(file.id)}
                                            disabled={loading === 'restore'}
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            Geri Yükle
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Data Reset Section */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Trash2 className="w-6 h-6 text-red-400" />
                    <h3 className="text-xl font-semibold text-slate-100">Veri Sıfırlama</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resetOptions.map((option) => (
                        <div
                            key={option.id}
                            className="glass rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all"
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getColorClasses(option.color)} flex items-center justify-center flex-shrink-0`}>
                                    <option.icon className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h4 className={`font-semibold ${option.id === 'all' ? 'text-red-400' : 'text-slate-100'}`}>
                                        {option.title}
                                    </h4>
                                    <p className="text-sm text-slate-400 mt-1 mb-4">
                                        {option.description}
                                    </p>
                                    <button
                                        onClick={() => handleResetRequest(option)}
                                        disabled={loading}
                                        className={`w-full py-2 px-4 rounded-lg bg-gradient-to-r ${getColorClasses(option.color)} text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50`}
                                    >
                                        {loading === option.id ? 'İşleniyor...' : 'Sil'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 p-4 glass rounded-xl border border-yellow-500/30 bg-yellow-500/5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-yellow-300 font-medium">Dikkat!</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Silinen veriler geri getirilemez. Önemli verilerinizi silmeden önce rapor çıktısı almanızı öneririz.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Settings
