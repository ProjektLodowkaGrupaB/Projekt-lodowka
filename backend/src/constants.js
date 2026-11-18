// Wartości zgodne z typami unit_meas_enum i difficulty_enum w bazie.
const UNITS = ['kg', 'g', 'l', 'ml', 'szt', 'opak.', 'opak'];
const DIFFICULTIES = ['łatwy', 'średni', 'trudny'];
const EQUIPMENT_STATUSES = ['gotowy', 'w naprawie', 'niedostępny'];
const MIN_QTY = 0.01;
const MAX_QTY = 99999999.99;
const MAX_INT = 2147483647;

module.exports = { UNITS, DIFFICULTIES, EQUIPMENT_STATUSES, MIN_QTY, MAX_QTY, MAX_INT };
