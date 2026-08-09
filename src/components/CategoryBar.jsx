import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

function CategoryBar({ categories, selectedCategory, onSelect, onAddCategory, onDeleteCategory, showAddButton = false, showDeleteButton = false }) {
    const scrollRef = useRef(null)
    const [showLeftArrow, setShowLeftArrow] = useState(false)
    const [showRightArrow, setShowRightArrow] = useState(false)

    // Scroll buttons logic
    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
            setShowLeftArrow(scrollLeft > 0)
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
        }
    }

    useEffect(() => {
        checkScroll()
        window.addEventListener('resize', checkScroll)
        return () => window.removeEventListener('resize', checkScroll)
    }, [categories])

    const scroll = (direction) => {
        if (scrollRef.current) {
            const { clientWidth } = scrollRef.current
            scrollRef.current.scrollBy({ left: direction === 'left' ? -clientWidth / 2 : clientWidth / 2, behavior: 'smooth' })
        }
    }

    return (
        <div className="relative flex items-center mb-6 group">
            {/* Left Scroll Button */}
            {showLeftArrow && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 z-10 p-1 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full shadow-lg backdrop-blur-sm -ml-2 border border-gray-600"
                >
                    <ChevronLeft size={20} />
                </button>
            )}

            {/* Scrollable Container */}
            <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-1 w-full"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <button
                    onClick={() => onSelect('Tümü')}
                    className={`
                        whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                        ${selectedCategory === 'Tümü'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30 shadow-md transform scale-105'
                            : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600'}
                    `}
                >
                    Tümü
                </button>

                {categories.map((cat) => (
                    <div key={cat.id || cat.name} className="relative group/chip">
                        <button
                            onClick={() => onSelect(cat.name)}
                            className={`
                                whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                                ${selectedCategory === cat.name
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30 shadow-md transform scale-105'
                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600'}
                            `}
                        >
                            {cat.name}
                        </button>
                        {showDeleteButton && onDeleteCategory && cat.name !== 'Genel' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(`"${cat.name}" kategorisini silmek istediğinize emin misiniz?`)) {
                                        onDeleteCategory(cat.id)
                                    }
                                }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover/chip:opacity-100 transition-opacity shadow-sm hover:scale-110"
                                title="Kategoriyi Sil"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>
                ))}

                {showAddButton && (
                    <button
                        onClick={onAddCategory}
                        className="whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium bg-gray-800 text-green-400 border border-dashed border-gray-600 hover:bg-gray-700 hover:text-green-300 hover:border-green-500 transition-colors flex items-center gap-1"
                    >
                        <Plus size={16} />
                        Ekle
                    </button>
                )}
            </div>

            {/* Right Scroll Button */}
            {showRightArrow && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 z-10 p-1 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full shadow-lg backdrop-blur-sm -mr-2 border border-gray-600"
                >
                    <ChevronRight size={20} />
                </button>
            )}
        </div>
    )
}

export default CategoryBar
