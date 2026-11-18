// Wartości zgodne z typami unit_meas_enum i difficulty_enum w bazie.
const UNITS = ['kg', 'g', 'l', 'ml', 'szt', 'opak.', 'opak'];
const DIFFICULTIES = ['łatwy', 'średni', 'trudny'];
const EQUIPMENT_STATUSES = ['gotowy', 'w naprawie', 'niedostępny'];
const MAX_QTY = 99999999.99;

module.exports = { UNITS, DIFFICULTIES, EQUIPMENT_STATUSES, MAX_QTY };
