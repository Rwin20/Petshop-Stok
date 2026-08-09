const { app, BrowserWindow, ipcMain, protocol, net, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const fs = require('fs');
const AdmZip = require('adm-zip');
const Database = require('./database');
const WhatsAppManager = require('./whatsapp');

// NOTE: Electron 28 uses Node 18 where `File` is not defined globally.
// Cheerio v1.2+ requires `File` unexpectedly, so we polyfill it.
if (typeof File === 'undefined') {
    global.File = class File extends Blob {
        constructor(chunks, name, options = {}) {
            super(chunks, options);
            this.name = name;
            this.lastModified = options.lastModified || Date.now();
        }
    };
}

let mainWindow;
let db;
let whatsappManager;
let scannerServer;
let io;
let connectedDevices = 0;
let SCANNER_PORT = 3000;
let useHttps = false;

// Backup Constants - Google OAuth 2.0
const TOKEN_FILE = 'google-auth-token.json';
const { google } = require('googleapis');
const url = require('url');

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3456/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function getSavedTokens() {
    try {
        const tokenPath = path.join(app.getPath('userData'), TOKEN_FILE);
        if (fs.existsSync(tokenPath)) {
            return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading tokens:', e);
    }
    return null;
}

function saveTokens(tokens) {
    try {
        const tokenPath = path.join(app.getPath('userData'), TOKEN_FILE);
        fs.writeFileSync(tokenPath, JSON.stringify(tokens));
    } catch (e) {
        console.error('Error saving tokens:', e);
    }
}

function initGoogleAuth() {
    const tokens = getSavedTokens();
    if (tokens) {
        oauth2Client.setCredentials(tokens);
        return true;
    }
    return false;
}

async function getOrCreateDriveFolder() {
    initGoogleAuth();
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const query = "name='Petshopstok Yedekler' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    const res = await drive.files.list({ q: query, fields: 'files(id, name)' });

    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id;
    }

    const folderRes = await drive.files.create({
        requestBody: { name: 'Petshopstok Yedekler', mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
    });
    return folderRes.data.id;
}

const isDev = !app.isPackaged;

// Gerçek yerel IP adresini bul (Wi-Fi öncelikli)
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    const skipKeywords = ['vmware', 'virtualbox', 'vbox', 'docker', 'wsl', 'vethernet', 'hyper-v'];
    let wifiIP = null;
    let ethernetIP = null;

    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase();

        // Sanal adaptörleri atla
        if (skipKeywords.some(keyword => lowerName.includes(keyword))) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // Wi-Fi kontrolü
                if (lowerName.includes('wi-fi') || lowerName.includes('wireless') || lowerName.includes('wlan')) {
                    wifiIP = iface.address;
                }
                // Ethernet kontrolü
                else if (lowerName.includes('ethernet') || lowerName.includes('eth')) {
                    ethernetIP = iface.address;
                }
                // Diğer (Genel 192.168.x.x)
                else if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
                    if (!ethernetIP) ethernetIP = iface.address;
                }
            }
        }
    }

    // Varsa önce Wi-Fi, sonra Ethernet, yoksa localhost döndür
    return wifiIP || ethernetIP || '127.0.0.1';
}

// Mobil tarayıcı HTML sayfası
function getMobileScannerHTML() {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Petshop Stok Barkod Tarayıcı</title>
    <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
            min-height: 100vh;
            color: #e2e8f0;
            display: flex;
            flex-direction: column;
        }
        .header {
            padding: 20px;
            text-align: center;
            background: rgba(15, 23, 42, 0.8);
            border-bottom: 1px solid rgba(139, 92, 246, 0.3);
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            background: linear-gradient(135deg, #a78bfa, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 5px;
        }
        .status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 14px;
            color: #94a3b8;
        }
        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ef4444; 
            transition: background 0.3s ease;
        }
        .status-dot.connected {
            background: #22c55e;
            box-shadow: 0 0 10px #22c55e;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .scanner-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            gap: 20px;
        }
        #reader {
            width: 100%;
            max-width: 400px;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            margin-bottom: 10px;
        }
        #reader video { border-radius: 16px; }
        
        /* Preview Card Styles */
        #scan-result {
            display: none;
            width: 100%;
            max-width: 400px;
            background: rgba(30, 41, 59, 0.9);
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            backdrop-filter: blur(10px);
            animation: slideUp 0.3s ease;
        }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        #preview-image {
            width: 150px;
            height: 150px;
            object-fit: contain;
            border-radius: 12px;
            background: #fff;
            margin-bottom: 15px;
            border: 2px solid #e2e8f0;
        }
        #preview-name {
            font-size: 18px;
            font-weight: 600;
            color: #fff;
            margin-bottom: 20px;
            line-height: 1.4;
        }
        .action-buttons {
            display: flex;
            gap: 10px;
        }
        .btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .btn:active { transform: scale(0.95); }
        .btn-add {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
        }
        .btn-cancel {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .notification {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            border-radius: 12px;
            font-weight: 500;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        .notification.success {
            background: rgba(34, 197, 94, 0.9);
            border: 1px solid rgba(34, 197, 94, 0.5);
        }
        .notification.error {
            background: rgba(239, 68, 68, 0.9);
            border: 1px solid rgba(239, 68, 68, 0.5);
        }
        .notification.info {
            background: rgba(59, 130, 246, 0.9);
            border: 1px solid rgba(59, 130, 246, 0.5);
        }
        .footer {
            padding: 15px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            background: rgba(15, 23, 42, 0.8);
            border-top: 1px solid rgba(139, 92, 246, 0.2);
            margin-top: auto;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🐾 Yemmama Stok</div>
        <div class="status">
            <span class="status-dot" id="status-dot"></span>
            <span id="connection-status">Bağlanıyor...</span>
        </div>
    </div>

    <div class="scanner-container">
        <div id="reader"></div>
        
        <!-- Action Buttons -->
        <div style="display: flex; gap: 10px; width: 100%; max-width: 400px; margin-top: 10px;">
            <button onclick="document.getElementById('camera-input').click()" 
                style="flex: 1; padding: 15px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; border: none; font-weight: bold; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.3);">
                <span>📸</span> Fotoğraf Çek & Ekle
            </button>
            <input type="file" id="camera-input" accept="image/*" capture="environment" style="display: none;" onchange="handleCamera(this)">
        </div>

        <!-- Manual Entry -->
        <div style="margin-top: 15px; width: 100%; max-width: 400px; display: flex; gap: 5px;">
            <input type="number" id="manual-barcode" placeholder="Barkod No Girin" 
               style="flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #475569; background: #1e293b; color: white;">
            <button onclick="sendManualBarcode()" 
                style="padding: 12px 20px; border-radius: 10px; background: #3b82f6; color: white; border: none; font-weight: bold; cursor: pointer;">
            Ara
            </button>
        </div>

        <!-- Preview Card -->
        <div id="scan-result">
            <img id="preview-image" src="" alt="Ürün Görseli" onerror="this.onerror=null; this.src=''; this.alt='Resim Yok'">
            <h3 id="preview-name">Ürün Adı</h3>
            <div class="action-buttons">
                <button class="btn btn-cancel" onclick="cancelAdd()">İptal</button>
                <button class="btn btn-add" onclick="addProduct()">✅ Ekle</button>
            </div>
        </div>
    </div>

    <!-- Manual Add Modal -->
    <div id="manual-add-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.95); z-index: 2000; padding: 20px; flex-direction: column; justify-content: center; align-items: center;">
        <h3 style="color: #fff; margin-bottom: 20px; text-align: center;">Ürün Bulunamadı</h3>
        <p style="color: #94a3b8; margin-bottom: 20px; text-align: center; font-size: 14px;">Bu barkod veritabanlarında bulunamadı. Lütfen ismini girerek ekleyin.</p>
        
        <input type="text" id="manual-product-name" placeholder="Ürün Adı Giriniz" 
               style="width: 100%; max-width: 300px; padding: 15px; border-radius: 12px; border: 1px solid #475569; background: #1e293b; color: white; margin-bottom: 15px; font-size: 16px;">
        
        <div style="display: flex; gap: 10px; width: 100%; max-width: 300px;">
            <button onclick="closeManualAdd()" style="flex: 1; padding: 15px; border-radius: 12px; background: #334155; color: white; border: none; font-weight: bold;">İptal</button>
            <button onclick="submitManualAdd()" style="flex: 1; padding: 15px; border-radius: 12px; background: #22c55e; color: white; border: none; font-weight: bold;">Kaydet</button>
        </div>
    </div>

    <!-- Photo Add Modal -->
    <div id="photo-add-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.98); z-index: 3000; padding: 20px; flex-direction: column; overflow-y: auto;">
        <div style="width: 100%; max-width: 400px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px;">
            <h3 style="color: #fff; text-align: center; font-size: 20px;">📸 Yeni Ürün Ekle</h3>
            
            <img id="photo-preview" src="" style="width: 100%; height: 250px; object-fit: contain; background: #000; border-radius: 12px; border: 1px solid #475569;">
            
            <div>
                <label style="color: #94a3b8; font-size: 12px; margin-bottom: 4px; display: block;">Ürün Adı</label>
                <input type="text" id="photo-name" placeholder="Örn: Açık Kedi Maması" 
                    style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #475569; background: #1e293b; color: white; font-size: 16px;">
            </div>

            <div>
                <label style="color: #94a3b8; font-size: 12px; margin-bottom: 4px; display: block;">Satış Fiyatı (TL)</label>
                <input type="number" id="photo-price" placeholder="0.00" 
                    style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #475569; background: #1e293b; color: white; font-size: 16px;">
            </div>

            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button onclick="cancelPhotoAdd()" style="flex: 1; padding: 15px; border-radius: 12px; background: #334155; color: white; border: none; font-weight: bold;">İptal</button>
                <button onclick="submitPhotoProduct()" id="btn-save-photo" style="flex: 1; padding: 15px; border-radius: 12px; background: #8b5cf6; color: white; border: none; font-weight: bold;">Kaydet</button>
            </div>
            
            <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 10px;">
                * Sistem otomatik barkod oluşturacaktır.
            </p>
        </div>
    </div>

    <div class="footer">Yemmama Petshop © 2024</div>

    <script>
        const socket = io();
        let lastScannedCode = '';
        let lastScanTime = 0;
        let isProcessing = false;
        let currentProduct = null;
        let html5QrCode = null;
        let pendingBarcode = '';
        let photoBase64 = null;

        // Socket bağlantı durumu
        socket.on('connect', () => {
            document.getElementById('connection-status').textContent = 'Bağlandı ✅';
            document.getElementById('connection-status').style.color = '#4ade80';
            document.getElementById('status-dot').classList.add('connected');
        });

        socket.on('disconnect', () => {
            document.getElementById('connection-status').textContent = 'Bağlantı Koptu ❌';
            document.getElementById('connection-status').style.color = '#f87171';
            document.getElementById('status-dot').classList.remove('connected');
        });

        socket.on('connect_error', (error) => {
            document.getElementById('connection-status').textContent = 'Sunucu Bulunamadı ⚠️';
            document.getElementById('connection-status').style.color = '#fbbf24';
             document.getElementById('status-dot').classList.remove('connected');
        });

        // Geri bildirim ve Önizleme
        socket.on('scan-result', (data) => {
            showNotification(data.message, data.success ? 'success' : 'error');
            if(data.success) {
                navigator.vibrate && navigator.vibrate(100);
            }

            // Duraklat / Devam Et Logiği
            if(data.success && (data.message.includes('aranıyor') || data.message.includes('Searching'))) {
                if(html5QrCode && html5QrCode.getState() === 2) { 
                    html5QrCode.pause(true);
                }
            } else if (!data.success) {
                // Sadece "Bulunamadı" mesajı geldiyse devam et (Manual Add modu hariç)
                isProcessing = false;
                if(html5QrCode && html5QrCode.getState() === 3) { 
                    html5QrCode.resume();
                }
            }
        });

        socket.on('product-not-found', (data) => {
            pendingBarcode = data.barcode;
            showNotification('Ürün bulunamadı, manuel ekleyin', 'info');
            
            // Modalı Göster
            document.getElementById('manual-add-modal').style.display = 'flex';
            document.getElementById('manual-product-name').focus();
            
            if(html5QrCode && html5QrCode.getState() === 2) { 
                html5QrCode.pause(true);
            }
        });

        function closeManualAdd() {
            document.getElementById('manual-add-modal').style.display = 'none';
            document.getElementById('manual-product-name').value = '';
            isProcessing = false;
            pendingBarcode = '';
            
            if(html5QrCode && html5QrCode.getState() === 3) { 
                html5QrCode.resume(); 
            }
        }

        function submitManualAdd() {
            const name = document.getElementById('manual-product-name').value.trim();
            if (!name) {
                showNotification('Lütfen ürün adı girin', 'error');
                return;
            }

            socket.emit('add-product', {
                barcode: pendingBarcode,
                name: name,
                image_url: null
            });
            
            closeManualAdd();
        }

        socket.on('preview-product', (product) => {
            currentProduct = product;
            
            // Kartı güncelle
            document.getElementById('preview-image').src = product.image_url || '';
            document.getElementById('preview-name').textContent = product.name;
            
            // Kartı göster
            document.getElementById('reader').style.display = 'none';
            document.getElementById('scan-result').style.display = 'block';
            
            if(html5QrCode && html5QrCode.getState() === 2) { 
                html5QrCode.pause(true); 
            }
        });

        function cancelAdd() {
            document.getElementById('scan-result').style.display = 'none';
            document.getElementById('reader').style.display = 'block';
            currentProduct = null;
            isProcessing = false;
            
            if(html5QrCode && html5QrCode.getState() === 3) { 
                html5QrCode.resume(); 
            }
        }

        function addProduct() {
            if(!currentProduct) return;
            socket.emit('add-product', currentProduct);
            cancelAdd(); 
        }

        function showNotification(message, type) {
            const existing = document.querySelector('.notification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.className = 'notification ' + type;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => notification.remove(), 3000);
        }

        function sendManualBarcode() {
            const input = document.getElementById('manual-barcode');
            const code = input.value.trim();
            if (code) {
                sendBarcode(code);
                input.value = '';
                input.blur(); 
            }
        }

        function sendBarcode(code) {
            const now = Date.now();
            if (isProcessing) return; 
            
            if (code === lastScannedCode && now - lastScanTime < 3000) return;
            
            lastScannedCode = code;
            lastScanTime = now;
            isProcessing = true; 
            
            if(html5QrCode && html5QrCode.getState() === 2) { 
                html5QrCode.pause(true); 
            }

            socket.emit('scan', code);
            navigator.vibrate && navigator.vibrate(50);
            showNotification('Aranıyor...', 'info');
        }

        // --- PHOTO CAPTURE LOGIC ---
        
        function handleCamera(input) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                
                showNotification('Fotoğraf işleniyor...', 'info');

                const img = new Image();
                img.onload = function() {
                    URL.revokeObjectURL(img.src); // Free memory immediately
                    
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Max dimensions (600px prevents RAM crashes on 48MP+ mobile cameras)
                    const MAX_WIDTH = 600;
                    const MAX_HEIGHT = 600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG 0.6
                    photoBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    
                    // Show Modal
                    document.getElementById('photo-preview').src = photoBase64;
                    document.getElementById('photo-add-modal').style.display = 'flex';
                    
                    // Pause scanner if running
                    if(html5QrCode && html5QrCode.getState() === 2) { 
                        html5QrCode.pause(true);
                    }
                };
                img.src = URL.createObjectURL(file);
            }
            // Reset input so same file can be selected again
            input.value = '';
        }

        function cancelPhotoAdd() {
            document.getElementById('photo-add-modal').style.display = 'none';
            document.getElementById('photo-name').value = '';
            document.getElementById('photo-price').value = '';
            photoBase64 = null;
            
            if(html5QrCode && html5QrCode.getState() === 3) { 
                html5QrCode.resume(); 
            }
        }

        function submitPhotoProduct() {
            const name = document.getElementById('photo-name').value.trim();
            const price = document.getElementById('photo-price').value.trim();
            
            if (!name) {
                showNotification('Ürün adı zorunludur!', 'error');
                return;
            }
            if (!photoBase64) {
                showNotification('Fotoğraf yüklenemedi!', 'error');
                return;
            }

            const btn = document.getElementById('btn-save-photo');
            btn.disabled = true;
            btn.textContent = 'Kaydediliyor...';

            socket.emit('add-product-with-image', {
                name: name,
                price: price,
                image: photoBase64
            });

            // Note: Don't cancel immediately, wait for scan-result to cancel 
            // but we will close it immediately for UX to let user scan more.
            setTimeout(() => {
                cancelPhotoAdd();
                btn.disabled = false;
                btn.textContent = 'Kaydet';
            }, 500);
        }

        // QR/Barkod tarayıcıyı başlat
        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => sendBarcode(decodedText),
            () => {}
        ).catch((err) => {
             console.error('Kamera hatası:', err);
             // Kamera hatası olsa bile manuel işlem yapılabilmeli
             // showNotification('Kamera erişimi verilemedi', 'error');
        });
    </script>
</body>
</html>`;
}

// Express HTTPS sunucu kurulumu (Basit ve Garantili)
// Express HTTPS sunucu kurulumu (Basit ve Garantili)
function startScannerServer() {
    const expressApp = express();
    const https = require('https');

    let options = {};

    // Sertifikaları Yükle
    try {
        const certPath = path.join(__dirname, 'certs', 'cert.pem');
        const keyPath = path.join(__dirname, 'certs', 'key.pem');

        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
            options = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };
            useHttps = true;
            console.log('[HTTPS] Sertifikalar yüklendi.');
        } else {
            console.error('[HTTPS] Sertifika dosyaları bulunamadı! HTTP moduna düşülüyor.');
        }
    } catch (e) {
        console.error('[HTTPS] Sertifika yükleme hatası:', e);
    }

    // Sunucu oluştur
    if (useHttps) {
        try {
            scannerServer = https.createServer(options, expressApp);
        } catch (e) {
            console.error('[HTTPS] Sunucu başlatılamadı, HTTP deneniyor:', e);
            scannerServer = http.createServer(expressApp);
            useHttps = false;
        }
    } else {
        scannerServer = http.createServer(expressApp);
    }

    // Sunucu hatalarını yakala
    scannerServer.on('error', (err) => {
        console.error('Sunucu hatasi:', err.message);
        if (err.code === 'EADDRINUSE') {
            console.error('Port ' + SCANNER_PORT + ' zaten kullaniliyor! Rastgele bir port atanacak...');
            scannerServer.listen(0, '0.0.0.0');
        }
    });

    // Socket.io kurulumu
    io = new Server(scannerServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        maxHttpBufferSize: 5e7 // 50MB payload limit for high res camera uploads
    });

    // Ana sayfa - test için
    expressApp.get('/', (req, res) => {
        res.send('<h1>Yemmama Barkod Sunucusu Calisiyor!</h1><p><a href="/mobile-scanner">Mobil Tarayici</a></p>');
    });

    // Mobil tarayıcı sayfası
    expressApp.get('/mobile-scanner', (req, res) => {
        res.send(getMobileScannerHTML());
    });

    // Socket.io bağlantı yönetimi
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

                let scraperResult = null;
                try {
                    scraperResult = await Promise.any([
                        searchKolaymama(barcode),
                        searchPetlebi(barcode),
                        searchMarkamama(barcode)
                    ]);
                } catch (e) {
                    scraperResult = null;
                }

                if (scraperResult && scraperResult.found) {
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

    // Sunucuyu başlat - 0.0.0.0 ile tüm ağ arayüzlerinde dinle
    const localIP = getLocalIP();
    scannerServer.listen(SCANNER_PORT, '0.0.0.0');
    
    scannerServer.on('listening', () => {
        SCANNER_PORT = scannerServer.address().port;
        const protocol = useHttps ? 'https' : 'http';
        console.log('');
        console.log('========================================');
        console.log(`  MOBIL BARKOD TARAYICI SUNUCUSU (${protocol.toUpperCase()})`);
        console.log('========================================');
        console.log(`  Mobil Link: ${protocol}://${localIP}:${SCANNER_PORT}/mobile-scanner`);
        console.log('  Port: ' + SCANNER_PORT);
        console.log('  IP: ' + localIP);
        console.log('========================================');
        console.log('');
    });
}

// ============ BACKUP OPERATIONS ============

// Create Manual Backup
ipcMain.handle('local-backup:create', async () => {
    try {
        if (db) {
            const backupPath = db.backup();
            return { success: true, path: backupPath };
        }
        return { success: false, error: 'Database not initialized' };
    } catch (err) {
        console.error('Backup error:', err);
        return { success: false, error: err.message };
    }
});

// List Backups
ipcMain.handle('local-backup:list', async () => {
    try {
        const userDataPath = app.getPath('userData');
        const backupsDir = path.join(userDataPath, 'backups');

        if (!fs.existsSync(backupsDir)) {
            return [];
        }

        const files = fs.readdirSync(backupsDir)
            .filter(file => file.endsWith('.db') || file.endsWith('.sqlite'))
            .map(file => {
                const stats = fs.statSync(path.join(backupsDir, file));
                return {
                    name: file,
                    path: path.join(backupsDir, file),
                    date: stats.mtime,
                    size: stats.size
                };
            })
            .sort((a, b) => b.date - a.date); // Newest first

        return files;
    } catch (err) {
        console.error('List backups error:', err);
        return [];
    }
});

// Restore Backup
ipcMain.handle('local-backup:restore', async (event, backupFilePath) => {
    try {
        console.log('Restoring backup from:', backupFilePath);

        // 1. Validate file exists
        const userDataPath = app.getPath('userData');
        // If just filename is passed, construct path
        const fullBackupPath = backupFilePath.includes(path.sep)
            ? backupFilePath
            : path.join(userDataPath, 'backups', backupFilePath);

        if (!fs.existsSync(fullBackupPath)) {
            throw new Error('Yedek dosyası bulunamadı: ' + fullBackupPath);
        }

        const currentDbPath = path.join(userDataPath, 'petshop-stok.db');

        // 2. Create a safety backup of current DB before replacing
        if (fs.existsSync(currentDbPath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safetyBackupPath = path.join(userDataPath, 'backups', `safety_restore_${timestamp}.db`);
            await fs.promises.copyFile(currentDbPath, safetyBackupPath);
        }

        // 3. Overwrite the DB file
        await fs.promises.copyFile(fullBackupPath, currentDbPath);

        // 4. Restart Application
        app.relaunch();
        app.exit(0);

        return { success: true };
    } catch (err) {
        console.error('Restore error:', err);
        return { success: false, error: err.message };
    }
});

// Open Backups Folder
ipcMain.on('local-backup:open-folder', () => {
    const backupsDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }
    shell.openPath(backupsDir);
});

// --- Cloud Backup Handlers ---

ipcMain.handle('cloud-backup:status', async () => {
    return { loggedIn: !!getSavedTokens() };
});

ipcMain.handle('cloud-backup:login', async () => {
    return new Promise((resolve) => {
        const server = http.createServer(async (req, res) => {
            try {
                const reqUrl = url.parse(req.url, true);
                if (reqUrl.pathname === '/oauth2callback') {
                    const code = reqUrl.query.code;
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>Kimlik doğrulama başarılı!</h1><p>Bu sekmeyi kapatabilir ve uygulamaya dönebilirsiniz.</p>');
                    server.close();

                    if (code) {
                        const { tokens } = await oauth2Client.getToken(code);
                        oauth2Client.setCredentials(tokens);
                        saveTokens(tokens);

                        // Notify frontend
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('cloud-backup:login-success');
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }).listen(3456, () => {
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
                prompt: 'consent'
            });
            require('electron').shell.openExternal(authUrl);
        });

        server.on('error', (e) => {
            console.error('OAuth server error:', e);
            resolve({ success: false, error: 'Port kullanımda veya sunucu başlatılamadı.' });
        });

        resolve({ success: true, message: 'Tarayıcıda giriş ekranı açıldı.' });
    });
});

ipcMain.handle('cloud-backup:logout', async () => {
    const tokenPath = path.join(app.getPath('userData'), TOKEN_FILE);
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    oauth2Client.setCredentials({});
    return { success: true };
});

ipcMain.handle('cloud-backup:start', async () => {
    const os = require('os');
    const tmpZipPath = path.join(os.tmpdir(), `yemmama_backup_${Date.now()}.zip`);
    try {
        if (!initGoogleAuth()) throw new Error('Google giris yapilmamis!');

        // Token yenileme: suresi dolmus olabilir
        try {
            const tokenInfo = oauth2Client.credentials;
            const isExpired = tokenInfo.expiry_date && tokenInfo.expiry_date < (Date.now() + 60000);
            if (isExpired && tokenInfo.refresh_token) {
                console.log('[BACKUP] Token suresi dolmus, yenileniyor...');
                const { credentials } = await oauth2Client.refreshAccessToken();
                oauth2Client.setCredentials(credentials);
                saveTokens(credentials);
                console.log('[BACKUP] Token yenilendi.');
            }
        } catch (refreshErr) {
            console.warn('[BACKUP] Token yenileme basarisiz, mevcut token deneniyor:', refreshErr.message);
        }

        const userDataPath = app.getPath('userData');
        const zip = new AdmZip();

        // 1. Add Database
        const dbPath = path.join(userDataPath, 'petshop-stok.db');
        if (fs.existsSync(dbPath)) {
            zip.addLocalFile(dbPath);
        }

        // 2. Add Images
        const imagesDir = path.join(userDataPath, 'product-images');
        if (fs.existsSync(imagesDir)) {
            zip.addLocalFolder(imagesDir, 'product-images');
        }

        // 3. Write zip to temp file (daha guvenilir - in-memory stream Drive API ile sorun cikartiyor)
        zip.writeZip(tmpZipPath);
        const fileName = `backup_${Date.now()}.zip`;

        const folderId = await getOrCreateDriveFolder();
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Upload with 60s timeout
        const fileMetadata = { name: fileName, parents: [folderId] };
        const media = { mimeType: 'application/zip', body: fs.createReadStream(tmpZipPath) };

        const uploadPromise = drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name'
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Yukleme zaman asimina ugradi (5dk). Internet baglantinizi kontrol edin.')), 300000)
        );

        const res = await Promise.race([uploadPromise, timeoutPromise]);

        // Cleanup temp file
        if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath);

        return { success: true, fileName: res.data.name };

    } catch (error) {
        // Cleanup temp file on error too
        if (fs.existsSync(tmpZipPath)) {
            try { fs.unlinkSync(tmpZipPath); } catch (_) { }
        }
        console.error('Backup error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('cloud-backup:list', async () => {
    try {
        if (!initGoogleAuth()) return { success: false, error: 'Google giriş yapılmamış!' };

        const folderId = await getOrCreateDriveFolder();
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, createdTime, size)',
            orderBy: 'createdTime desc',
            pageSize: 100
        });

        const files = (res.data.files || []).map(f => ({
            name: f.name,
            id: f.id,
            created_at: f.createdTime,
            metadata: { size: parseInt(f.size || '0') }
        }));

        return { success: true, files };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('cloud-backup:restore', async (_, fileId) => {
    try {
        if (!initGoogleAuth()) throw new Error('Google giriş yapılmamış!');

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // 1. Download
        const res = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );

        const buffer = Buffer.from(res.data);
        const tempZipPath = path.join(app.getPath('temp'), `restore_${Date.now()}.zip`);
        fs.writeFileSync(tempZipPath, buffer);

        // 2. Extract
        const zip = new AdmZip(tempZipPath);
        const userDataPath = app.getPath('userData');

        // Extract everything
        zip.extractAllTo(userDataPath, true); // overwrite

        fs.unlinkSync(tempZipPath);

        return { success: true, message: 'Yedek geri yüklendi! Lütfen uygulamayı yeniden başlatın.' };

    } catch (error) {
        console.error('Restore error:', error);
        return { success: false, error: error.message };
    }
});

// --- End Backup Handlers ---
// Tarama sonucu mobil cihaza gönder
function sendScanResult(success, message) {
    if (io) {
        io.emit('scan-result', { success, message });
    }
}

function performSilentBackup() {
    try {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'yemmama-stok.db');
        const backupsDir = path.join(userDataPath, 'Backups');

        if (!fs.existsSync(dbPath)) return;

        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        const date = new Date();
        const timestamp = date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0') + '_' +
            String(date.getHours()).padStart(2, '0') + '-' +
            String(date.getMinutes()).padStart(2, '0') + '-' +
            String(date.getSeconds()).padStart(2, '0');

        const backupPath = path.join(backupsDir, `backup_${timestamp}.sqlite`);
        fs.copyFileSync(dbPath, backupPath);
        console.log('[BACKUP] Sessiz Hayalet Yedek alındı:', backupPath);

        // Rotasyon (Son 50)
        const files = fs.readdirSync(backupsDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
            .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length > 50) {
            const toDelete = files.slice(50);
            toDelete.forEach(file => {
                fs.unlinkSync(path.join(backupsDir, file.name));
                console.log('[BACKUP] Eski yedek temizlendi:', file.name);
            });
        }
    } catch (err) {
        console.error('[BACKUP] Hata:', err);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        frame: true,
        backgroundColor: '#0f172a',
        show: false
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    whatsappManager = new WhatsAppManager(mainWindow.webContents);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Custom protocol privileges
protocol.registerSchemesAsPrivileged([
    { scheme: 'local-resource', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true } }
]);

app.whenReady().then(async () => {
    // Register custom protocol for local resources
    protocol.handle('local-resource', async (request) => {
        try {
            // Get the path part of the URL
            let urlPath = request.url.replace('local-resource://', '');

            // If it starts with /, it might be /C:/path... on Windows from triple slash
            // decode first
            let decodedPath = decodeURIComponent(urlPath);

            // Remove leading slashes if it looks like a Windows drive path (e.g. /C:/...)
            // This handles local-resource:///C:/... becoming /C:/...
            if (process.platform === 'win32' && decodedPath.match(/^\/[a-zA-Z]:/)) {
                decodedPath = decodedPath.slice(1);
            }

            // Normalize path separators
            let normalizePath = path.normalize(decodedPath);

            // Fix for Windows paths where drive letter loses colon (e.g. c\Users -> C:\Users)
            // This happens when URL is local-resource://c/Users instead of local-resource:///C:/Users
            if (process.platform === 'win32') {
                // If path starts with a single letter followed by slash or backslash, but no colon
                if (normalizePath.match(/^[a-zA-Z][\/\\]/)) {
                    normalizePath = normalizePath[0] + ':' + normalizePath.slice(1);
                }
                // Also ensure the first letter is uppercase for consistency (optional but good)
                normalizePath = normalizePath.charAt(0).toUpperCase() + normalizePath.slice(1);
            }

            // console.log('[PROTOCOL] Loading:', { url: request.url, p1: urlPath, decoded: decodedPath, final: normalizePath });

            let data;
            try {
                data = await fs.promises.readFile(normalizePath);
            } catch (readError) {
                // FALLBACK: If absolute path fails (e.g. after DB restore from another PC)
                // extract filename and look in the local 'product-images' folder
                const filename = path.basename(normalizePath);
                const localImagesDir = path.join(app.getPath('userData'), 'product-images');
                const fallbackPath = path.join(localImagesDir, filename);

                try {
                    data = await fs.promises.readFile(fallbackPath);
                    console.log(`[PROTOCOL] Fallback successful for: ${filename}`);
                } catch (fallbackError) {
                    console.error('[PROTOCOL] Error (both original and fallback failed):', { original: normalizePath, fallback: fallbackPath });
                    return new Response('Not Found', { status: 404 });
                }
            }

            return new Response(data, {
                headers: { 'content-type': 'image/jpeg' }
            });
        } catch (error) {
            console.error('[PROTOCOL] Critical Error:', error);
            return new Response('Not Found', { status: 404 });
        }
    });

    // Initialize database
    // const Database = require('./database'); // Moved to top
    db = new Database();
    await db.ready;

    // Sessiz Yedekleme Başlat
    performSilentBackup();

    // Start barcode scanner server
    startScannerServer();

    createWindow();

    // Auto Updater settings
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Check for updates
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }

    autoUpdater.on('update-downloaded', (info) => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Güncelleme Hazır',
            message: 'Yeni bir sürüm indirildi. Uygulamayı şimdi yeniden başlatarak güncellemeyi kurmak ister misiniz?',
            buttons: ['Evet, Şimdi Kur', 'Daha Sonra']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (db && db.save) {
        console.log('[SYSTEM] Kapanıyor... Veritabanı diske son kez yazılıyor.');
        db.save();
    }
});

// IPC Handlers - Auth (RBAC)
ipcMain.handle('auth:login', async (_, pin) => {
    await db.ready;
    try {
        return { success: true, user: db.verifyUserPin(pin) };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('auth:verifyAdmin', async (_, pin) => {
    await db.ready;
    try {
        return { success: true, isAdmin: db.verifyAdminPin(pin) };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('auth:getUsers', async () => {
    await db.ready;
    return db.getAllUsers();
});

ipcMain.handle('auth:updatePin', async (_, id, oldPin, newPin) => {
    await db.ready;
    try {
        return db.updateUserPin(id, oldPin, newPin);
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Handlers - Products
ipcMain.handle('products:getAll', async () => {
    await db.ready;
    return db.getAllProducts();
});

ipcMain.handle('products:getById', async (_, id) => {
    await db.ready;
    return db.getProductById(id);
});

ipcMain.handle('products:getByBarcode', async (_, barcode) => {
    await db.ready;
    return db.getProductByBarcode(barcode);
});

// Barkod ile ürün bilgisi çek (3 Site Yarışı - Promise.any)
ipcMain.handle('products:lookupBarcode', async (_, rawBarcode) => {
    try {
        const barcode = (rawBarcode || '').trim();
        if (!barcode) return { found: false };

        console.log(`[BARCODE] 3 sitede yarış başlatıldı: ${barcode}`);

        // İlk resolve dönen kazanır, diğerleri iptal edilir
        const result = await Promise.any([
            searchKolaymama(barcode),
            searchPetlebi(barcode),
            searchMarkamama(barcode),
            searchBarkodoku(barcode)
        ]);

        console.log(`[BARCODE] Kazanan (${result.source}): ${result.name}`);
        return result;

    } catch (err) {
        // AggregateError means ALL promises threw (rejected)
        console.log(`[BARCODE] Hiçbir sitede ürün bulunamadı veya hata oluştu: ${barcode}`);
        return { found: false };
    }
});

ipcMain.handle('products:create', async (_, product) => {
    await db.ready;
    return db.createProduct(product);
});

ipcMain.handle('products:update', async (_, id, product) => {
    await db.ready;
    return db.updateProduct(id, product);
});

ipcMain.handle('products:delete', async (_, id) => {
    await db.ready;
    return db.deleteProduct(id);
});

ipcMain.handle('products:search', async (_, query) => {
    await db.ready;
    return db.searchProducts(query);
});

ipcMain.handle('products:getCritical', async () => {
    await db.ready;
    return db.getCriticalStockProducts();
});

ipcMain.handle('products:getExpiring', async () => {
    await db.ready;
    return db.getExpiringProducts();
});

ipcMain.handle('products:saveImage', async (_, base64Data) => {
    try {
        const userDataPath = app.getPath('userData');
        const imagesDir = path.join(userDataPath, 'product-images');

        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }

        // Extract base64 part
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Geçersiz resim formatı');
        }

        const ext = matches[1].split('/')[1] || 'jpeg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `img_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = path.join(imagesDir, filename);

        fs.writeFileSync(filePath, buffer);
        console.log('[IMAGE SAVED]', filePath);

        // Return local file url (file://...)
        return `file://${filePath}`;
    } catch (err) {
        console.error('Image save error:', err);
        throw err;
    }
});

// IPC Handlers - Sales
ipcMain.handle('sales:create', async (_, sale) => {
    await db.ready;
    return db.createSale(sale);
});

ipcMain.handle('sales:createBatch', async (_, items, discount, paymentDetails) => {
    return db.createBatchSale(items, discount, paymentDetails);
});

ipcMain.handle('sales:getToday', async () => {
    await db.ready;
    return db.getTodaySales();
});

ipcMain.handle('sales:getTodayOrders', async () => {
    await db.ready;
    return db.getTodayOrders();
});

ipcMain.handle('sales:getByDateRange', async (_, start, end) => {
    await db.ready;
    return db.getSalesByDateRange(start, end);
});

ipcMain.handle('sales:delete', async (_, id, adminPin) => {
    await db.ready;
    try {
        const isAdmin = db.verifyAdminPin(adminPin);
        if (!isAdmin) {
            throw new Error('Yetkisiz işlem! Geçerli bir Yönetici PIN kodu girilmelidir.');
        }
        return db.deleteSale(id);
    } catch (e) {
        throw new Error(e.message);
    }
});

// IPC Handlers - WhatsApp
ipcMain.handle('whatsapp:start', async () => {
    if (whatsappManager) {
        whatsappManager.init();
        return { success: true };
    }
    return { success: false, error: 'Manager not initialized' };
});

ipcMain.handle('whatsapp:logout', async () => {
    if (whatsappManager) {
        await whatsappManager.logout();
        return { success: true };
    }
    return { success: false, error: 'Manager not initialized' };
});

ipcMain.handle('whatsapp:sendBatch', async (_, customers, template) => {
    if (whatsappManager) {
        try {
            const result = await whatsappManager.startQueue(customers, template);
            return { success: true, data: result };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
    return { success: false, error: 'Manager not initialized' };
});

ipcMain.handle('whatsapp:stopBatch', async () => {
    if (whatsappManager) {
        whatsappManager.stopQueue();
        return { success: true };
    }
    return { success: false, error: 'Manager not initialized' };
});

ipcMain.handle('whatsapp:status', async () => {
    if (whatsappManager) {
        return { success: true, status: whatsappManager.getStatus() };
    }
    return { success: false, error: 'Manager not initialized' };
});

// IPC Handlers - Reports  
ipcMain.handle('reports:daily', async (_, date) => {
    await db.ready;
    return db.getDailyReport(date);
});

ipcMain.handle('reports:monthly', async (_, year, month) => {
    await db.ready;
    return db.getMonthlyReport(year, month);
});

ipcMain.handle('reports:dashboard', async () => {
    await db.ready;
    return db.getDashboardStats();
});

// IPC Handlers - Waste Management
ipcMain.handle('waste:create', async (_, productId, quantity, reason) => {
    await db.ready;
    return db.createWasteLog(productId, quantity, reason);
});

ipcMain.handle('waste:getByDate', async (_, date) => {
    await db.ready;
    return db.getWasteByDate(date);
});

ipcMain.handle('waste:getByDateRange', async (_, start, end) => {
    await db.ready;
    return db.getWasteByDateRange(start, end);
});

// IPC Handlers - Expenses Management
ipcMain.handle('expenses:add', async (_, { title, amount, date }) => {
    await db.ready;
    return db.addExpense(title, amount, date);
});

ipcMain.handle('expenses:delete', async (_, id) => {
    await db.ready;
    return db.deleteExpense(id);
});

ipcMain.handle('expenses:get-by-date-range', async (_, { start, end }) => {
    await db.ready;
    return db.getExpensesByDateRange(start, end);
});

ipcMain.handle('expenses:get-by-date', async (_, date) => {
    await db.ready;
    return db.getExpensesByDate(date);
});

// IPC Handlers - Categories
ipcMain.handle('categories:getAll', async () => {
    await db.ready;
    return db.getAllCategories();
});

ipcMain.handle('categories:add', async (_, name) => {
    await db.ready;
    return db.addCategory(name);
});

ipcMain.handle('categories:delete', async (_, id) => {
    await db.ready;
    return db.deleteCategory(id);
});

// IPC Handlers - Customers
ipcMain.handle('customers:getAll', async () => {
    await db.ready;
    return db.getAllCustomers();
});

ipcMain.handle('customers:getById', async (_, id) => {
    await db.ready;
    return db.getCustomerById(id);
});

ipcMain.handle('customers:create', async (_, customer) => {
    await db.ready;
    return db.createCustomer(customer);
});

ipcMain.handle('customers:update', async (_, id, customer) => {
    await db.ready;
    return db.updateCustomer(id, customer);
});

ipcMain.handle('customers:delete', async (_, id) => {
    await db.ready;
    return db.deleteCustomer(id);
});

ipcMain.handle('customers:search', async (_, query) => {
    await db.ready;
    return db.searchCustomers(query);
});

ipcMain.handle('customers:getBalance', async (_, id) => {
    await db.ready;
    return db.getCustomerBalance(id);
});

ipcMain.handle('customers:getWithDebt', async () => {
    await db.ready;
    return db.getCustomersWithDebt();
});

// IPC Handlers - Customer Debt Stats
ipcMain.handle('customers:getDebtStats', async () => {
    await db.ready;
    return db.getTotalDebtStats();
});

// IPC Handlers - Credit Transactions
ipcMain.handle('credit:addDebt', async (_, customerId, amount, description) => {
    await db.ready;
    return db.addDebt(customerId, amount, description);
});

ipcMain.handle('credit:addPayment', async (_, customerId, amount, description) => {
    await db.ready;
    return db.addPayment(customerId, amount, description);
});

ipcMain.handle('credit:getTransactions', async (_, customerId) => {
    await db.ready;
    return db.getCustomerTransactions(customerId);
});

ipcMain.handle('credit:deleteTransaction', async (_, id) => {
    await db.ready;
    return db.deleteTransaction(id);
});

// IPC Handlers - Data Reset
ipcMain.handle('reset:sales', async () => {
    await db.ready;
    return db.resetSalesData();
});

ipcMain.handle('reset:customers', async () => {
    await db.ready;
    return db.resetCustomerData();
});

ipcMain.handle('reset:products', async () => {
    await db.ready;
    return db.resetProductData();
});

ipcMain.handle('reset:all', async () => {
    await db.ready;
    return db.resetAllData();
});

// IPC Handlers - Export
ipcMain.handle('export:daily', async (_, date) => {
    await db.ready;
    return db.exportDailyReport(date);
});

ipcMain.handle('export:monthly', async (_, year, month) => {
    await db.ready;
    return db.exportMonthlyReport(year, month);
});

ipcMain.handle('export:saveFile', async (_, filename, content) => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const path = require('path');

    const isPdf = filename.endsWith('.pdf');
    const result = await dialog.showSaveDialog({
        defaultPath: path.join(app.getPath('documents'), filename),
        filters: isPdf
            ? [{ name: 'PDF Files', extensions: ['pdf'] }]
            : [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled && result.filePath) {
        if (isPdf && content.type === 'Buffer') {
            // IPC serializes Buffer as { type: 'Buffer', data: [...] }
            fs.writeFileSync(result.filePath, Buffer.from(content.data));
        } else if (Buffer.isBuffer(content)) {
            fs.writeFileSync(result.filePath, content);
        } else {
            fs.writeFileSync(result.filePath, content, 'utf8');
        }
        return { success: true, path: result.filePath };
    }
    return { success: false };
});

ipcMain.handle('export:saveDailyReportAuto', async (_, filename, content) => {
    const fs = require('fs');
    const path = require('path');

    try {
        const documentsPath = app.getPath('documents');
        const reportDir = path.join(documentsPath, 'PetshopStok', 'Raporlar');

        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const filePath = path.join(reportDir, filename);

        if (content.type === 'Buffer') {
            fs.writeFileSync(filePath, Buffer.from(content.data));
        } else if (Buffer.isBuffer(content)) {
            fs.writeFileSync(filePath, content);
        } else {
            fs.writeFileSync(filePath, content);
        }

        return { success: true, path: filePath };
    } catch (error) {
        console.error('Auto save error:', error);
        return { success: false, error: error.message };
    }
});

// IPC Handlers - Barcode Scanner
ipcMain.handle('scanner:getServerInfo', async () => {
    const ip = getLocalIP();
    const protocol = useHttps ? 'https' : 'http';
    return {
        ip: ip,
        port: SCANNER_PORT,
        url: protocol + '://' + ip + ':' + SCANNER_PORT + '/mobile-scanner',
        isHttps: useHttps,
        connectedDevices
    };
});

ipcMain.handle('scanner:sendResult', (_, success, message) => {
    sendScanResult(success, message);
});

// IPC Handler - Image Saving
ipcMain.handle('images:save', async (_, base64Data) => {
    try {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 data');
        }

        const buffer = Buffer.from(matches[2], 'base64');
        const imagesDir = path.join(app.getPath('userData'), 'product-images');

        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }

        const filename = `product-${Date.now()}.jpg`;
        const filePath = path.join(imagesDir, filename);

        await fs.promises.writeFile(filePath, buffer);

        // Return local-resource URL
        return `local-resource://${filePath.replace(/\\/g, '/')}`;
    } catch (err) {
        console.error('Image save error:', err);
        throw err;
    }
});

// ==========================================
// YARIŞAN SCRAPER FONKSİYONLARI (Promise.any)
// ==========================================
const scraperHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
};

async function searchKolaymama(barcode) {
    const cheerio = require('cheerio');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`https://www.kolaymama.com/arama?q=${barcode}`, {
            headers: scraperHeaders,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        let name = '';
        let img = '';

        const detailTitle = $('h1.product-title').first();
        if (detailTitle.length > 0) {
            name = detailTitle.text().trim();
            img = $('#product-image').attr('src') || $('.product-image img').attr('src') || $('img.main-image').attr('src');
        } else {
            const productItems = $('.product-item, .product-layout, .showcase');
            if (productItems.length > 0) {
                const item = productItems.first();
                const titleEl = item.find('.name, .product-title, .showcase-title, a[title]').first();
                name = titleEl.text().trim();
                if (!name && titleEl.attr('title')) name = titleEl.attr('title');

                const imgEl = item.find('img').first();
                img = imgEl.attr('src');
                if (imgEl.attr('data-src')) img = imgEl.attr('data-src');
                else if (imgEl.attr('data-original')) img = imgEl.attr('data-original');
            }
        }

        // % İndirim gibi kampanya badge'lerini isim sanmasın
        if (name && !name.includes('%') && !name.toLowerCase().includes('indirim') && name.length > 2) {
            console.log(`[Kolaymama] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'Kolaymama' };
        }
        throw new Error('Kolaymama Not Found');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function searchPetlebi(barcode) {
    const cheerio = require('cheerio');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`https://petlebi.com/arama?kelime=${barcode}`, {
            headers: scraperHeaders,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        let name = '';
        let img = '';

        if ($('.product-container').length > 0) {
            name = $('h1.product-title, h1').first().text().trim();
            img = $('.product-gallery-slider img').attr('src') || $('.product-image img').attr('src');
        } else if ($('.search-results, .products').length > 0 || $('.product-list').length > 0 || $('.card').length > 0) {
            const firstItem = $('.card, .product-item, [class*="product-"]').first();
            name = firstItem.find('.title, h3, h2, [class*="title"]').text().trim();
            const imgEl = firstItem.find('img').first();
            img = imgEl.attr('data-src') || imgEl.attr('src');
        } else {
            // Fallback
            name = $('h1.product-title, h1').first().text().trim();
        }

        if (name && !name.includes('Sonuç Bulunamadı') && !name.toLowerCase().includes('bulunamadı') && name.length > 2) {
            console.log(`[Petlebi] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'Petlebi' };
        }
        throw new Error('Petlebi Not Found');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function searchMarkamama(barcode) {
    const cheerio = require('cheerio');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`https://www.markamama.com.tr/arama?q=${barcode}`, {
            headers: scraperHeaders,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        let name = '';
        let img = '';

        // T-Soft V5 yapisi - Sayfa içindeki javascript objesi
        const match = html.match(/PRODUCT_DATA\.push\(JSON\.parse\('(.*?)'\)\);/);
        if (match) {
            try {
                let jsonStr = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                const data = JSON.parse(jsonStr);
                name = data.name;
                img = Array.isArray(data.image) ? data.image[0] : data.image;
                if (img) img = img.replace(/\\\//g, '/');
            } catch (e) { }
        }

        // JSON yoksa eski Cheerio metodunu dene
        if (!name) {
            const $ = cheerio.load(html);
            const detailTitle = $('h1.product-title, .productName, h1').first();
            // In fetch() we don't have response.request.path easily, so just check if it's not looking like a list
            if (detailTitle.length > 0 && $('.product-list').length === 0) {
                name = detailTitle.text().trim();
                img = $('#product-image, .productImage img, img').attr('src');
            } else {
                const firstItem = $('.product-item, .productItem, .showcase').first();
                if (firstItem.length > 0) {
                    name = firstItem.find('.productName, .name, [title]').text().trim() || firstItem.find('a').attr('title');
                    const imgEl = firstItem.find('img').first();
                    img = imgEl.attr('data-src') || imgEl.attr('src');
                }
            }
        }

        if (name && !name.toLowerCase().includes('bulunamadı') && name.length > 2) {
            console.log(`[Markamama] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'Markamama' };
        }
        throw new Error('Markamama Not Found');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function searchBarkodoku(barcode) {
    const cheerio = require('cheerio');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`https://barkodoku.com/${barcode}`, {
            headers: scraperHeaders,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        let name = '';
        let img = '';

        const titleEl = $('title').text();
        if (titleEl && !titleEl.includes('Bulunamadı') && !titleEl.includes('Hata')) {
            name = titleEl.replace(barcode, '').replace('-', '').trim();
            if (name.toLowerCase() === 'barkodoku.com') {
                name = '';
            }
        }

        if (name && name.length > 2) {
            console.log(`[BarkodOku] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'BarkodOku' };
        }
        throw new Error('BarkodOku Not Found');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}
