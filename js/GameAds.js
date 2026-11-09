// GameAds.js — предложения «за рекламу» (rewarded) по всей игре и приёмник наград Daily Gift / колеса.
// Правила (личные требования пользователя): награда — только по true от Platform.rewarded(тип), один запрос за раз;
// между успешными роликами общая пауза REWARDED_COOLDOWN_SEC (16 с) — на кнопках «Через N с»; rewarded игру не
// паузит (движок); у предложения 1–7 просмотров, прогресс «2/5» сохраняется (save.adProg). Нет рекламы на
// площадке (Platform.rewardedSupported() = false) — кнопки за рекламу не показываются.
//
// Предложения (id -> тип рекламы для Platform.rewarded, просмотров, что даёт):
//   boost_cash / boost_xp / boost_luck / boost_speed — временные бусты x2 (минуты — ADS_BOOST_MIN)
//   free_cash — доход за ADS_CASH_MIN минут сразу; free_gems — кристаллы (не больше ADS_GEMS_PER_DAY раз в день)
//   super_throw — следующий бросок x2 силы; levels — +3 уровня; mystery — зверь из следующей зоны с удачей x3
//   sell_x2 — продать рюкзак вдвое дороже; gold_catch — пойманный зверь золотой; double_catch — ещё такой же
//   food:<id>, bar:<n>, cap:<n>, skin:<id> — покупки за 1–7 просмотров вместо денег/кристаллов

/** @satisfies {Record<string, any>} */
const GameAds = {
    busy: false,
    /** @type {any} */ game: null,
    /** Особые награды подарка дня и колеса (не предметы магазина). */
    SPECIAL: ['cash5', 'boost_cash', 'boost_xp', 'boost_luck', 'boost_speed', 'mystery', 'super_throw'],

    OFFERS: {
        boost_cash:   { type: 'boost', views: 1, icon: 'cash', color: 'blue' },
        boost_xp:     { type: 'boost', views: 1, icon: 'power', color: 'purple' },
        boost_luck:   { type: 'boost', views: 1, icon: 'luck', color: 'green' },
        boost_speed:  { type: 'boost', views: 1, icon: 'shoe', color: 'orange' },
        free_cash:    { type: 'free-cash', views: 1, icon: 'money_bag', color: 'green' },
        free_gems:    { type: 'free-gems', views: 1, icon: 'gems', color: 'blue' },
        super_throw:  { type: 'super-throw', views: 1, icon: 'boost2x', color: 'orange' },
        levels:       { type: 'levels', views: 2, icon: 'xp', color: 'purple' },
        mystery:      { type: 'mystery', views: 3, icon: 'question', color: 'pink' },
        sell_x2:      { type: 'sell-x2', views: 1, icon: 'money_bag', color: 'green' },
        gold_catch:   { type: 'gold-catch', views: 1, icon: 'crown', color: 'orange' },
        double_catch: { type: 'double-catch', views: 1, icon: 'animals', color: 'blue' },
    },

    init(game) {
        this.game = game;
        const s = game.save;
        if (!s.adProg || typeof s.adProg !== 'object') s.adProg = {};
        if (!s.timed || typeof s.timed !== 'object') s.timed = {};
        if (!s.adDay || typeof s.adDay !== 'object') s.adDay = { day: '', gems: 0 };
        if (typeof Platform.onRewardedCooldown === 'function') Platform.onRewardedCooldown(() => GameUI.adTick());
    },

    available() { return typeof Platform.rewardedSupported === 'function' ? !!Platform.rewardedSupported() : false; },
    cooldown() { return typeof Platform.rewardedCooldownLeft === 'function' ? Platform.rewardedCooldownLeft() : 0; },
    progress(key) { return (this.game.save.adProg[key] | 0); },

    /** Сколько просмотров нужно: у фиксированных — из OFFERS, у покупок — по ценности (1–7). */
    views(key) {
        const o = this.OFFERS[key];
        if (o) return o.views;
        const [kind, arg] = key.split(':');
        if (kind === 'food') { const f = Econ.food(arg); return f ? Math.max(1, Math.min(7, f.tier)) : 1; }
        if (kind === 'bar') return Math.max(1, Math.min(7, Math.ceil((+arg + 1) * 0.7)));
        if (kind === 'cap') return Math.max(1, Math.min(7, 3 + (+arg)));
        if (kind === 'skin') { const it = SKIN_ITEMS.find(x => x.id === arg); return it && it.ads ? Math.max(1, Math.min(7, it.ads)) : 0; }
        return 1;
    },

    /** Подпись кнопки: «За рекламу 2/5» | «Через N с». */
    label(key) {
        const cd = this.cooldown(), need = this.views(key), have = this.progress(key);
        if (cd > 0) return Lang.t('ads.in', { n: cd });
        return need > 1 ? Lang.t('ads.watchN', { a: have, b: need }) : Lang.t('ads.watch');
    },
    /** HTML кнопки за рекламу (data-a="ad" data-id=key). Пусто, если рекламы на площадке нет. */
    button(key, extraCls, text) {
        if (!this.available()) return '';
        const cd = this.cooldown();
        const dis = cd > 0 || this.busy || (key === 'free_gems' && this.gemsLeft() <= 0);
        const t = text ? `${text}<span class="adl">${this.label(key)}</span>` : this.label(key);
        return `<div class="gbuy adbtn ${extraCls || ''} ${dis ? 'dis' : ''}" data-a="ad" data-id="${key}"><img src="${GameAssets.img('icon', 'watch_ad')}" alt="">${t}</div>`;
    },

    today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
    gemsLeft() {
        const s = this.game.save, max = typeof ADS_GEMS_PER_DAY !== 'undefined' ? ADS_GEMS_PER_DAY : 10;
        if (s.adDay.day !== this.today()) { s.adDay.day = this.today(); s.adDay.gems = 0; }
        return Math.max(0, max - s.adDay.gems);
    },

    /** Показать рекламу для предложения key. true — предложение выполнено (все просмотры набраны). */
    async watch(key) {
        if (this.busy || !this.available()) return false;
        if (this.cooldown() > 0) { GameUI.toast(Lang.t('ads.in', { n: this.cooldown() }), 'blue'); return false; }
        const o = this.OFFERS[key], type = o ? o.type : key.split(':')[0] + '-unlock';
        this.busy = true;
        GameUI.adTick();
        let ok = false;
        try { ok = await Platform.rewarded(type); } catch (e) { ok = false; }
        this.busy = false;
        this.game._lastRewardAt = Date.now();
        const s = this.game.save;
        if (!ok) { GameUI.toast(Lang.t('ads.fail'), 'red'); GameUI.adTick(); return false; }
        const need = this.views(key), have = this.progress(key) + 1;
        if (have < need) {
            s.adProg[key] = have;
            this.game.persist();
            GameUI.toast(Lang.t('ads.progress', { a: have, b: need }), 'blue');
            GameUI.adTick();
            return false;
        }
        delete s.adProg[key];
        this.game.persist();
        GameUI.adTick();
        return true;
    },

    // --- временные бусты --------------------------------------------------------------------------
    BOOST_KEYS: { boost_cash: 'cash', boost_xp: 'xp', boost_luck: 'luck', boost_speed: 'speed' },
    boostLeft(k) { const t = this.game.save.timed[k] || 0; return Math.max(0, Math.ceil((t - Date.now()) / 1000)); },
    addBoost(k, minutes) {
        const s = this.game.save, now = Date.now();
        s.timed[k] = Math.max(now, s.timed[k] || 0) + minutes * 60000;
        this.game.persist();
    },
    mult(k) { return this.boostLeft(k) > 0 ? 2 : 1; },

    // --- приёмник наград Daily Gift и колеса (контракт rewardsSink движка) ------------------------
    sink() {
        const G = this.game, A = this;
        return {
            addCoins(n) { G.save.gems += Math.round(n); G.updateStats(); },
            owns(id) { return A.SPECIAL.includes(id) ? false : !!G.save.owned[id]; },
            isExclusive(id) { return DAILY_EXCLUSIVE.includes(id); },
            item(id) { return SKIN_ITEMS.find(x => x.id === id) || (A.SPECIAL.includes(id) ? { id, special: true } : null); },
            name(id) { return A.rewardName(id); },
            grant(id) { A.grantSpecial(id); },
            randomItem(o) {
                const rng = (o && o.rng) || Math.random;
                const pool = SKIN_ITEMS.filter(x => !x.default && x.tab !== 'mythic' && !DAILY_EXCLUSIVE.includes(x.id) && !G.save.owned[x.id]);
                return pool.length ? pool[Math.floor(rng() * pool.length)].id : null;
            },
        };
    },
    rewardName(id) {
        const k = 'reward.' + id;
        if (LANG_STRINGS[Lang.code] && LANG_STRINGS[Lang.code][k]) return Lang.t(k);
        const it = SKIN_ITEMS.find(x => x.id === id);
        return it ? (Lang.code === 'ru' ? it.name.ru : it.name.en) : id;
    },
    /** Особые награды: деньги за минуты дохода, бусты, зверь; иначе — предмет магазина. */
    grantSpecial(id) {
        const G = this.game;
        if (id === 'cash5') { const v = G.cashGift(5); G.save.money += v; GameUI.toast('+' + Econ.money(v), ''); }
        else if (id === 'boost_cash' || id === 'boost_xp' || id === 'boost_luck' || id === 'boost_speed') this.addBoost(this.BOOST_KEYS[id], 5);
        else if (id === 'mystery') G.giveMystery();
        else if (id === 'super_throw') { G.save.superThrow = true; }
        else { G.save.owned[id] = true; }
        G.updateStats();
        G.persist();
    },
};

/** Эксклюзивы 7-го дня Daily Gift (не продаются и не выпадают на колесе). */
const DAILY_EXCLUSIVE = ['outfit_dragon_knight', 'outfit_frost_warden', 'outfit_ember_lord', 'outfit_aurora_paladin'];

/** Награды Daily Gift (дни 1–6; день 7 — эксклюзивный скин). coins = кристаллы. */
const DAILY_REWARDS = [
    { coins: 40, item: 'cash5' },
    { coins: 60, item: 'boost_xp' },
    { coins: 90, item: 'boost_cash' },
    { coins: 120, randomItems: 1 },
    { coins: 160, item: 'mystery' },
    { coins: 250, item: 'boost_luck' },
];

/** Секторы колеса фортуны (coins = кристаллы). */
const WHEEL_SECTORS = [
    { coins: 20, weight: 22 },
    { item: 'cash5', weight: 18, dupCoins: 30 },
    { coins: 50, weight: 12 },
    { item: 'boost_cash', weight: 10, dupCoins: 40 },
    { randomItem: true, weight: 8 },
    { item: 'boost_luck', weight: 8, dupCoins: 40 },
    { item: 'mystery', weight: 4, dupCoins: 80 },
    { coins: 200, weight: 3 },
];
