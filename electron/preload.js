const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Auth & RBAC
    auth: {
        login: (pin) => ipcRenderer.invoke('auth:login', pin),
        verifyAdmin: (pin) => ipcRenderer.invoke('auth:verifyAdmin', pin),
        getUsers: () => ipcRenderer.invoke('auth:getUsers'),
        updatePin: (id, oldPin, newPin) => ipcRenderer.invoke('auth:updatePin', id, oldPin, newPin)
    },

    // Products
    products: {
        getAll: () => ipcRenderer.invoke('products:getAll'),
        getById: (id) => ipcRenderer.invoke('products:getById', id),
        getByBarcode: (barcode) => ipcRenderer.invoke('products:getByBarcode', barcode),
        lookupBarcode: (barcode) => ipcRenderer.invoke('products:lookupBarcode', barcode),
        create: (product) => ipcRenderer.invoke('products:create', product),
        update: (id, product) => ipcRenderer.invoke('products:update', id, product),
        delete: (id) => ipcRenderer.invoke('products:delete', id),
        search: (query) => ipcRenderer.invoke('products:search', query),
        getCritical: () => ipcRenderer.invoke('products:getCritical'),
        getExpiring: () => ipcRenderer.invoke('products:getExpiring'),
        saveImage: (base64Data) => ipcRenderer.invoke('images:save', base64Data)
    },

    // Categories
    categories: {
        getAll: () => ipcRenderer.invoke('categories:getAll'),
        add: (name) => ipcRenderer.invoke('categories:add', name),
        delete: (id) => ipcRenderer.invoke('categories:delete', id)
    },

    // Sales
    sales: {
        create: (sale) => ipcRenderer.invoke('sales:create', sale),
        createBatch: (items, discount, paymentDetails) => ipcRenderer.invoke('sales:createBatch', items, discount, paymentDetails),
        getToday: () => ipcRenderer.invoke('sales:getToday'),
        getTodayOrders: () => ipcRenderer.invoke('sales:getTodayOrders'),
        getByDateRange: (start, end) => ipcRenderer.invoke('sales:getByDateRange', start, end),
        delete: (id, adminPin) => ipcRenderer.invoke('sales:delete', id, adminPin)
    },

    // Reports
    reports: {
        daily: (date) => ipcRenderer.invoke('reports:daily', date),
        monthly: (year, month) => ipcRenderer.invoke('reports:monthly', year, month),
        dashboard: () => ipcRenderer.invoke('reports:dashboard')
    },

    // Customers
    customers: {
        getAll: () => ipcRenderer.invoke('customers:getAll'),
        getById: (id) => ipcRenderer.invoke('customers:getById', id),
        create: (customer) => ipcRenderer.invoke('customers:create', customer),
        update: (id, customer) => ipcRenderer.invoke('customers:update', id, customer),
        delete: (id) => ipcRenderer.invoke('customers:delete', id),
        search: (query) => ipcRenderer.invoke('customers:search', query),
        getBalance: (id) => ipcRenderer.invoke('customers:getBalance', id),
        getWithDebt: () => ipcRenderer.invoke('customers:getWithDebt'),
        getDebtStats: () => ipcRenderer.invoke('customers:getDebtStats')
    },

    // Credit Transactions
    credit: {
        addDebt: (customerId, amount, description) => ipcRenderer.invoke('credit:addDebt', customerId, amount, description),
        addPayment: (customerId, amount, description) => ipcRenderer.invoke('credit:addPayment', customerId, amount, description),
        getTransactions: (customerId) => ipcRenderer.invoke('credit:getTransactions', customerId),
        deleteTransaction: (id) => ipcRenderer.invoke('credit:deleteTransaction', id)
    },

    // Waste Management (Zayi/Fire)
    waste: {
        create: (productId, quantity, reason) => ipcRenderer.invoke('waste:create', productId, quantity, reason),
        getByDate: (date) => ipcRenderer.invoke('waste:getByDate', date),
        getByDateRange: (start, end) => ipcRenderer.invoke('waste:getByDateRange', start, end)
    },

    // Expenses Management
    expenses: {
        add: (data) => ipcRenderer.invoke('expenses:add', data),
        delete: (id) => ipcRenderer.invoke('expenses:delete', id),
        getByDateRange: (start, end) => ipcRenderer.invoke('expenses:get-by-date-range', { start, end }),
        getByDate: (date) => ipcRenderer.invoke('expenses:get-by-date', date)
    },

    // Data Reset
    reset: {
        sales: () => ipcRenderer.invoke('reset:sales'),
        customers: () => ipcRenderer.invoke('reset:customers'),
        products: () => ipcRenderer.invoke('reset:products'),
        all: () => ipcRenderer.invoke('reset:all')
    },

    // Export Reports
    export: {
        daily: (date) => ipcRenderer.invoke('export:daily', date),
        monthly: (year, month) => ipcRenderer.invoke('export:monthly', year, month),
        saveFile: (filename, content) => ipcRenderer.invoke('export:saveFile', filename, content),
        saveDailyReportAuto: (filename, content) => ipcRenderer.invoke('export:saveDailyReportAuto', filename, content)
    },

    // Barcode Scanner
    onBarcodeScanned: (callback) => {
        const subscription = (_, barcode) => callback(barcode);
        ipcRenderer.on('barcode:scanned', subscription);
        return () => ipcRenderer.removeListener('barcode:scanned', subscription);
    },
    scanner: {
        getServerInfo: () => ipcRenderer.invoke('scanner:getServerInfo'),
        sendResult: (success, message) => ipcRenderer.invoke('scanner:sendResult', success, message),
        onBarcodeScan: (callback) => {
            ipcRenderer.on('barcode:scanned', (_, barcode) => callback(barcode));
        },
        onDeviceCountChange: (callback) => {
            ipcRenderer.on('scanner:deviceCount', (_, count) => callback(count));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('barcode:scanned');
            ipcRenderer.removeAllListeners('scanner:deviceCount');
        }
    },
    // Cloud Backup
    backup: {
        status: () => ipcRenderer.invoke('cloud-backup:status'),
        login: () => ipcRenderer.invoke('cloud-backup:login'),
        logout: () => ipcRenderer.invoke('cloud-backup:logout'),
        start: () => ipcRenderer.invoke('cloud-backup:start'),
        restore: (fileName) => ipcRenderer.invoke('cloud-backup:restore', fileName),
        list: () => ipcRenderer.invoke('cloud-backup:list')
    },
    // Local Backup
    localBackup: {
        create: () => ipcRenderer.invoke('local-backup:create'),
        list: () => ipcRenderer.invoke('local-backup:list'),
        restore: (file) => ipcRenderer.invoke('local-backup:restore', file),
        openFolder: () => ipcRenderer.send('local-backup:open-folder')
    },

    // WhatsApp Marketing Module
    whatsapp: {
        start: () => ipcRenderer.invoke('whatsapp:start'),
        logout: () => ipcRenderer.invoke('whatsapp:logout'),
        sendBatch: (customers, template) => ipcRenderer.invoke('whatsapp:sendBatch', customers, template),
        stopBatch: () => ipcRenderer.invoke('whatsapp:stopBatch'),
        getStatus: () => ipcRenderer.invoke('whatsapp:status'),
        onStatusUpdate: (callback) => {
            const subscription = (_, data) => callback(data);
            ipcRenderer.on('whatsapp:status-update', subscription);
            return () => ipcRenderer.removeListener('whatsapp:status-update', subscription);
        },
        onProgressUpdate: (callback) => {
            const subscription = (_, data) => callback(data);
            ipcRenderer.on('whatsapp:progress-update', subscription);
            return () => ipcRenderer.removeListener('whatsapp:progress-update', subscription);
        }
    }
});
