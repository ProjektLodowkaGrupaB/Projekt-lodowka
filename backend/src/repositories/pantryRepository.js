const pool = require('../config/database');

const getAll = async () => {
    const result = await pool.query(`
        SELECT
            s.nazwa,
            p.qty AS ilosc,
            p.unit_meas AS jednostka,
            p.expire_date AS data_waznosci
        FROM spizarnia p
        JOIN skladniki s ON p.skladnik_id = s.id
        ORDER BY s.nazwa;
    `);

    return result.rows;
};

module.exports = {
    getAll
};