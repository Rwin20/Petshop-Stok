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

async function test(query) {
    console.log("Testing:", query);
    try {
        const responseK = await axios.get(`https://www.kolaymama.com/arama?q=${query}`, { headers: scraperHeaders, timeout: 5000 });
        const $K = cheerio.load(responseK.data);
        console.log("Kolaymama items:", $K('.product-item, .product-layout, .showcase').length);
    } catch (e) { console.log('Kolaymama fail'); }
    try {
        const responseP = await axios.get(`https://petlebi.com/arama?kelime=${query}`, { headers: scraperHeaders, timeout: 5000 });
        const $P = cheerio.load(responseP.data);
        console.log("Petlebi items:", $P('.card, .product-item, [class*="product-"]').length);
    } catch (e) { console.log('Petlebi fail', e.response?.status); }
    try {
        const responseM = await axios.get(`https://www.markamama.com.tr/arama?q=${query}`, { headers: scraperHeaders, timeout: 5000 });
        const $M = cheerio.load(responseM.data);
        console.log("Markamama items:", $M('.product-item, .productItem, .showcase').length);
    } catch (e) { console.log('Markamama fail'); }
}

test('Reflex');
