const pool = require('../config/database');

const { withTransaction } = pool;

const COLUMNS = 'id, nazwa, sprawny, kategoria, status_opis, notatki';

const getAll = async (db = pool) => {
    const result = await db.query(`SELECT ${COLUMNS} FROM sprzet ORDER BY nazwa, id`);
    return result.rows;
};

const findExistingIds = async (ids) => {
    const result = await pool.query('SELECT id FROM sprzet WHERE id = ANY($1::int[])', [ids]);
    return result.rows.map((row) => row.id);
};

const create = async (data) => {
    const result = await pool.query(
        `INSERT INTO sprzet (nazwa, sprawny, kategoria, status_opis, notatki)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [data.nazwa, data.sprawny, data.kategoria, data.status_opis, data.notatki]
    );

    return result.rows[0];
};

const update = async (id, data) => {
    const result = await pool.query(
        `UPDATE sprzet
         SET nazwa = $1, sprawny = $2, kategoria = $3, status_opis = $4, notatki = $5
         WHERE id = $6
         RETURNING ${COLUMNS}`,
        [data.nazwa, data.sprawny, data.kategoria, data.status_opis, data.notatki, id]
    );

    return result.rows[0] || null;
};

const updateStatus = async (id, sprawny, statusOpis) => {
    const result = await pool.query(
        `UPDATE sprzet SET sprawny = $1, status_opis = $2 WHERE id = $3 RETURNING ${COLUMNS}`,
        [sprawny, statusOpis, id]
    );

    return result.rows[0] || null;
};

// Przepisy trzymają id sprzętu w tablicach bez klucza obcego, więc czyścimy je ręcznie.
const remove = (id) => withTransaction(async (client) => {
    const result = await client.query('DELETE FROM sprzet WHERE id = $1', [id]);

    if (result.rowCount === 0) return false;

    await client.query(
        `UPDATE przepisy
         SET sprzet = array_remove(sprzet, $1),
             sprzet_alternatywny = array_remove(sprzet_alternatywny, $1)
         WHERE $1 = ANY(sprzet) OR $1 = ANY(sprzet_alternatywny)`,
        [id]
    );

    return true;
});

module.exports = { getAll, findExistingIds, create, update, updateStatus, remove };
