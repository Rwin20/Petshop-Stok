const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function testFetch(url) {
    console.log("Fetching", url);
    try {
        const res = await fetch(url, { headers });
        console.log("Status for", url, res.status);
    } catch (e) {
        console.log("Error for", url, e.message);
    }
}

async function run() {
    await testFetch('https://www.kolaymama.com/arama?q=kedi');
    await testFetch('https://petlebi.com/arama?kelime=kedi');
    await testFetch('https://www.markamama.com.tr/arama?q=kedi');
}
run();
