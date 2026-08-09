const { Client, LocalAuth } = require('whatsapp-web.js');
const { app } = require('electron');
const path = require('path');

class WhatsAppManager {
    constructor(webContents) {
        this.client = null;
        this.webContents = webContents;
        this.status = 'DISCONNECTED'; // DISCONNECTED, QR_READY, CONNECTING, CONNECTED
        this.isSending = false;
        this.shouldStopQueue = false;
    }

    init() {
        if (this.client) return;

        const authPath = path.join(app.getPath('userData'), 'whatsapp-auth');
        
        this.client = new Client({
            authStrategy: new LocalAuth({ dataPath: authPath }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        this.status = 'CONNECTING';
        this._emitStatus();

        this.client.on('qr', (qr) => {
            this.status = 'QR_READY';
            this._emitStatus(qr);
        });

        this.client.on('authenticated', () => {
             console.log('WhatsApp authenticated');
        });

        this.client.on('ready', () => {
            this.status = 'CONNECTED';
            this._emitStatus();
            console.log('WhatsApp client is ready!');
        });

        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp disconnected:', reason);
            this.status = 'DISCONNECTED';
            this._emitStatus();
            this.client.destroy();
            this.client = null;
        });

        this.client.initialize().catch(err => {
             console.error('WhatsApp init error:', err);
             this.status = 'DISCONNECTED';
             this._emitStatus();
        });
    }

    async logout() {
        if (this.client) {
            try {
                await this.client.logout();
                await this.client.destroy();
            } catch (e) {
                console.error('WhatsApp logout error:', e);
            }
            this.client = null;
        }
        this.status = 'DISCONNECTED';
        this._emitStatus();
    }

    getStatus() {
        return this.status;
    }

    stopQueue() {
        if (this.isSending) {
            this.shouldStopQueue = true;
        }
    }

    async startQueue(customers, messageTemplate) {
        if (!this.client || this.status !== 'CONNECTED') {
            throw new Error('WhatsApp is not connected.');
        }
        if (this.isSending) {
            throw new Error('Gönderim işlemi zaten devam ediyor.');
        }

        this.isSending = true;
        this.shouldStopQueue = false;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < customers.length; i++) {
            if (this.shouldStopQueue) {
                this._emitProgress({
                    status: 'Durduruldu',
                    current: i,
                    total: customers.length,
                    message: 'Gönderim kullanıcı tarafından durduruldu.'
                });
                break;
            }

            const customer = customers[i];
            
            // 1. Sanitize Phone
            const rawPhone = customer.phone ? customer.phone.replace(/\D/g, '') : '';
            if (rawPhone.length < 10) {
                failCount++;
                continue;
            }
            // If phone starts with 0, remove it. If it doesn't start with 90, format it.
            let formattedPhone = rawPhone;
            if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
            if (!formattedPhone.startsWith('90')) formattedPhone = '90' + formattedPhone;
            const chatId = formattedPhone + '@c.us';

            // 2. Format Template
            const customerName = customer.name || 'Değerli Müşterimiz';
            const message = messageTemplate.replace(/\{isim\}/gi, customerName);

            // Emit "Gönderiliyor"
            this._emitProgress({
                status: 'Sending',
                current: i + 1,
                total: customers.length,
                success: successCount,
                failed: failCount,
                message: `${customerName} kişisine mesaj gönderiliyor...`
            });

            try {
                // Check if number is registered on WA
                const isRegistered = await this.client.isRegisteredUser(chatId);
                if (isRegistered) {
                    await this.client.sendMessage(chatId, message);
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                console.error(`Gonderilemedi: ${chatId}`, err);
                failCount++;
            }

            // Anti-Ban Delay: Only delay if it's NOT the last customer and we are not told to stop
            if (i < customers.length - 1 && !this.shouldStopQueue) {
                const addSeconds = Math.floor(Math.random() * (35 - 15 + 1)) + 15; // 15 to 35 seconds
                const delayMs = addSeconds * 1000;

                this._emitProgress({
                    status: 'Waiting',
                    current: i + 1,
                    total: customers.length,
                    success: successCount,
                    failed: failCount,
                    message: `Anti-Ban: Sıradaki mesaj için ${addSeconds} saniye bekleniyor... (${delayMs}ms)`
                });

                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        this.isSending = false;
        this.shouldStopQueue = false;

        this._emitProgress({
            status: 'Done',
            current: customers.length,
            total: customers.length,
            success: successCount,
            failed: failCount,
            message: `Gönderim tamamlandı. Başarılı: ${successCount}, Başarısız: ${failCount}`
        });

        return { success: successCount, failed: failCount };
    }

    _emitStatus(qr = null) {
        if (!this.webContents) return;
        this.webContents.send('whatsapp:status-update', { status: this.status, qr });
    }

    _emitProgress(data) {
        if (!this.webContents) return;
        this.webContents.send('whatsapp:progress-update', data);
    }
}

module.exports = WhatsAppManager;
