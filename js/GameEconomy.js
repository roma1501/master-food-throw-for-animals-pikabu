// GameEconomy.js — формулы игры без Babylon и DOM: сила броска -> дальность, удача, выбор животного и
// мутации, доход, опыт уровней, цены, формат чисел. Чистые функции: их зовут игрок, боты и тесты.
// Числа баланса — константы ECON_* в Constants.js (правятся в редакторе), здесь — с дефолтами.

/** @satisfies {Record<string, any>} */
const Econ = {
    cfg() {
        return {
            startPower: typeof ECON_START_POWER !== 'undefined' ? ECON_START_POWER : 18,
            levelPower: typeof ECON_LEVEL_POWER !== 'undefined' ? ECON_LEVEL_POWER : 5,
            zonePower0: typeof ECON_ZONE_POWER0 !== 'undefined' ? ECON_ZONE_POWER0 : 30,
            zoneGrowth: typeof ECON_ZONE_GROWTH !== 'undefined' ? ECON_ZONE_GROWTH : 1.3,
            perfectBonus: typeof ECON_PERFECT_BONUS !== 'undefined' ? ECON_PERFECT_BONUS : 0.32,
            incomeBase: typeof ECON_INCOME_BASE !== 'undefined' ? ECON_INCOME_BASE : 2,
            incomeGrowth: typeof ECON_INCOME_GROWTH !== 'undefined' ? ECON_INCOME_GROWTH : 2.15,
            sellSeconds: typeof ECON_SELL_SECONDS !== 'undefined' ? ECON_SELL_SECONDS : 25,
            xpBase: typeof ECON_XP_BASE !== 'undefined' ? ECON_XP_BASE : 5,
            xpScale: typeof ECON_XP_SCALE !== 'undefined' ? ECON_XP_SCALE : 1.1,
            xpPow: typeof ECON_XP_POW !== 'undefined' ? ECON_XP_POW : 1.22,
            zoneLuck: typeof ECON_ZONE_LUCK !== 'undefined' ? ECON_ZONE_LUCK : 1.6,
        };
    },

    // --- Зоны и животные ------------------------------------------------------------------------

    /** @type {Map<string, any> | null} */
    _byId: null,
    /** Все животные: { id, en, ru, rarity, arch, zone (0..27), slot (0..5), rIndex } по id. */
    animals() {
        if (this._byId) return this._byId;
        const map = new Map();
        GAME_DATA.ANIMALS.forEach((list, zone) => list.forEach((a, slot) => {
            const rIndex = GAME_DATA.RARITIES.findIndex(r => r.id === a[3]);
            map.set(a[0], { id: a[0], en: a[1], ru: a[2], rarity: a[3], arch: a[4], zone, slot, rIndex: Math.max(0, rIndex) });
        }));
        this._byId = map;
        return map;
    },
    animal(id) { return this.animals().get(id) || null; },
    rarity(id) { return GAME_DATA.RARITIES.find(r => r.id === id) || GAME_DATA.RARITIES[0]; },
    mutation(id) { return GAME_DATA.MUTATIONS.find(m => m.id === id) || null; },
    zoneCount() { return GAME_DATA.ZONES.length; },

    /** Сила броска игрока: стартовая + уровни + еда. */
    power(level, foodId) {
        const c = this.cfg(), f = this.food(foodId);
        return c.startPower + Math.max(0, (level | 0) - 1) * c.levelPower + (f ? f.power : 0);
    },

    /** Бонус силы от шкалы (v 0..1 — где стоял бегунок). */
    meterBonus(power, v) {
        return Math.round(power * this.cfg().perfectBonus * Math.max(0, Math.min(1, v)));
    },

    /** Дальность броска в «зонах» (непрерывно: 0.5 — середина первой зоны, 3.2 — начало 4-й + 20%). */
    zoneReach(power) {
        const c = this.cfg(), p = Math.max(1, power);
        let u = p < c.zonePower0 ? p / c.zonePower0 : 1 + Math.log(p / c.zonePower0) / Math.log(c.zoneGrowth);
        return Math.min(this.zoneCount() - 0.03, Math.max(0.12, u));
    },

    /** Сила, нужная, чтобы долететь до начала зоны z (0 — первая). */
    powerForZone(z) {
        const c = this.cfg();
        return z <= 0 ? 0 : z === 1 ? c.zonePower0 : c.zonePower0 * Math.pow(c.zoneGrowth, z - 1);
    },

    /** Удача: растёт по мере полёта внутри зоны, умножается на удачу еды и бусты. */
    luck(reach, foodId, boost) {
        const frac = reach - Math.floor(reach), f = this.food(foodId);
        return (1 + this.cfg().zoneLuck * frac) * (f ? f.luck : 1) * (boost || 1);
    },

    /** Выбор животного зоны с учётом удачи. rnd — функция 0..1. */
    rollAnimal(zone, luck, rnd) {
        const list = GAME_DATA.ANIMALS[Math.max(0, Math.min(this.zoneCount() - 1, zone))];
        const lk = Math.max(1, luck);
        const w = list.map(a => {
            const ri = Math.max(0, GAME_DATA.RARITIES.findIndex(r => r.id === a[3]));
            return GAME_DATA.RARITIES[ri].weight * Math.pow(lk, ri * 0.55);
        });
        let sum = w.reduce((s, v) => s + v, 0), t = rnd() * sum;
        for (let i = 0; i < list.length; i++) { t -= w[i]; if (t <= 0) return list[i][0]; }
        return list[list.length - 1][0];
    },

    /** Мутации: список id (0–2 штуки). big совместим с остальными, цветные — одна. */
    rollMutations(luck, rnd) {
        const lk = 1 + (Math.max(1, luck) - 1) * 0.45, out = [];
        const big = this.mutation('big');
        if (big && rnd() < big.chance * lk) out.push('big');
        for (const id of ['rainbow', 'diamond', 'gold']) {
            const m = this.mutation(id);
            if (m && rnd() < m.chance * lk) { out.push(id); break; }
        }
        return out;
    },

    /** Доход животного ($/с). */
    income(animalId, muts) {
        const a = this.animal(animalId);
        if (!a) return 0;
        const c = this.cfg();
        let v = c.incomeBase * Math.pow(c.incomeGrowth, a.zone) * this.rarity(a.rarity).mult;
        for (const id of muts || []) { const m = this.mutation(id); if (m) v *= m.mult; }
        return Math.max(1, Math.round(v));
    },
    sellPrice(animalId, muts) { return Math.round(this.income(animalId, muts) * this.cfg().sellSeconds); },

    // --- Уровни, турники, еда, участок ---------------------------------------------------------

    xpNeed(level) {
        const c = this.cfg();
        return Math.max(1, Math.round(c.xpBase + c.xpScale * Math.pow(Math.max(1, level), c.xpPow)));
    },
    /** Добавить опыт: { level, xp, ups } — сколько уровней взято. */
    addXp(level, xp, gain) {
        let L = Math.max(1, level | 0), x = xp + gain, ups = 0;
        for (let guard = 0; guard < 10000 && x >= this.xpNeed(L); guard++) { x -= this.xpNeed(L); L++; ups++; }
        return { level: L, xp: x, ups };
    },
    bar(i) { return GAME_DATA.BARS[Math.max(0, Math.min(GAME_DATA.BARS.length - 1, i))]; },
    food(id) { return GAME_DATA.FOODS.find(f => f.id === id) || null; },
    foodIndex(id) { return Math.max(0, GAME_DATA.FOODS.findIndex(f => f.id === id)); },
    capacity(i) { return GAME_DATA.PLOT_CAPACITY[Math.max(0, Math.min(GAME_DATA.PLOT_CAPACITY.length - 1, i))]; },

    // --- Формат --------------------------------------------------------------------------------

    SUFFIX: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'],
    /** 1300 -> "1.3K", 9600 -> "9.6K", 12400 -> "12.4K", 3550 -> "3.55K". */
    short(n) {
        n = Number(n) || 0;
        const neg = n < 0; n = Math.abs(n);
        if (n < 1000) return (neg ? '-' : '') + (n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n)));
        let i = 0;
        while (n >= 1000 && i < this.SUFFIX.length - 1) { n /= 1000; i++; }
        const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
        return (neg ? '-' : '') + s.replace(/\.?0+$/, '') + this.SUFFIX[i];
    },
    money(n) { return '$' + this.short(n); },
};
