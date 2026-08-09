const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

console.log('Generating self-signed certificates...');

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

const attrs = [{
    name: 'commonName',
    value: 'PetshopStok Local'
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
    value: 'PetshopStok'
}, {
    shortName: 'OU',
    value: 'IT'
}];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);

const pem = {
    privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    certificate: forge.pki.certificateToPem(cert)
};

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

fs.writeFileSync(certPath, pem.certificate);
fs.writeFileSync(keyPath, pem.privateKey);

console.log('Certificates generated successfully!');
console.log('Cert:', certPath);
console.log('Key:', keyPath);
