const pool = require('../config/database');
const ingredientRepository = require('./ingredientRepository');

const { withTransaction } = pool;

const SELECT_PRODUCT = `
    SELECT
        p.id,
        s.nazwa,
        p.qty,
        p.unit_meas,
        p.expire_date,
        p.kalorie,
        p.opis
    FROM spizarnia p
    JOIN skladniki s ON p.skladnik_id = s.id
`;

const getAll = async () => {
    const result = await pool.query(`${SELECT_PRODUCT} ORDER BY s.nazwa, p.id`);
    return result.rows;
};

const getById = async (id, db = pool) => {
    const result = await db.query(`${SELECT_PRODUCT} WHERE p.id = $1`, [id]);
    return result.rows[0] || null;
};

const create = (data) => withTransaction(async (client) => {
    const skladnikId = await ingredientRepository.findOrCreate(client, data.nazwa, data.unit_meas);

    const result = await client.query(
        `INSERT INTO spizarnia (skladnik_id, opis, qty, unit_meas, expire_date, kalorie)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [skladnikId, data.opis ?? null, data.qty, data.unit_meas, data.expire_date, data.kalorie]
    );

    return getById(result.rows[0].id, client);
});

const update = (id, data) => withTransaction(async (client) => {
    const skladnikId = await ingredientRepository.findOrCreate(client, data.nazwa, data.unit_meas);

    // Brak pola opis w żądaniu zostawia dotychczasowy opis.
    const result = await client.query(
        `UPDATE spizarnia
         SET skladnik_id = $1,
             opis = CASE WHEN $2::boolean THEN $3 ELSE opis END,
             qty = $4,
             unit_meas = $5,
             expire_date = $6,
             kalorie = $7
         WHERE id = $8
         RETURNING id`,
        [
            skladnikId,
            data.opis !== undefined,
            data.opis ?? null,
            data.qty,
            data.unit_meas,
            data.expire_date,
            data.kalorie,
            id
        ]
    );

    return result.rowCount ? getById(id, client) : null;
});

const remove = async (id) => {
    const result = await pool.query('DELETE FROM spizarnia WHERE id = $1', [id]);
    return result.rowCount > 0;
};

module.exports = { getAll, getById, create, update, remove };
