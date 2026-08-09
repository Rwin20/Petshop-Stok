import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    BarChart3,
    PawPrint,
    Users,
    Settings,
    Wallet,
    MessageCircle
} from 'lucide-react'

const menuItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'products', label: 'Ürünler', icon: Package },
    { id: 'sales', label: 'Satış', icon: ShoppingCart },
    { id: 'customers', label: 'Müşteriler', icon: Users },
    { id: 'marketing', label: 'Pazarlama', icon: MessageCircle },
    { id: 'expenses', label: 'Giderler', icon: Wallet }, // Using BarChart3 for now as placeholder or import another
    { id: 'reports', label: 'Raporlar', icon: BarChart3 },
    { id: 'settings', label: 'Ayarlar', icon: Settings },
]

function Sidebar({ currentPage, setCurrentPage, currentUser }) {
    // Filter menu items for cashier
    const filteredMenuItems = menuItems.filter(item => {
        if (currentUser && currentUser.role === 'cashier') {
            const restricted = ['dashboard', 'marketing', 'expenses', 'reports', 'settings'];
            return !restricted.includes(item.id);
        }
        return true;
    });

    return (
        <aside className="w-64 flex-shrink-0 glass-card flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center glow-purple">
                        <PawPrint className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold gradient-text">Petshop Stok</h1>
                        <p className="text-xs text-slate-400">Stok Yönetimi</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4">
                <ul className="space-y-2">
                    {filteredMenuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = currentPage === item.id

                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => setCurrentPage(item.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                        ? 'bg-gradient-to-r from-purple-600/30 to-violet-600/20 text-purple-300 border border-purple-500/30'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : ''}`} />
                                    <span className="font-medium">{item.label}</span>
                                    {isActive && (
                                        <div className="ml-auto w-2 h-2 rounded-full bg-purple-400 animate-pulse-slow" />
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700/50">
                <div className="glass rounded-xl p-4">
                    <p className="text-xs text-slate-500 text-center">
                        Petshop Stok v1.0.8
                    </p>
                </div>
            </div>
        </aside>
    )
}

export default Sidebar
