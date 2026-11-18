// Czysta logika biznesowa przepisów – bez bazy danych, łatwa do testowania.

const EPSILON = 1e-9;

const UNIT_INFO = {
    g: { wymiar: 'masa', mnoznik: 1 },
    kg: { wymiar: 'masa', mnoznik: 1000 },
    ml: { wymiar: 'objetosc', mnoznik: 1 },
    l: { wymiar: 'objetosc', mnoznik: 1000 },
    szt: { wymiar: 'sztuki', mnoznik: 1 },
    'opak.': { wymiar: 'opakowania', mnoznik: 1 },
    opak: { wymiar: 'opakowania', mnoznik: 1 }
};

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const toBase = (qty, unit) => {
    const info = UNIT_INFO[unit];
    return info ? { wymiar: info.wymiar, ilosc: Number(qty) * info.mnoznik } : null;
};

const localDate = (date = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const isUsable = (product, today) => !product.expire_date || product.expire_date >= today;

// Najpierw zużywamy produkty z najkrótszą datą, bez daty na końcu.
const byExpiry = (a, b) =>
    (a.expire_date || '9999-12-31').localeCompare(b.expire_date || '9999-12-31') || a.id - b.id;

const availableAmount = (stock, skladnikId, wymiar, today) =>
    stock
        .filter((product) => product.skladnik_id === skladnikId && isUsable(product, today))
        .reduce((sum, product) => {
            const base = toBase(product.qty, product.unit_meas);
            return base && base.wymiar === wymiar ? sum + base.ilosc : sum;
        }, 0);

const isEquipmentReady = (recipe, readyIds) => {
    const main = recipe.sprzet || [];
    const alternative = recipe.sprzet_alternatywny || [];

    return main.every((id) => readyIds.has(id))
        || (alternative.length > 0 && alternative.every((id) => readyIds.has(id)));
};

const describeRecipe = (recipe, stock, equipment, today = localDate()) => {
    const names = new Map(equipment.map((item) => [item.id, item.nazwa]));
    const readyIds = new Set(equipment.filter((item) => item.sprawny).map((item) => item.id));

    const skladniki = recipe.skladniki.map((skladnik) => {
        const need = toBase(skladnik.qty, skladnik.unit_meas);
        const available = need
            ? availableAmount(stock, skladnik.skladnik_id, need.wymiar, today)
            : 0;

        return { ...skladnik, w_spizarni: Boolean(need) && available + EPSILON >= need.ilosc };
    });

    const brakujace = skladniki.filter((s) => !s.w_spizarni).map((s) => s.nazwa);

    return {
        ...recipe,
        skladniki,
        sprzet_nazwy: (recipe.sprzet || []).map((id) => names.get(id)).filter(Boolean),
        sprzet_gotowy: isEquipmentReady(recipe, readyIds),
        brakujace,
        procent_brakow: skladniki.length
            ? Math.round((brakujace.length / skladniki.length) * 100)
            : 0
    };
};

// Plan odjęcia składników: albo starcza wszystkiego, albo lista braków i zero zmian.
const planConsumption = (recipe, stock, porcje, today = localDate()) => {
    const scale = porcje / (recipe.porcja || 1);
    const remaining = new Map(stock.map((product) => [product.id, Number(product.qty)]));
    const touched = new Set();
    const braki = [];

    for (const skladnik of recipe.skladniki) {
        const need = toBase(skladnik.qty, skladnik.unit_meas);
        let left = need ? need.ilosc * scale : Infinity;

        const candidates = stock
            .filter((product) => product.skladnik_id === skladnik.skladnik_id
                && isUsable(product, today)
                && toBase(product.qty, product.unit_meas)?.wymiar === need?.wymiar)
            .sort(byExpiry);

        for (const product of candidates) {
            if (left <= EPSILON) break;

            const { mnoznik } = UNIT_INFO[product.unit_meas];
            const inBase = remaining.get(product.id) * mnoznik;
            const used = Math.min(inBase, left);

            remaining.set(product.id, (inBase - used) / mnoznik);
            touched.add(product.id);
            left -= used;
        }

        if (left > EPSILON) braki.push(skladnik.nazwa);
    }

    const aktualizacje = [];
    const usuniete = [];

    for (const id of touched) {
        const qty = round2(remaining.get(id));

        if (qty <= 0) usuniete.push(id);
        else aktualizacje.push({ id, qty });
    }

    return braki.length > 0
        ? { braki, aktualizacje: [], usuniete: [] }
        : { braki, aktualizacje, usuniete };
};

module.exports = { describeRecipe, planConsumption, toBase, localDate };
