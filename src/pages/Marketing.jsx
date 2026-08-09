import { useState, useEffect } from 'react'
import { MessageCircle, QrCode, Smartphone, Users, AlertCircle, Play, Square, CheckCircle, RefreshCcw, Search, LogOut } from 'lucide-react'
import QRCode from 'qrcode'

function Marketing() {
    const [status, setStatus] = useState('DISCONNECTED')
    const [qrImage, setQrImage] = useState(null)
    const [customers, setCustomers] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [messageTemplate, setMessageTemplate] = useState('Merhaba {isim}, \n\nYeni kampanyalarımızdan haberdar olmak ister misiniz?\n\n- Yemmama Petshop')
    const [progress, setProgress] = useState(null)
    const [isSending, setIsSending] = useState(false)
    const [notification, setNotification] = useState(null)

    useEffect(() => {
        // Load customers on mount
        loadCustomers()

        // Get initial WA status
        const checkStatus = async () => {
            const res = await window.api.whatsapp.getStatus()
            if (res.success) {
                setStatus(res.status)
            }
        }
        checkStatus()

        // Listen for WA status updates
        const removeStatusListener = window.api.whatsapp.onStatusUpdate(async (data) => {
            setStatus(data.status)
            if (data.status === 'QR_READY' && data.qr) {
                try {
                    const url = await QRCode.toDataURL(data.qr, { width: 256, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' } })
                    setQrImage(url)
                } catch (err) {
                    console.error('QR Generate Error:', err)
                }
            } else {
                setQrImage(null)
            }
        })

        // Listen for WA progress updates
        const removeProgressListener = window.api.whatsapp.onProgressUpdate((data) => {
            setProgress(data)
            if (data.status === 'Done' || data.status === 'Durduruldu') {
                setIsSending(false)
                showNotification(`Gönderim bitti: ${data.message}`, 'success')
            }
        })

        return () => {
            removeStatusListener()
            removeProgressListener()
        }
    }, [])

    const loadCustomers = async () => {
        try {
            const data = await window.api.customers.getAll()
            // Filter customers who actually have a phone number saved
            setCustomers(data.filter(c => c.phone && c.phone.trim() !== ''))
        } catch (err) {
            console.error('Customers load error:', err)
        }
    }

    const showNotification = (msg, type = 'success') => {
        setNotification({ message: msg, type })
        setTimeout(() => setNotification(null), 4000)
    }

    const handleStartWA = async () => {
        setStatus('CONNECTING')
        const res = await window.api.whatsapp.start()
        if (!res.success) {
            showNotification('WhatsApp başlatılamadı: ' + res.error, 'error')
            setStatus('DISCONNECTED')
        }
    }

    const handleLogoutWA = async () => {
        const res = await window.api.whatsapp.logout()
        if (res.success) showNotification('WhatsApp çıkışı yapıldı.')
    }

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredCustomers.map(c => c.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectCustomer = (id) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const filteredCustomers = customers.filter(c => 
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery)
    )

    const handleSendBatch = async () => {
        if (status !== 'CONNECTED') {
            showNotification('Lütfen önce WhatsApp\'a bağlanın!', 'error')
            return
        }
        if (selectedIds.size === 0) {
            showNotification('Lütfen en az 1 müşteri seçin.', 'error')
            return
        }
        if (!messageTemplate.trim()) {
            showNotification('Mesaj metni boş olamaz.', 'error')
            return
        }

        const selectedCustomers = customers.filter(c => selectedIds.has(c.id))
        setIsSending(true)
        setProgress(null)

        const res = await window.api.whatsapp.sendBatch(selectedCustomers, messageTemplate)
        if (!res.success) {
            showNotification('Gönderim başlatılamadı: ' + res.error, 'error')
            setIsSending(false)
        }
    }

    const handleStopBatch = async () => {
        const res = await window.api.whatsapp.stopBatch()
        if (res.success) {
            showNotification('Durdurma komutu gönderildi. Mevcut mesaj bitince duracak.', 'info')
        }
    }

    return (
        <div className="flex h-full w-full gap-6 animate-fade-in relative">
            {notification && (
                <div className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl animate-slide-in ${
                    notification.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 
                    notification.type === 'info' ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300' :
                    'bg-red-500/20 border border-red-500/30 text-red-300'}`}>
                    <AlertCircle className="w-5 h-5" />
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Sol Panel - WhatsApp Bağlantısı */}
            <div className="w-[340px] flex-shrink-0 flex flex-col gap-4">
                <div className="glass-card rounded-2xl p-6 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center glow-green mb-4">
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 mb-1">WhatsApp Pazarlama</h2>
                    <p className="text-sm text-slate-400 text-center mb-6">Müşterilerinize toplu kampanya mesajları gönderin.</p>

                    <div className="w-full bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center min-h-[220px] justify-center">
                        {status === 'DISCONNECTED' && (
                            <>
                                <Smartphone className="w-12 h-12 text-slate-500 mb-3" />
                                <p className="text-slate-400 text-sm mb-4 text-center">Bağlantı bulunamadı. Lütfen tarayıcıyı başlatın.</p>
                                <button onClick={handleStartWA} className="btn-primary px-6 py-2 rounded-xl text-white font-medium flex items-center gap-2">
                                    <Play className="w-4 h-4" />
                                    Motoru Başlat
                                </button>
                            </>
                        )}

                        {status === 'CONNECTING' && (
                            <div className="flex flex-col items-center">
                                <RefreshCcw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
                                <p className="text-slate-300 text-sm">WhatsApp Motoru Yükleniyor...</p>
                                <p className="text-slate-500 text-xs mt-2 text-center">Bu işlem birkaç saniye sürebilir.</p>
                            </div>
                        )}

                        {status === 'QR_READY' && qrImage && (
                            <div className="flex flex-col items-center w-full animate-fade-in">
                                <div className="bg-white p-2 rounded-xl mb-3">
                                    <img src={qrImage} alt="WhatsApp QR" className="w-[180px] h-[180px]" />
                                </div>
                                <p className="text-green-400 text-sm font-medium flex items-center gap-2 mb-2">
                                    <QrCode className="w-4 h-4" /> Telefonunuzdan okutun
                                </p>
                                <p className="text-slate-500 text-xs text-center">WhatsApp > Bağlı Cihazlar > Cihaz Bağla</p>
                            </div>
                        )}

                        {status === 'CONNECTED' && (
                            <div className="flex flex-col items-center animate-fade-in">
                                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-3 glow-green">
                                    <CheckCircle className="w-8 h-8 text-green-400" />
                                </div>
                                <p className="text-green-400 font-bold mb-1">Bağlantı Başarılı!</p>
                                <p className="text-slate-400 text-xs mb-4">Sistem gönderime hazır.</p>
                                
                                <button onClick={handleLogoutWA} disabled={isSending} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
                                    <LogOut className="w-3.5 h-3.5" /> Çıkış Yap
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card rounded-2xl p-6">
                    <h3 className="text-slate-100 font-semibold flex items-center gap-2 mb-3">
                        <AlertCircle className="w-4 h-4 text-purple-400" /> 
                        Anti-Ban Sistemi Aktif
                    </h3>
                    <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                        <li>Her mesaj arasına <span className="text-purple-300 font-medium">15 ile 35 saniye</span> rastgele bekleme süresi otomatik eklenir.</li>
                        <li>Mesaja <span className="text-purple-300 font-medium">{'{isim}'}</span> eklendiğinde mesajlar benzersiz olur.</li>
                        <li>Böylece sistem <strong>spam gönderici</strong> olarak algılanmaz ve ban riski minimuma iner.</li>
                    </ul>
                </div>
            </div>

            {/* Sağ Panel - Kampanya ve Müşteriler */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* Mesaj Şablonu */}
                <div className="glass-card rounded-2xl p-5 flex-shrink-0">
                    <div className="flex justify-between items-end mb-3">
                        <label className="text-sm font-medium text-slate-200">Mesaj Şablonu</label>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-purple-400 font-mono">{'{isim}'}</span>
                            değişkenini kullanarak müşterinin adını yazdırabilirsiniz.
                        </span>
                    </div>
                    <textarea 
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        disabled={isSending}
                        className="w-full h-32 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-slate-200 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 resize-none transition-all disabled:opacity-50"
                        placeholder="Müşterilerinize iletilecek mesajınızı buraya yazın..."
                    ></textarea>
                </div>

                {/* Progress Bar (Eğer gönderim varsa) */}
                {progress && (
                    <div className="glass-card rounded-2xl p-5 flex-shrink-0 border border-purple-500/30 bg-gradient-to-r from-purple-900/10 to-transparent relative overflow-hidden">
                        <div className="flex justify-between items-center mb-2 relative z-10">
                            <h3 className="font-semibold text-slate-200">Gönderim Durumu</h3>
                            <span className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300 border border-slate-700">
                                Başarılı: <span className="text-green-400">{progress.success}</span> | Başarısız: <span className="text-red-400">{progress.failed}</span>
                            </span>
                        </div>
                        <div className="flex justify-between text-sm mb-3 relative z-10">
                            <span className="text-slate-400">{progress.message}</span>
                            <span className="font-medium text-purple-300">{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative z-10">
                            <div 
                                className="h-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-500 ease-out"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>

                        {/* Background subtle pulse */}
                        {isSending && <div className="absolute inset-0 bg-purple-500/5 animate-pulse-slow"></div>}
                    </div>
                )}

                {/* Müşteri Listesi */}
                <div className="glass-card rounded-2xl p-5 flex-1 flex flex-col min-h-0 relative">
                    {/* Action Block */}
                    <div className="flex justify-between items-center mb-4 gap-4">
                        <div className="flex-1 flex items-center gap-3 bg-slate-900/50 border border-slate-700/50 px-4 py-2 rounded-xl">
                            <Search className="w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Müşteri ara..." 
                                disabled={isSending}
                                className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder-slate-500"
                            />
                        </div>
                        
                        <div className="flex gap-3">
                            {isSending ? (
                                <button onClick={handleStopBatch} className="px-6 py-2.5 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded-xl font-medium flex items-center gap-2 transition-all">
                                    <Square className="w-4 h-4" /> Durdur
                                </button>
                            ) : (
                                <button 
                                    onClick={handleSendBatch} 
                                    disabled={selectedIds.size === 0 || status !== 'CONNECTED'}
                                    className="btn-primary px-8 py-2.5 rounded-xl text-white font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Play className="w-4 h-4 fill-white" /> Seçilenlere Gönder ({selectedIds.size})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="flex-1 overflow-auto rounded-xl border border-slate-700/50">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-slate-800/80 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="p-3 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-600 text-purple-500 focus:ring-purple-500/50 bg-slate-700"
                                            checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
                                            onChange={handleSelectAll}
                                            disabled={isSending}
                                        />
                                    </th>
                                    <th className="p-3 font-medium text-slate-300">Müşteri Adı</th>
                                    <th className="p-3 font-medium text-slate-300">Telefon</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(customer => (
                                        <tr 
                                            key={customer.id} 
                                            className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${selectedIds.has(customer.id) ? 'bg-purple-500/5' : ''}`}
                                            onClick={() => !isSending && handleSelectCustomer(customer.id)}
                                        >
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-600 text-purple-500 focus:ring-purple-500/50 bg-slate-700"
                                                    checked={selectedIds.has(customer.id)}
                                                    onChange={() => {}} // dummy onChange to prevent warning, actual work is handled in row click
                                                    disabled={isSending}
                                                />
                                            </td>
                                            <td className="p-3 text-slate-200">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
                                                        {customer.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    {customer.name}
                                                </div>
                                            </td>
                                            <td className="p-3 text-slate-400">{customer.phone}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="p-8 text-center text-slate-500">
                                            <Users className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                            Telefonu kayıtlı müşteri bulunamadı.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Marketing
