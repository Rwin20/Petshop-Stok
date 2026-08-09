const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

try {
    console.log('Generating 2048-bit key-pair...');
    const keys = forge.pki.rsa.generateKeyPair(2048);
    console.log('Key-pair generated.');

    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [{
        name: 'commonName',
        value: 'YemmamaScanner'
    }, {
        name: 'countryName',
        value: 'TR'
    }, {
        shortName: 'ST',
        value: 'Istanbul'
    }, {
        name: 'localityName',
        value: 'Istanbul'
    }, {
        name: 'organizationName',
        value: 'Yemmama'
    }, {
        shortName: 'OU',
        value: 'IT'
    }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // self-sign certificate
    cert.sign(keys.privateKey);

    const pemCert = forge.pki.certificateToPem(cert);
    const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

    const certDir = path.join(__dirname, 'electron', 'certs');
    fs.mkdirSync(certDir, { recursive: true });
    fs.writeFileSync(path.join(certDir, 'cert.pem'), pemCert);
    fs.writeFileSync(path.join(certDir, 'key.pem'), pemKey);

    console.log('Certs successfully generated inside electron/certs!');
} catch (e) {
    console.error('Error generating certs:', e);
}
