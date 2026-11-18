const test = require('node:test');
const assert = require('node:assert/strict');

const { describeRecipe, planConsumption } = require('../src/services/recipeLogic');

const TODAY = '2026-11-18';
const recipe = {
    id: 1,
    nazwa: 'Test',
    porcja: 2,
    sprzet: [1],
    sprzet_alternatywny: [2],
    skladniki: [
        { skladnik_id: 1, nazwa: 'Mąka', qty: 500, unit_meas: 'g' },
        { skladnik_id: 2, nazwa: 'Mleko', qty: 250, unit_meas: 'ml' }
    ]
};
const product = (id, skladnik_id, qty, unit_meas, expire_date = null) =>
    ({ id, skladnik_id, qty, unit_meas, expire_date });
const equipment = (id, sprawny) => ({ id, nazwa: `Sprzęt ${id}`, sprawny });

test('przelicza jednostki przy dopasowaniu (1 kg >= 500 g, 1 l >= 250 ml)', () => {
    const result = describeRecipe(
        recipe,
        [product(1, 1, 1, 'kg'), product(2, 2, 1, 'l')],
        [equipment(1, true)],
        TODAY
    );

    assert.equal(result.procent_brakow, 0);
    assert.deepEqual(result.brakujace, []);
    assert.equal(result.sprzet_gotowy, true);
});

test('brak ilości i przeterminowany produkt liczą się jako braki', () => {
    const result = describeRecipe(
        recipe,
        [product(1, 1, 100, 'g'), product(2, 2, 1, 'l', '2026-11-17')],
        [equipment(1, true)],
        TODAY
    );

    assert.deepEqual(result.brakujace, ['Mąka', 'Mleko']);
    assert.equal(result.procent_brakow, 100);
});

test('niezgodne jednostki (g i szt) nie są porównywane', () => {
    const result = describeRecipe(recipe, [product(1, 1, 900, 'szt')], [], TODAY);
    assert.ok(result.brakujace.includes('Mąka'));
});

test('sprzęt w naprawie blokuje przepis, chyba że działa alternatywa', () => {
    assert.equal(describeRecipe(recipe, [], [equipment(1, false)], TODAY).sprzet_gotowy, false);
    assert.equal(
        describeRecipe(recipe, [], [equipment(1, false), equipment(2, true)], TODAY).sprzet_gotowy,
        true
    );
});

test('skaluje porcje i zużywa najpierw produkt z najkrótszą datą', () => {
    const plan = planConsumption(
        recipe,
        [
            product(1, 1, 1, 'kg', '2026-12-30'),
            product(2, 1, 300, 'g', '2026-11-20'),
            product(3, 2, 1, 'l')
        ],
        4,
        TODAY
    );

    assert.deepEqual(plan.braki, []);
    assert.deepEqual(plan.usuniete, [2]);
    assert.deepEqual(plan.aktualizacje, [{ id: 1, qty: 0.3, unit_meas: 'kg' }, { id: 3, qty: 0.5, unit_meas: 'l' }]);
});

test('przy braku składnika plan niczego nie zmienia', () => {
    const plan = planConsumption(recipe, [product(1, 1, 1, 'kg')], 2, TODAY);

    assert.deepEqual(plan, { braki: ['Mleko'], aktualizacje: [], usuniete: [] });
});

test('małe zużycie z kg zapisuje dokładną resztę w gramach', () => {
  const salt = { ...recipe, porcja: 1, skladniki: [{ skladnik_id: 1, nazwa: 'Sól', qty: 4, unit_meas: 'g' }] };

  assert.deepEqual(planConsumption(salt, [product(1, 1, 1, 'kg')], 1, TODAY).aktualizacje, [
    { id: 1, qty: 996, unit_meas: 'g' }
  ]);
});

test('pusta lista sprzętu nie omija niesprawnej alternatywy', () => {
  const withoutMain = { ...recipe, sprzet: [], sprzet_alternatywny: [2] };

  assert.equal(describeRecipe(withoutMain, [], [equipment(2, false)], TODAY).sprzet_gotowy, false);
  assert.equal(describeRecipe({ ...recipe, sprzet: [], sprzet_alternatywny: [] }, [], [], TODAY).sprzet_gotowy, true);
});
