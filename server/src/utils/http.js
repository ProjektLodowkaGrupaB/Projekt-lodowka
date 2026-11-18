const httpError = (status, message, details) =>
    Object.assign(new Error(message), { status, ...(details ? { details } : {}) });

const parseId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
        throw httpError(400, 'Niepoprawny identyfikator.');
    }

    return id;
};

const orNotFound = (row, message) => {
    if (!row) throw httpError(404, message);
    return row;
};

module.exports = { httpError, parseId, orNotFound };
