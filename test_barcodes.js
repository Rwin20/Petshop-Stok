const axios = require('axios');
const cheerio = require('cheerio');

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

async function testKolaymama(barcode) {
    try {
        const response = await axios.get(`https://www.kolaymama.com/arama?q=${barcode}`);
        const $ = cheerio.load(response.data);
        if ($('.product-item, .product-layout, .showcase').length > 0) return true;
        return false;
    } catch (e) { return false; }
}

async function testPetlebi(barcode) {
    try {
        const response = await axios.get(`https://petlebi.com/arama?kelime=${barcode}`);
        if (response.request.path.indexOf('/arama') === -1) return true; // Redirected to product
        const $ = cheerio.load(response.data);
        if ($('.card, .product-item, [class*="product-"]').length > 0) return true;
        return false;
    } catch (e) { return false; }
}

async function run() {
    const barcodes = [
        '3182550702157', // Royal Canin
        '7613035120150', // Pro Plan
        '8698997321151', // BonaCibo
        '8680067146037' // Reflex (failing)
    ];
    for (let b of barcodes) {
        console.log(`Checking ${b}... K: ${await testKolaymama(b)}, P: ${await testPetlebi(b)}`);
    }
}
run();
