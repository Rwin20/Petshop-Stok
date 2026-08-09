const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const attrs = [{ name: 'commonName', value: 'PetshopStok Local' }];
const pems = selfsigned.generate(attrs, { days: 3650 });

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

fs.writeFileSync(certPath, pems.cert);
fs.writeFileSync(keyPath, pems.private);

console.log('Certificates generated successfully!');
console.log('Cert:', certPath);
console.log('Key:', keyPath);
