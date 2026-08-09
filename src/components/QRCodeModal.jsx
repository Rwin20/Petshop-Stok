import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { X, Smartphone, Wifi, WifiOff, RefreshCw, Copy, Check } from 'lucide-react'

export default function QRCodeModal({ isOpen, onClose }) {
    const [serverInfo, setServerInfo] = useState(null)
    const [connectedDevices, setConnectedDevices] = useState(0)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!isOpen) return

        const loadServerInfo = async () => {
            setLoading(true)
            try {
                if (window.api?.scanner) {
                    const info = await window.api.scanner.getServerInfo()
                    setServerInfo(info)
                    setConnectedDevices(info.connectedDevices)
                }
            } catch (err) {
                console.error('Server bilgisi alınamadı:', err)
            }
            setLoading(false)
        }

        loadServerInfo()

        // Bağlı cihaz sayısını dinle
        if (window.api?.scanner) {
            window.api.scanner.onDeviceCountChange((count) => {
                setConnectedDevices(count)
            })
        }

        return () => {
            if (window.api?.scanner) {
                window.api.scanner.removeListeners()
            }
        }
    }, [isOpen])

    const handleRefresh = async () => {
        setLoading(true)
        try {
            if (window.api?.scanner) {
                const info = await window.api.scanner.getServerInfo()
                setServerInfo(info)
                setConnectedDevices(info.connectedDevices)
            }
        } catch (err) {
            console.error('Yenileme hatası:', err)
        }
        setLoading(false)
    }

    const handleCopyUrl = () => {
        if (serverInfo?.url) {
            navigator.clipboard.writeText(serverInfo.url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-100">Mobil Okuyucu Bağla</h3>
                            <p className="text-xs text-slate-500">QR kodu telefonunuzla tarayın</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-700/50 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    {loading ? (
                        <div className="py-8">
                            <RefreshCw className="w-8 h-8 text-purple-400 mx-auto mb-4 animate-spin" />
                            <p className="text-slate-400">Yükleniyor...</p>
                        </div>
                    ) : serverInfo ? (
                        <>
                            {/* QR Code */}
                            <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                                <QRCodeSVG
                                    value={serverInfo.url}
                                    size={200}
                                    level="H"
                                    includeMargin={false}
                                />
                            </div>

                            {/* URL */}
                            <div className="glass rounded-xl p-3 mb-4">
                                <p className="text-xs text-slate-500 mb-1">Bağlantı Adresi</p>
                                <div className="flex items-center justify-center gap-2">
                                    <code className="text-sm text-purple-300 bg-slate-800/50 px-3 py-1 rounded-lg">
                                        {serverInfo.url}
                                    </code>
                                    <button
                                        onClick={handleCopyUrl}
                                        className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                                        title="Kopyala"
                                    >
                                        {copied ? (
                                            <Check className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Connection Status */}
                            <div className="flex items-center justify-center gap-3 glass rounded-xl p-3">
                                {connectedDevices > 0 ? (
                                    <>
                                        <Wifi className="w-5 h-5 text-green-400" />
                                        <span className="text-green-400 font-medium">
                                            {connectedDevices} cihaz bağlı
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="w-5 h-5 text-slate-500" />
                                        <span className="text-slate-400">
                                            Bağlı cihaz yok
                                        </span>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="py-8">
                            <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
                            <p className="text-slate-400 mb-4">Sunucu bilgisi alınamadı</p>
                            <button
                                onClick={handleRefresh}
                                className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-xl hover:bg-purple-500/30 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4 inline mr-2" />
                                Yenile
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <div className="glass rounded-xl p-4 text-sm text-slate-400">
                        <p className="flex items-start gap-2">
                            <span className="text-lg">💡</span>
                            <span>
                                Telefonunuzun kamerasını QR koda tutun veya tarayıcınızda
                                yukarıdaki adresi açın. Aynı Wi-Fi ağında olduğunuzdan emin olun.
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
