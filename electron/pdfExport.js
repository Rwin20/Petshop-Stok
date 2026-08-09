const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const path = require('path');

const fonts = require('./fonts');

// Font paths (base64)
const fontRegular = Buffer.from(fonts.regular, 'base64');
const fontBold = Buffer.from(fonts.bold, 'base64');

// Chart renderer (600x300 px)
const chartCanvas = new ChartJSNodeCanvas({ width: 540, height: 220, backgroundColour: '#1e293b' });

// Renk paleti
const COLORS = {
    bg: '#0f172a',
    card: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    purple: '#a855f7',
    green: '#22c55e',
    red: '#ef4444',
    orange: '#f97316',
    blue: '#3b82f6',
    cyan: '#06b6d4',
    white: '#ffffff',
};

function formatCurrency(value) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value || 0);
}

function formatTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// ============ PDF HEADER ============
function drawHeader(doc, title, subtitle) {
    // Gradient header background
    doc.rect(0, 0, doc.page.width, 80).fill('#1e1b4b');
    doc.rect(0, 75, doc.page.width, 5).fill('#a855f7');

    // Logo text
    doc.fontSize(24).fillColor('#a855f7').font(fontBold)
        .text('🐾 PETSHOP STOK', 40, 20, { continued: false });

    // Title
    doc.fontSize(12).fillColor('#e2e8f0').font(fontRegular)
        .text(title, 40, 48);

    // Subtitle (date)
    doc.fontSize(10).fillColor('#94a3b8')
        .text(subtitle, doc.page.width - 250, 30, { width: 210, align: 'right' });

    // Report generation time
    doc.fontSize(8).fillColor('#64748b')
        .text(`Oluşturma: ${new Date().toLocaleString('tr-TR')}`, doc.page.width - 250, 50, { width: 210, align: 'right' });

    doc.moveDown(2);
    doc.y = 100;
}

// ============ FOOTER ============
function drawFooter(doc) {
    const bottomY = doc.page.height - 30;
    doc.rect(0, bottomY - 5, doc.page.width, 35).fill('#1e1b4b');
    doc.fontSize(7).fillColor('#64748b')
        .text('Petshop Stok Yönetim Sistemi — Otomatik Rapor', 40, bottomY, { width: doc.page.width - 80, align: 'center' });
}

// ============ SUMMARY CARDS ============
function drawSummaryCards(doc, cards) {
    const startX = 40;
    const cardWidth = (doc.page.width - 80 - (cards.length - 1) * 10) / cards.length;
    const cardHeight = 55;
    const y = doc.y;

    cards.forEach((card, i) => {
        const x = startX + i * (cardWidth + 10);

        // Card background
        doc.roundedRect(x, y, cardWidth, cardHeight, 6).fill('#1e293b');
        doc.roundedRect(x, y, cardWidth, 3, 1).fill(card.color || '#a855f7');

        // Label
        doc.fontSize(7).fillColor('#94a3b8').font(fontRegular)
            .text(card.label, x + 8, y + 10, { width: cardWidth - 16 });

        // Value
        doc.fontSize(13).fillColor('#e2e8f0').font(fontBold)
            .text(card.value, x + 8, y + 24, { width: cardWidth - 16 });
    });

    doc.y = y + cardHeight + 15;
}

// ============ TABLE ============
function drawTable(doc, headers, rows, options = {}) {
    const startX = 40;
    const tableWidth = doc.page.width - 80;
    const colWidths = options.colWidths || headers.map(() => tableWidth / headers.length);
    const rowHeight = 18;
    const headerHeight = 22;

    // Check if we need a new page
    const totalHeight = headerHeight + rows.length * rowHeight + 10;
    if (doc.y + totalHeight > doc.page.height - 60) {
        doc.addPage();
        doc.y = 40;
    }

    // Section title
    if (options.title) {
        doc.fontSize(11).fillColor(options.titleColor || '#a855f7').font(fontBold)
            .text(options.title, startX, doc.y);
        doc.y += 5;
    }

    let y = doc.y;

    // Header row
    doc.rect(startX, y, tableWidth, headerHeight).fill('#334155');
    let x = startX;
    headers.forEach((header, i) => {
        doc.fontSize(7).fillColor('#94a3b8').font(fontBold)
            .text(header, x + 5, y + 6, { width: colWidths[i] - 10, align: options.aligns?.[i] || 'left' });
        x += colWidths[i];
    });
    y += headerHeight;

    // Data rows
    rows.forEach((row, rowIndex) => {
        // New page check
        if (y + rowHeight > doc.page.height - 60) {
            drawFooter(doc);
            doc.addPage();
            y = 40;
            // Re-draw header
            doc.rect(startX, y, tableWidth, headerHeight).fill('#334155');
            let hx = startX;
            headers.forEach((header, i) => {
                doc.fontSize(7).fillColor('#94a3b8').font(fontBold)
                    .text(header, hx + 5, y + 6, { width: colWidths[i] - 10, align: options.aligns?.[i] || 'left' });
                hx += colWidths[i];
            });
            y += headerHeight;
        }

        // Alternating row background
        if (rowIndex % 2 === 0) {
            doc.rect(startX, y, tableWidth, rowHeight).fill('#1e293b');
        } else {
            doc.rect(startX, y, tableWidth, rowHeight).fill('#0f172a');
        }

        x = startX;
        row.forEach((cell, i) => {
            const textColor = cell.color || '#e2e8f0';
            doc.fontSize(7).fillColor(textColor).font(fontRegular)
                .text(cell.text || cell, x + 5, y + 5, { width: colWidths[i] - 10, align: options.aligns?.[i] || 'left' });
            x += colWidths[i];
        });
        y += rowHeight;
    });

    // Bottom border
    doc.rect(startX, y, tableWidth, 1).fill('#334155');
    doc.y = y + 10;
}

// ============ CHART GENERATION ============
async function generateRevenueChart(dailyData) {
    const labels = dailyData.map(d => {
        const date = new Date(d.date);
        return `${date.getDate()}`;
    });
    const revenues = dailyData.map(d => d.revenue || 0);
    const profits = dailyData.map(d => d.profit || 0);

    const config = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Ciro',
                    data: revenues,
                    backgroundColor: 'rgba(168, 85, 247, 0.6)',
                    borderColor: 'rgba(168, 85, 247, 1)',
                    borderWidth: 1,
                    borderRadius: 3,
                },
                {
                    label: 'Kâr',
                    data: profits,
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1,
                    borderRadius: 3,
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                legend: {
                    labels: { color: '#e2e8f0', font: { size: 10 } }
                },
                title: {
                    display: true,
                    text: 'Günlük Ciro & Kâr',
                    color: '#e2e8f0',
                    font: { size: 13, weight: 'bold' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { size: 8 } },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    title: { display: true, text: 'Gün', color: '#94a3b8', font: { size: 9 } }
                },
                y: {
                    ticks: { color: '#94a3b8', font: { size: 8 } },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    title: { display: true, text: '₺', color: '#94a3b8', font: { size: 9 } }
                }
            }
        }
    };

    return await chartCanvas.renderToBuffer(config);
}

// ============ DAILY PDF ============
async function generateDailyPDF(report, date) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 0,
                bufferPages: true,
                info: { Title: `Günlük Rapor - ${date}`, Author: 'Petshop Stok' }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Background
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');

            // Header
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('tr-TR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            drawHeader(doc, 'GÜNLÜK SATIŞ RAPORU', formattedDate);

            // Calculate Real Net Profit (Profit - Waste - Expenses)
            const totalProfit = report.total_profit || 0;
            const wasteCost = report.total_waste_cost || 0;
            const expensesCost = report.total_expenses || 0;
            const realNetProfit = totalProfit - wasteCost - expensesCost;

            // Summary cards
            drawSummaryCards(doc, [
                { label: 'Satış Adedi', value: `${report.total_sales || 0}`, color: '#3b82f6' },
                { label: 'Toplam Ciro', value: formatCurrency(report.total_revenue), color: '#22c55e' },
                { label: 'Kâr', value: formatCurrency(totalProfit), color: '#a855f7' },
                { label: 'Giderler', value: formatCurrency(expensesCost), color: '#f97316' },
                { label: 'Zayi', value: formatCurrency(wasteCost), color: '#ef4444' },
            ]);

            // Net kâr bar (Calculated)
            const netProfitY = doc.y + 10;
            doc.roundedRect(40, netProfitY, doc.page.width - 80, 50, 6).fill('#1e293b');

            doc.fontSize(9).fillColor('#94a3b8').font(fontRegular)
                .text('Hesaplanan Net Kâr (Kâr - Zayi - Giderler):', 60, netProfitY + 12);

            doc.fontSize(16).fillColor(realNetProfit >= 0 ? '#22c55e' : '#ef4444').font(fontBold)
                .text(formatCurrency(realNetProfit), 60, netProfitY + 28);

            doc.y = netProfitY + 65;

            // Payment Breakdown
            if (report.payment_breakdown && report.payment_breakdown.length > 0) {
                const paymentRows = report.payment_breakdown.map(item => {
                    let label = 'Nakit';
                    if (item.payment_method === 'kart') label = 'Kredi Kartı';
                    if (item.payment_method === 'iban') label = 'IBAN';
                    if (item.payment_method === 'online') label = 'Online';
                    return [
                        label,
                        `${item.count} Adet`,
                        formatCurrency(item.total)
                    ];
                });

                drawTable(doc,
                    ['Ödeme Yöntemi', 'İşlem Sayısı', 'Toplam Tutar'],
                    paymentRows,
                    {
                        title: '💳 Ödeme Yöntemi Dağılımı',
                        colWidths: [150, 100, 150],
                        aligns: ['left', 'center', 'right']
                    }
                );
                doc.y += 20;
            }

            // Sales detail table
            if (report.sales && report.sales.length > 0) {
                const salesRows = report.sales.map(sale => {
                    const discount = sale.discount_amount || 0;
                    
                    let pMethod = sale.order_payment_method || sale.payment_method || 'nakit';
                    let paymentStr = '';
                    if (pMethod === 'parçalı') {
                        paymentStr = `Parçalı (N:${sale.cash_amount} K:${sale.card_amount})`;
                    } else if (pMethod === 'kart') {
                        paymentStr = 'Kart';
                    } else if (pMethod === 'nakit') {
                        paymentStr = 'Nakit';
                    } else {
                        paymentStr = pMethod;
                    }

                    const productDesc = `${sale.product_name.substring(0, 25)}...
[${sale.order_type || 'Dükkan'} | ${paymentStr}]`;

                    return [
                        formatTime(sale.sale_date),
                        productDesc.replace(/\n/g, ' '),
                        `${sale.quantity}`,
                        discount > 0 ? { text: `-${formatCurrency(discount)}`, color: '#f97316' } : { text: '-', color: '#64748b' },
                        formatCurrency(sale.total_price),
                        { text: `+${formatCurrency(sale.profit)}`, color: '#22c55e' }
                    ];
                });

                drawTable(doc,
                    ['Saat', 'Ürün', 'Adet', 'İndirim', 'Tutar', 'Kâr'],
                    salesRows,
                    {
                        title: '📋 Satış Detayları',
                        colWidths: [55, 180, 40, 70, 80, 80],
                        aligns: ['left', 'left', 'center', 'right', 'right', 'right']
                    }
                );
            } else {
                doc.fontSize(10).fillColor('#64748b').font(fontRegular)
                    .text('Bu tarihte satış yapılmamış.', 40, doc.y, { align: 'center', width: doc.page.width - 80 });
                doc.y += 20;
            }

            // Expenses Table (Giderler)
            if (report.expenses && report.expenses.length > 0) {
                if (doc.y + 60 > doc.page.height - 60) {
                    drawFooter(doc); doc.addPage(); doc.y = 40;
                }
                const expenseRows = report.expenses.map(e => [
                    formatTime(e.date),
                    e.title,
                    { text: `-${formatCurrency(e.amount)}`, color: '#f97316' }
                ]);

                drawTable(doc,
                    ['Saat', 'Açıklama', 'Tutar'],
                    expenseRows,
                    {
                        title: `💸 Giderler (Toplam: ${formatCurrency(expensesCost)})`,
                        titleColor: '#f97316',
                        colWidths: [60, 315, 120],
                        aligns: ['left', 'left', 'right']
                    }
                );
            }

            // Waste table
            if (report.waste_logs && report.waste_logs.length > 0) {
                if (doc.y + 60 > doc.page.height - 60) {
                    drawFooter(doc); doc.addPage(); doc.y = 40;
                }
                const wasteRows = report.waste_logs.map(log => [
                    formatTime(log.date),
                    log.product_name,
                    `${log.quantity}`,
                    log.reason,
                    { text: `-${formatCurrency(log.quantity * log.cost_price)}`, color: '#ef4444' }
                ]);

                drawTable(doc,
                    ['Saat', 'Ürün', 'Adet', 'Sebep', 'Zarar'],
                    wasteRows,
                    {
                        title: `💀 Zayi / Fire Kayıtları (Toplam: ${formatCurrency(wasteCost)})`,
                        titleColor: '#ef4444',
                        colWidths: [55, 160, 45, 140, 95],
                        aligns: ['left', 'left', 'center', 'left', 'right']
                    }
                );
            }

            drawFooter(doc);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ============ MONTHLY PDF ============
async function generateMonthlyPDF(report, year, month, wasteData, expenses) {
    return new Promise(async (resolve, reject) => {
        try {
            const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

            const doc = new PDFDocument({
                size: 'A4',
                margin: 0,
                bufferPages: true,
                info: { Title: `Aylık Rapor - ${monthNames[month - 1]} ${year}`, Author: 'Petshop Stok' }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Background
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');

            // Header
            drawHeader(doc, 'AYLIK SATIŞ RAPORU', `${monthNames[month - 1]} ${year}`);

            // Calculate Real Net Profit (Profit - Waste - Expenses)
            const totalProfit = report.total_profit || 0;
            const wasteCost = report.total_waste_cost || 0;
            const expensesCost = report.total_expenses || 0;
            const realNetProfit = totalProfit - wasteCost - expensesCost;

            const profitRate = report.total_revenue > 0 ? ((realNetProfit / report.total_revenue) * 100).toFixed(1) : '0.0';

            // Summary cards
            drawSummaryCards(doc, [
                { label: 'Satış Adedi', value: `${report.total_sales || 0}`, color: '#3b82f6' },
                { label: 'Toplam Ciro', value: formatCurrency(report.total_revenue), color: '#22c55e' },
                { label: 'Net Kâr', value: formatCurrency(realNetProfit), color: '#a855f7' },
                { label: 'Giderler', value: formatCurrency(expensesCost), color: '#f97316' },
                { label: 'Zayi', value: formatCurrency(wasteCost), color: '#ef4444' },
            ]);

            doc.y += 15;

            // Payment Breakdown
            if (report.payment_breakdown && report.payment_breakdown.length > 0) {
                if (doc.y + 60 > doc.page.height - 60) {
                    drawFooter(doc); doc.addPage(); doc.y = 40;
                }
                const paymentRows = report.payment_breakdown.map(item => {
                    let label = 'Nakit';
                    if (item.payment_method === 'kart') label = 'Kredi Kartı';
                    if (item.payment_method === 'iban') label = 'IBAN';
                    if (item.payment_method === 'online') label = 'Online';
                    return [
                        label,
                        `${item.count} Adet`,
                        formatCurrency(item.total)
                    ];
                });

                drawTable(doc,
                    ['Ödeme Yöntemi', 'İşlem Sayısı', 'Toplam Tutar'],
                    paymentRows,
                    {
                        title: '💳 Ödeme Yöntemi Dağılımı',
                        colWidths: [150, 100, 150],
                        aligns: ['left', 'center', 'right']
                    }
                );
                doc.y += 20;
            }

            // Chart
            if (report.daily_breakdown && report.daily_breakdown.length > 0) {
                try {
                    const chartImage = await generateRevenueChart(report.daily_breakdown);
                    const chartX = (doc.page.width - 540) / 2;
                    doc.roundedRect(chartX - 5, doc.y - 5, 550, 230, 6).fill('#1e293b');
                    doc.image(chartImage, chartX, doc.y, { width: 540, height: 220 });
                    doc.y += 235;
                } catch (chartErr) {
                    console.error('Chart generation error:', chartErr);
                    doc.fontSize(9).fillColor('#64748b')
                        .text('Grafik oluşturulamadı', 40, doc.y);
                    doc.y += 20;
                }

                // Daily table
                if (doc.y + 60 > doc.page.height - 60) {
                    drawFooter(doc); doc.addPage(); doc.y = 40;
                }
                const dailyRows = report.daily_breakdown.map(day => {
                    const dayDate = new Date(day.date);
                    const formatted = dayDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                    return [
                        formatted,
                        `${day.sales_count}`,
                        formatCurrency(day.revenue),
                        { text: `+${formatCurrency(day.profit)}`, color: '#22c55e' }
                    ];
                });

                drawTable(doc,
                    ['Tarih', 'Satış', 'Ciro', 'Kâr'],
                    dailyRows,
                    {
                        title: '📅 Günlük Dağılım',
                        colWidths: [130, 80, 150, 145],
                        aligns: ['left', 'center', 'right', 'right']
                    }
                );
            } else {
                doc.fontSize(10).fillColor('#64748b').font(fontRegular)
                    .text('Bu ayda satış yapılmamış.', 40, doc.y, { align: 'center', width: doc.page.width - 80 });
                doc.y += 20;
            }

            // Expenses Table (Monthly)
            if (expenses && expenses.length > 0) {
                if (doc.y + 60 > doc.page.height - 60) {
                    drawFooter(doc); doc.addPage(); doc.y = 40;
                }
                const expenseRows = expenses.map(e => {
                    const logDate = new Date(e.date.replace(' ', 'T') + (e.date.includes('Z') ? '' : 'Z'));
                    const formatted = logDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                    return [
                        formatted,
                        e.title,
                        { text: `-${formatCurrency(e.amount)}`, color: '#f97316' }
                    ];
                });

                drawTable(doc,
                    ['Tarih', 'Açıklama', 'Tutar'],
                    expenseRows,
                    {
                        title: `💸 Giderler (Toplam: ${formatCurrency(expensesCost)})`,
                        titleColor: '#f97316',
                        colWidths: [80, 295, 120],
                        aligns: ['left', 'left', 'right']
                    }
                );
            }

            // Waste logs for the month
            if (wasteData && wasteData.logs && wasteData.logs.length > 0) {
                if (doc.y + 60 > doc.page.height - 60) {
                    drawFooter(doc); doc.addPage(); doc.y = 40;
                }

                const wasteRows = wasteData.logs.map(log => {
                    const logDate = new Date(log.date.replace(' ', 'T') + (log.date.includes('Z') ? '' : 'Z'));
                    const formatted = logDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                    const time = logDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    return [
                        `${formatted} ${time}`,
                        log.product_name,
                        `${log.quantity}`,
                        log.reason || '-',
                        { text: `-${formatCurrency(log.quantity * log.cost_price)}`, color: '#ef4444' }
                    ];
                });

                drawTable(doc,
                    ['Tarih/Saat', 'Ürün', 'Adet', 'Sebep', 'Zarar'],
                    wasteRows,
                    {
                        title: `💀 Zayi / Fire Kayıtları (${formatCurrency(wasteData.total_waste_cost)})`,
                        titleColor: '#ef4444',
                        colWidths: [105, 140, 40, 130, 90],
                        aligns: ['left', 'left', 'center', 'left', 'right']
                    }
                );
            }

            drawFooter(doc);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateDailyPDF, generateMonthlyPDF };
