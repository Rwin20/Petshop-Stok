import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const BarcodeContext = createContext(null)

// Kablolu barkod okuyucu için HID buffer
const BARCODE_TIMEOUT = 100 // ms içinde ardışık girişler barkod olarak kabul edilir
const MIN_BARCODE_LENGTH = 3 // Minimum barkod uzunluğu
const RAPID_TYPING_THRESHOLD = 80 // ms - bu süreden kısa aralıklarla gelen tuşlar barkod okuyucudan geliyor demek

export function BarcodeProvider({ children, onBarcodeScan }) {
    const [isListening, setIsListening] = useState(true)
    const [connectedDevices, setConnectedDevices] = useState(0)
    const [serverInfo, setServerInfo] = useState(null)

    const bufferRef = useRef('')
    const timeoutRef = useRef(null)
    const lastScanRef = useRef({ code: '', time: 0 })
    const lastKeyTimeRef = useRef(0)

    // Sesli geri bildirim
    const playSound = useCallback((type) => {
        try {
            const audio = new Audio(`/sounds/${type}.mp3`)
            audio.volume = 0.5
            audio.play().catch(() => { })
        } catch (e) {
            console.log('Ses çalınamadı:', e)
        }
    }, [])

    const playSuccess = useCallback(() => playSound('success'), [playSound])
    const playError = useCallback(() => playSound('error'), [playSound])

    // Barkod işleme
    const processBarcode = useCallback((barcode) => {
        const now = Date.now()
        // Aynı barkod 500ms içinde tekrar taranmasın (çoklu barkod için kısa tutuldu)
        if (barcode === lastScanRef.current.code && now - lastScanRef.current.time < 500) {
            return
        }
        lastScanRef.current = { code: barcode, time: now }

        if (onBarcodeScan) {
            onBarcodeScan(barcode)
        }
    }, [onBarcodeScan])

    // Kablolu okuyucu (HID) keyboard listener
    // Input alanlarında bile çalışır - hızlı ardışık tuş basımlarını barkod olarak algılar
    useEffect(() => {
        if (!isListening) return

        const handleKeyDown = (e) => {
            const now = Date.now()
            const timeSinceLastKey = now - lastKeyTimeRef.current
            lastKeyTimeRef.current = now

            const target = e.target
            const isInputField = target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable

            // Timeout'u temizle
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }

            if (e.key === 'Enter') {
                // Buffer minimum uzunluğu karşılıyorsa barkod olarak işle
                if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
                    e.preventDefault()
                    e.stopPropagation()
                    const scannedBarcode = bufferRef.current
                    bufferRef.current = ''

                    // Input alanını temizle (barkod okuyucu karakterleri yazdıysa)
                    if (isInputField && target.value) {
                        target.value = ''
                        // React state'i de güncellemek için input event tetikle
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set
                        nativeInputValueSetter.call(target, '')
                        target.dispatchEvent(new Event('input', { bubbles: true }))
                    }

                    processBarcode(scannedBarcode)
                } else {
                    bufferRef.current = ''
                }
                return
            }

            // Alfanumerik karakter
            if (e.key.length === 1 && /[\d\w-]/.test(e.key)) {
                if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                    // Hızlı ardışık tuş geliyorsa (barkod okuyucu) buffer'a ekle
                    if (bufferRef.current.length === 0 || timeSinceLastKey < RAPID_TYPING_THRESHOLD) {
                        bufferRef.current += e.key
                    } else {
                        // Yavaş yazım - buffer'ı sıfırla ve yeni karakter ile başla
                        bufferRef.current = e.key
                    }
                }
            }

            // Buffer'ı belirli süre sonra temizle
            timeoutRef.current = setTimeout(() => {
                bufferRef.current = ''
            }, BARCODE_TIMEOUT * 10)
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [isListening, processBarcode])

    // Mobil okuyucu socket listener
    useEffect(() => {
        if (!window.api?.scanner) return

        // Scanner server bilgisini al
        window.api.scanner.getServerInfo().then(info => {
            setServerInfo(info)
            setConnectedDevices(info.connectedDevices)
        }).catch(console.error)

        // Barkod tarama olaylarını dinle
        window.api.scanner.onBarcodeScan(processBarcode)
        window.api.scanner.onDeviceCountChange(setConnectedDevices)

        return () => {
            window.api.scanner.removeListeners()
        }
    }, [processBarcode])

    const value = {
        isListening,
        setIsListening,
        connectedDevices,
        serverInfo,
        playSuccess,
        playError,
        processBarcode
    }

    return (
        <BarcodeContext.Provider value={value}>
            {children}
        </BarcodeContext.Provider>
    )
}

export function useBarcodeContext() {
    const context = useContext(BarcodeContext)
    if (!context) {
        throw new Error('useBarcodeContext must be used within BarcodeProvider')
    }
    return context
}

export default BarcodeContext
