const pool = require('../config/database');

const { withTransaction } = pool;

const RECIPE_COLUMNS = `id, nazwa, czas, trudnosc, kalorycznosc, porcja, sprzet,
    sprzet_alternatywny, opis, ulubione, diety, alergeny`;

const attachIngredients = async (recipes, db) => {
    if (recipes.length === 0) return [];

    const result = await db.query(
        `SELECT ps.przepis_id, ps.skladnik_id, s.nazwa, ps.qty, ps.unit_meas
         FROM przepis_skladniki ps
         JOIN skladniki s ON s.id = ps.skladnik_id
         WHERE ps.przepis_id = ANY($1::int[])
         ORDER BY ps.id`,
        [recipes.map((recipe) => recipe.id)]
    );

    return recipes.map((recipe) => ({
        ...recipe,
        skladniki: result.rows
            .filter((row) => row.przepis_id === recipe.id)
            .map(({ skladnik_id, nazwa, qty, unit_meas }) => ({ skladnik_id, nazwa, qty, unit_meas }))
    }));
};

const getAll = async ({ tylkoUlubione = false } = {}) => {
    const result = await pool.query(
        `SELECT ${RECIPE_COLUMNS} FROM przepisy
         ${tylkoUlubione ? 'WHERE ulubione' : ''}
         ORDER BY nazwa, id`
    );

    return attachIngredients(result.rows, pool);
};

const getById = async (id, db = pool) => {
    const result = await db.query(`SELECT ${RECIPE_COLUMNS} FROM przepisy WHERE id = $1`, [id]);
    const [recipe] = await attachIngredients(result.rows, db);
    return recipe || null;
};

const getPantryStock = async (db = pool) => {
    const result = await db.query(
        'SELECT id, skladnik_id, qty, unit_meas, expire_date FROM spizarnia'
    );

    return result.rows;
};

const recipeValues = (data) => [
    data.nazwa,
    data.czas,
    data.trudnosc,
    data.kalorycznosc,
    data.porcja,
    data.sprzet,
    data.sprzet_alternatywny,
    data.opis,
    JSON.stringify(data.diety),
    JSON.stringify(data.alergeny)
];

const insertIngredients = async (client, przepisId, skladniki) => {
    for (const skladnik of skladniki) {
        await client.query(
            `INSERT INTO przepis_skladniki (przepis_id, skladnik_id, qty, unit_meas)
             VALUES ($1, $2, $3, $4)`,
            [przepisId, skladnik.skladnik_id, skladnik.qty, skladnik.unit_meas]
        );
    }
};

const create = (data) => withTransaction(async (client) => {
    const result = await client.query(
        `INSERT INTO przepisy
            (nazwa, czas, trudnosc, kalorycznosc, porcja, sprzet,
             sprzet_alternatywny, opis, diety, alergeny)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
         RETURNING id`,
        recipeValues(data)
    );

    const { id } = result.rows[0];
    await insertIngredients(client, id, data.skladniki);

    return getById(id, client);
});

const update = (id, data) => withTransaction(async (client) => {
    const result = await client.query(
        `UPDATE przepisy
         SET nazwa = $1, czas = $2, trudnosc = $3, kalorycznosc = $4, porcja = $5,
             sprzet = $6, sprzet_alternatywny = $7, opis = $8,
             diety = $9::jsonb, alergeny = $10::jsonb
         WHERE id = $11`,
        [...recipeValues(data), id]
    );

    if (result.rowCount === 0) return null;

    await client.query('DELETE FROM przepis_skladniki WHERE przepis_id = $1', [id]);
    await insertIngredients(client, id, data.skladniki);

    return getById(id, client);
});

const remove = async (id) => {
    const result = await pool.query('DELETE FROM przepisy WHERE id = $1', [id]);
    return result.rowCount > 0;
};

const setFavorite = async (id, ulubione) => {
    const result = await pool.query(
        'UPDATE przepisy SET ulubione = $1 WHERE id = $2 RETURNING id',
        [ulubione, id]
    );

    return result.rowCount > 0;
};

// Plan zużycia liczy serwis na zablokowanych wierszach, a zapis dzieje się w tej samej transakcji.
const cook = (id, planConsumption) => withTransaction(async (client) => {
    const recipe = await getById(id, client);

    if (!recipe) return null;

    const stock = await client.query(
        `SELECT id, skladnik_id, qty, unit_meas, expire_date
         FROM spizarnia
         WHERE skladnik_id = ANY($1::int[])
         FOR UPDATE`,
        [recipe.skladniki.map((skladnik) => skladnik.skladnik_id)]
    );

    const plan = planConsumption(recipe, stock.rows);

    for (const { id: productId, qty } of plan.aktualizacje) {
        await client.query('UPDATE spizarnia SET qty = $1 WHERE id = $2', [qty, productId]);
    }

    if (plan.usuniete.length > 0) {
        await client.query('DELETE FROM spizarnia WHERE id = ANY($1::int[])', [plan.usuniete]);
    }

    return plan;
});

module.exports = {
    getAll,
    getById,
    getPantryStock,
    create,
    update,
    remove,
    setFavorite,
    cook
};
