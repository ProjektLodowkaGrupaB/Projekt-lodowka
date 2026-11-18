// Express rozpoznaje middleware błędów po czterech argumentach.
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Niepoprawny format JSON.' });
    }

    // Naruszenie klucza obcego w PostgreSQL
    if (err.code === '23503') {
        return res.status(400).json({ message: 'Powiązany rekord nie istnieje.' });
    }

    const status = err.status || 500;

    if (status >= 500) {
        console.error(err.stack);
        return res.status(status).json({ message: 'Wewnętrzny błąd serwera.' });
    }

    return res.status(status).json({
        message: err.message,
        ...(err.details ? { szczegoly: err.details } : {})
    });
};

module.exports = errorHandler;
