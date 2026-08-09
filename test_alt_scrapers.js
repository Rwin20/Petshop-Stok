const axios = require('axios');
const cheerio = require('cheerio');

const scraperHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function testHepsiburada(barcode) {
    try {
        const response = await axios.get(`https://www.hepsiburada.com/ara?q=${barcode}`, { headers: scraperHeaders, timeout: 5000 });
        const $ = cheerio.load(response.data);
        const name = $('h3[data-test-id="product-card-name"]').first().text().trim();
        if (name) {
            console.log("Hepsiburada:", name);
            return true;
        }
        console.log("Hepsiburada empty");
        return false;
    } catch (e) { console.log("Hepsiburada fail:", e.message); return false; }
}

async function testPtt(barcode) {
    try {
        const response = await axios.get(`https://www.pttavm.com/arama?q=${barcode}`, { headers: scraperHeaders, timeout: 5000 });
        const $ = cheerio.load(response.data);
        const name = $('.product-list-box-container .product-title').first().text().trim();
        if (name) {
            console.log("PTT AVM:", name);
            return true;
        }
        console.log("PTT AVM empty");
        return false;
    } catch (e) { console.log("PTT AVM fail:", e.message); return false; }
}

async function run() {
    await testHepsiburada('8680067146037');
    await testPtt('8680067146037');
}
run();
