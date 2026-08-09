import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { BarcodeProvider } from './components/BarcodeContext'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import Customers from './pages/Customers'
import Settings from './pages/Settings'
import Expenses from './pages/Expenses'
import Marketing from './pages/Marketing'
import Login from './components/Login'

function App() {
    const [currentPage, setCurrentPage] = useState('dashboard')
    const [pendingBarcode, setPendingBarcode] = useState(null)
    const [currentUser, setCurrentUser] = useState(null)

    // Global barcode handler - satış sayfasına yönlendir
    const handleBarcodeScan = useCallback((barcode) => {
        console.log('Barkod tarandı:', barcode)

        // Eğer ürünler sayfasındaysak (modal açık olabilir), yönlendirme yapma
        // Sadece event fırlat ki Products.jsx yakalayabilsin
        if (currentPage === 'products') {
            window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: barcode }))
            return
        }

        // Eğer satış sayfasında değilsek, barkodu kaydet ve satış sayfasına git
        if (currentPage !== 'sales') {
            setPendingBarcode(barcode)
            setCurrentPage('sales')
        } else {
            // Zaten satış sayfasındayız, event dispatch et
            window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: barcode }))
        }
    }, [currentPage])

    // Pending barcode'u temizle ve Sales'e geç
    const handlePageChange = useCallback((page) => {
        if (page !== 'sales') {
            setPendingBarcode(null)
        }
        setCurrentPage(page)
    }, [])

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard />
            case 'products':
                return <Products currentUser={currentUser} />
            case 'sales':
                return <Sales pendingBarcode={pendingBarcode} onBarcodeConsumed={() => setPendingBarcode(null)} currentUser={currentUser} />
            case 'reports':
                return <Reports currentUser={currentUser} />
            case 'customers':
                return <Customers />
            case 'marketing':
                return <Marketing />
            case 'expenses':
                return <Expenses />
            case 'settings':
                return <Settings />
            default:
                return <Dashboard />
        }
    }

    if (!currentUser) {
        return <Login onLogin={setCurrentUser} />
    }

    return (
        <BarcodeProvider onBarcodeScan={handleBarcodeScan}>
            <div className="flex h-screen w-screen overflow-hidden">
                <Sidebar currentPage={currentPage} setCurrentPage={handlePageChange} currentUser={currentUser} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header currentPage={currentPage} currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
                    <main className="flex-1 overflow-auto p-6">
                        {renderPage()}
                    </main>
                </div>
            </div>
        </BarcodeProvider>
    )
}

export default App
