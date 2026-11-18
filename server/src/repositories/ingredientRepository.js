const pool = require('../config/database');

const getAll = async () => {
    const result = await pool.query(
        'SELECT id, nazwa, domyslna_jednostka FROM skladniki ORDER BY nazwa'
    );

    return result.rows;
};

// Składnik szukany bez względu na wielkość liter; brakujący jest dopisywany do słownika.
const findOrCreate = async (client, nazwa, jednostka) => {
    const find = () => client.query(
        `SELECT id FROM skladniki
         WHERE lower(nazwa) = lower($1)
         ORDER BY (nazwa = $1) DESC
         LIMIT 1`,
        [nazwa]
    );

    let result = await find();

    if (result.rowCount === 0) {
        await client.query(
            `INSERT INTO skladniki (nazwa, domyslna_jednostka)
             VALUES ($1, $2)
             ON CONFLICT (nazwa) DO NOTHING`,
            [nazwa, jednostka]
        );
        result = await find();
    }

    return result.rows[0].id;
};

module.exports = { getAll, findOrCreate };
