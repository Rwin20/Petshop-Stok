
function startHttpServer(expressApp) {
    if (!scannerServer) {
        scannerServer = http.createServer(expressApp);
    }

    // Sunucu hatalarını yakala
    scannerServer.on('error', (err) => {
        console.error('Sunucu hatasi:', err.message);
        if (err.code === 'EADDRINUSE') {
            console.error('Port ' + SCANNER_PORT + ' zaten kullaniliyor!');
        }
    });

    // Socket.io kurulumu
    io = new Server(scannerServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    configureExpressRoutes(expressApp);

    // Socket.io bağlantı yönetimi
    setupSocketHandlers();

    // Sunucuyu başlat
    const localIP = getLocalIP();
    scannerServer.listen(SCANNER_PORT, '0.0.0.0', () => {
        console.log('');
        console.log('========================================');
        console.log('  MOBIL BARKOD TARAYICI SUNUCUSU (HTTP - FALLBACK)');
        console.log('========================================');
        console.log('  Mobil Link: http://' + localIP + ':' + SCANNER_PORT + '/mobile-scanner');
        console.log('  Port: ' + SCANNER_PORT);
        console.log('  IP: ' + localIP);
        console.log('========================================');
        console.log('');
    });
}

function configureExpressRoutes(expressApp) {
    // Ana sayfa - test için
    expressApp.get('/', (req, res) => {
        res.send('<h1>Yemmama Barkod Sunucusu Calisiyor!</h1><p><a href="/mobile-scanner">Mobil Tarayici</a></p>');
    });

    // Mobil tarayıcı sayfası
    expressApp.get('/mobile-scanner', (req, res) => {
        res.send(getMobileScannerHTML());
    });
}

function setupSocketHandlers() {
    io.on('connection', (socket) => {
        connectedDevices++;
        console.log('[SCANNER] Mobil cihaz baglandi. Toplam:', connectedDevices);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('scanner:deviceCount', connectedDevices);
        }

        socket.on('scan', async (barcode) => {
            console.log('[SCANNER] Barkod alindi:', barcode);

            try {
                // 1. Önce veritabanında var mı?
                const existingProduct = db.getProductByBarcode(barcode);
                if (existingProduct) {
                    console.log('[SCANNER] Veritabanında bulundu:', existingProduct.name);
                    socket.emit('scan-result', { success: true, message: `Kayıtlı: ${existingProduct.name}` });
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('barcode:scanned', barcode);
                    }
                    return;
                }

                // 2. Yoksa Google Scraper çalıştır
                socket.emit('scan-result', { success: true, message: 'Google\'da aranıyor... 🔍' });

                const scraperResult = await scrapeProductDirectly(barcode);

                if (scraperResult) {
                    // Bulundu -> Mobilde onay ekranı göster
                    socket.emit('preview-product', {
                        barcode: barcode,
                        name: scraperResult.name,
                        image_url: scraperResult.image_url
                    });
                } else {
                    // Bulunamadı -> Manuel Ekleme Ekranını Göster
                    socket.emit('product-not-found', { barcode });
                }
            } catch (err) {
                console.error('[SCANNER] Scraper hatası:', err);
                socket.emit('scan-result', { success: false, message: 'Arama hatası' });
            }
        });

        socket.on('add-product', async (productData) => {
            try {
                console.log('[SCANNER] Mobilden ürün ekleniyor:', productData);
                const newProduct = {
                    barcode: productData.barcode,
                    name: productData.name,
                    image_url: productData.image_url,
                    purchase_price: 0,
                    sale_price: 0,
                    stock_quantity: 1,
                    critical_stock_level: 0
                };

                await db.ready;
                const savedProduct = db.createProduct(newProduct);

                socket.emit('scan-result', { success: true, message: 'Ürün eklendi! ✨' });

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('products:refresh');
                    mainWindow.webContents.send('barcode:scanned', savedProduct.barcode);
                }
            } catch (err) {
                console.error('[SCANNER] Ekleme hatası:', err);
                socket.emit('scan-result', { success: false, message: 'Ekleme başarısız' });
            }
        });

        socket.on('add-product-with-image', async (data) => {
            try {
                console.log('[SCANNER] Fotoğraflı ürün ekleniyor:', data.name);

                // 1. Resim verisini kaydet
                let imageUrl = null;
                if (data.image) {
                    try {
                        const base64Data = data.image.replace(/^data:image\/\w+;base64,/, "");
                        const buffer = Buffer.from(base64Data, 'base64');

                        const imagesDir = path.join(app.getPath('userData'), 'product-images');
                        if (!fs.existsSync(imagesDir)) {
                            fs.mkdirSync(imagesDir, { recursive: true });
                        }

                        const fileName = `img_${Date.now()}.jpg`;
                        const filePath = path.join(imagesDir, fileName);
                        fs.writeFileSync(filePath, buffer);
                        // Use triple slash for correct URL parsing on Windows
                        imageUrl = `local-resource:///${filePath.replace(/\\/g, '/')}`;
                    } catch (imgErr) {
                        console.error('[SCANNER] Resim kaydetme hatası:', imgErr);
                        // Resim hatası olsa bile ürünü eklemeye devam et
                    }
                }

                // 2. Otomatik Barkod Oluştur
                const barcode = `IMG-${Date.now().toString().slice(-8)}`;

                // 3. Ürünü Kaydet
                const newProduct = {
                    barcode: barcode,
                    name: data.name,
                    image_url: imageUrl,
                    purchase_price: parseFloat(data.price) || 0,
                    sale_price: parseFloat(data.price) || 0,
                    stock_quantity: 1,
                    critical_stock_level: 0
                };

                await db.ready;
                const savedProduct = db.createProduct(newProduct);

                socket.emit('scan-result', { success: true, message: 'Ürün fotoğrafıyla eklendi! 📸' });

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('products:refresh');
                    mainWindow.webContents.send('barcode:scanned', savedProduct.barcode);
                }

            } catch (err) {
                console.error('[SCANNER] Fotoğraflı ekleme hatası:', err);
                socket.emit('scan-result', { success: false, message: 'Hata: ' + err.message });
            }
        });

        socket.on('disconnect', () => {
            connectedDevices--;
            console.log('[SCANNER] Mobil cihaz ayrildi. Toplam:', connectedDevices);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('scanner:deviceCount', connectedDevices);
            }
        });
    });
}
