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

async function searchKolaymama(barcode) {
    try {
        const response = await axios.get(`https://www.kolaymama.com/arama?q=${barcode}`, { headers: scraperHeaders, timeout: 10000 });
        const $ = cheerio.load(response.data);
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
        if (name && !name.includes('%') && !name.toLowerCase().includes('indirim')) {
            console.log(`[Kolaymama] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'Kolaymama' };
        }
        throw new Error('Kolaymama Not Found');
    } catch (err) { throw err; }
}

async function searchPetlebi(barcode) {
    try {
        const response = await axios.get(`https://petlebi.com/arama?kelime=${barcode}`, { headers: scraperHeaders, timeout: 10000 });
        const $ = cheerio.load(response.data);
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
            name = $('h1.product-title, h1').first().text().trim();
        }
        if (name && !name.includes('Sonuç Bulunamadı') && !name.toLowerCase().includes('bulunamadı')) {
            console.log(`[Petlebi] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'Petlebi' };
        }
        throw new Error('Petlebi Not Found');
    } catch (err) { throw err; }
}

async function searchMarkamama(barcode) {
    try {
        const response = await axios.get(`https://www.markamama.com.tr/arama?q=${barcode}`, { headers: scraperHeaders, timeout: 10000 });
        let name = '';
        let img = '';
        const match = response.data.match(/PRODUCT_DATA\.push\(JSON\.parse\('(.*?)'\)\);/);
        if (match) {
            try {
                let jsonStr = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                const data = JSON.parse(jsonStr);
                name = data.name;
                img = Array.isArray(data.image) ? data.image[0] : data.image;
                if (img) img = img.replace(/\\\//g, '/');
            } catch (e) { }
        }
        if (!name) {
            const $ = cheerio.load(response.data);
            const detailTitle = $('h1.product-title, .productName, h1').first();
            if (detailTitle.length > 0 && $('.product-list').length === 0 && !response.request.path.includes('/arama')) {
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
    } catch (err) { throw err; }
}

async function testPromiseAny(barcode) {
    console.log("Testing individual scrapers:", barcode);
    try {
        const kolaymama = await searchKolaymama(barcode).catch(e => e.message);
        console.log("Kolaymama:", kolaymama);
    } catch (e) {
        console.log("Kolaymama error:", e.message);
    }

    try {
        const petlebi = await searchPetlebi(barcode).catch(e => e.message);
        console.log("Petlebi:", petlebi);
    } catch (e) {
        console.log("Petlebi error:", e.message);
    }

    try {
        const markamama = await searchMarkamama(barcode).catch(e => e.message);
        console.log("Markamama:", markamama);
    } catch (e) {
        console.log("Markamama error:", e.message);
    }
}

testPromiseAny('8690920194468');
