const fs = require('fs');
const path = require('path');
const { AllkeyshopService } = require('allkeyshop-api');

const INPUT = path.join(__dirname, '..', 'data', 'topAppIds.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT = path.join(OUTPUT_DIR, 'deals.json');
const REQUEST_DELAY_MS = Number(process.env.WARM_DELAY_MS) || 350;
const CURRENCY = process.env.WARM_CURRENCY || 'usd';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const normalizeOffers = (data) => {
    if (!data || !Array.isArray(data.offers)) return [];
    return data.offers
        .map((o) => {
            const m = data.merchants?.[o.merchant] || {};
            const ed = data.editions?.[o.edition] || {};
            const rg = data.regions?.[o.region] || {};
            const price = o.price?.amount ?? null;
            const original = o.price?.originalAmount ?? price;
            const discount = price && original && original > price
                ? Math.round((1 - price / original) * 100)
                : 0;
            return {
                id: o.id,
                merchantId: o.merchant,
                merchantName: m.name || 'Unknown',
                isOfficial: m.types === 'Official Store',
                edition: { id: String(o.edition), name: ed.name || 'Standard' },
                region: { id: String(o.region), name: rg.region_name || rg.filterName || rg.name || null },
                price: Number(price ?? 0),
                originalPrice: Number(original ?? price ?? 0),
                discountPercent: discount,
                stock: o.stock || null,
                platform: o.platform || null,
                url: o.affiliateUrl || null,
            };
        })
        .filter((x) => x.url && x.price > 0)
        .sort((a, b) => a.price - b.price);
};

const main = async () => {
    if (!fs.existsSync(INPUT)) {
        console.error(`missing input list: ${INPUT}`);
        process.exit(1);
    }
    const games = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
    const svc = new AllkeyshopService({ currency: CURRENCY });

    const out = {};
    let warmed = 0;
    let failed = 0;
    const t0 = Date.now();

    for (let i = 0; i < games.length; i++) {
        const { appid, title } = games[i];
        if (!appid || !title) continue;
        try {
            const data = await svc.search(title);
            if (data?.success) {
                const offers = normalizeOffers(data);
                out[appid] = {
                    available: offers.length > 0,
                    title,
                    offers,
                    fetchedAt: new Date().toISOString(),
                };
                if (offers.length > 0) warmed++;
            } else {
                out[appid] = { available: false, title, reason: 'not_found_on_aks' };
                failed++;
            }
        } catch (err) {
            out[appid] = { available: false, title, reason: 'error', error: err.message };
            failed++;
        }
        if ((i + 1) % 25 === 0) {
            console.log(`progress ${i + 1}/${games.length} (warmed=${warmed} failed=${failed})`);
        }
        await sleep(REQUEST_DELAY_MS);
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const payload = {
        generatedAt: new Date().toISOString(),
        currency: CURRENCY.toUpperCase(),
        count: Object.keys(out).length,
        deals: out,
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(payload));
    console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s -> ${OUTPUT} (warmed=${warmed} failed=${failed})`);
};

main().catch((err) => {
    console.error('fatal:', err);
    process.exit(1);
});
