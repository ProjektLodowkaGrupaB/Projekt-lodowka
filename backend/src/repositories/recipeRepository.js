const pool = require('../config/database');

const create = async (data) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const recipeResult = await client.query(
            `INSERT INTO przepisy
                (nazwa, czas, trudnosc, kalorycznosc, porcja,
                 sprzet, sprzet_alternatywny, opis)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                data.nazwa,
                data.czas,
                data.trudnosc,
                data.kalorycznosc,
                data.porcja,
                data.sprzet,
                data.sprzet_alternatywny,
                data.opis
            ]
        );

        const przepisId = recipeResult.rows[0].id;

        for (const skladnik of data.skladniki) {
            await client.query(
                `INSERT INTO przepis_skladniki
                    (przepis_id, skladnik_id, qty, unit_meas)
                 VALUES ($1, $2, $3, $4)`,
                [
                    przepisId,
                    skladnik.skladnik_id,
                    skladnik.qty,
                    skladnik.unit_meas
                ]
            );
        }

        await client.query('COMMIT');

        return {
            id: przepisId
        };

    } catch (error) {
        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};

module.exports = {
    create
};