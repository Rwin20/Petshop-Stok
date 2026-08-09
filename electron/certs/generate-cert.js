// SSL Certificate Generator for Yemmama Stok
// Using node-forge for certificate generation

const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('\n====================================');
console.log(' SSL Sertifika Olusturma');
console.log('====================================\n');

// Get local IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const localIP = getLocalIP();
console.log('Yerel IP:', localIP);

// Generate keypair
console.log('RSA anahtar cifti olusturuluyor...');
const keys = forge.pki.rsa.generateKeyPair(2048);

// Create certificate
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01' + Date.now().toString(16);
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'organizationName', value: 'Yemmama Stok Dev' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

// Add extensions
cert.setExtensions([
    {
        name: 'basicConstraints',
        cA: true
    },
    {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true
    },
    {
        name: 'subjectAltName',
        altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: localIP }
        ]
    }
]);

// Self-sign
cert.sign(keys.privateKey, forge.md.sha256.create());

// Convert to PEM
const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

// Write files
const certsDir = __dirname;
fs.writeFileSync(path.join(certsDir, 'cert.pem'), certPem);
fs.writeFileSync(path.join(certsDir, 'key.pem'), keyPem);

console.log('\n✓ Sertifikalar olusturuldu:');
console.log('   - cert.pem');
console.log('   - key.pem');
console.log('\nMobil cihazdan erisim: https://' + localIP + ':3000/mobile-scanner');
console.log('\nNOT: Ilk baglantida "Guvenli degil" uyarisi cikacak.');
console.log('     "Gelismis" > "Siteye git" secenegini kullanin.\n');
