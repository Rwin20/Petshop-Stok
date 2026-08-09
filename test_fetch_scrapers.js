const cheerio = require('cheerio');

const scraperHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function searchKolaymama(barcode) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`https://www.kolaymama.com/arama?q=${barcode}`, {
            headers: scraperHeaders,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

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

        if (name && !name.includes('%') && !name.toLowerCase().includes('indirim') && name.length > 2) {
            console.log(`[Kolaymama] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'Kolaymama' };
        }
        throw new Error('Kolaymama Not Found');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function searchPetlebi(barcode) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`https://petlebi.com/arama?kelime=${barcode}`, {
            headers: scraperHeaders,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);

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

        if (name && !name.includes('Sonuç Bulunamadı') && !name.toLowerCase().includes('bulunamadı') && name.length > 2) {
            console.log(`[Petlebi] Bulundu: ${name}`);
            return { found: true, name, image_url: img, source: 'Petlebi' };
        }
        throw new Error('Petlebi Not Found');
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function searchMarkamama(barcode) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`https://www.markamama.com.tr/arama?q=${barcode}`, {
            headers: scraperHeaders,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();

        let name = '';
        let img = '';

        const match = html.match(/PRODUCT_DATA\.push\(JSON\.parse\('(.*?)'\)\);/);
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
            const $ = cheerio.load(html);
            const detailTitle = $('h1.product-title, .productName, h1').first();
            if (detailTitle.length > 0 && $('.product-list').length === 0) {
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
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function testAll() {
    const barcode = process.argv[2] || '8690920194468';
    console.log("Testing:", barcode);

    try {
        const k = await searchKolaymama(barcode);
        console.log("Kolaymama:", k.name);
    } catch (e) {
        console.error("Kolaymama failed:", e.message);
    }

    try {
        const p = await searchPetlebi(barcode);
        console.log("Petlebi:", p.name);
    } catch (e) {
        console.error("Petlebi failed:", e.message);
    }

    try {
        const m = await searchMarkamama(barcode);
        console.log("Markamama:", m.name);
    } catch (e) {
        console.error("Markamama failed:", e.message);
    }
}

testAll();
