// GameBots.js — боты, которые «играют» как живые игроки: у каждого свой участок (plot-2…6), ник и скин из магазина;
// подтягиваются на своём турнике, ходят к полосе и бросают еду (еда летит вдоль трассы), ловят животное и несут
// в загон, продают слабых, покупают турники и еду, иногда пишут в чат над головой. Попадают в табло лидеров.
// Решения — Econ (те же формулы, что у игрока), путь — Nav.path. Вид — Avatar / AnimalActor / FoodShot.

const BOT_CHAT = {
    ru: {
        talk: ['го кидать еду', 'у кого есть дракон?', 'я почти дошёл до вулкана', 'лол опять кролик', 'кто тоже качается?', 'мой турник лучший',
            'какой у вас скин?', 'хочу радужного', 'сколько у вас силы?', 'еда летит так далеко', 'ура, новый вид!', 'это лучший симулятор'],
        catch: ['поймал {name}!', 'ееее {name}', 'ого, {name}!', 'смотрите, {name}', '{name} мой :)'],
        rare: ['ВАУ {name}!!!', 'ЛЕГЕНДАРКА!!', 'не верю, {name}!', 'вот это удача'],
        buy: ['купил новый турник', 'наконец-то {name}', 'апгрейд!'],
    },
    en: {
        talk: ['lets throw some food', 'anyone got a dragon?', 'almost reached the volcano', 'lol another rabbit', 'who else is lifting?', 'my bar is the best',
            'whats your skin?', 'i want a rainbow one', 'how much power u got?', 'food flies so far', 'yay new species!', 'best simulator ever'],
        catch: ['got a {name}!', 'yesss {name}', 'woah, {name}!', 'look, {name}', '{name} is mine :)'],
        rare: ['WOW {name}!!!', 'LEGENDARY!!', 'no way, {name}!', 'so lucky'],
        buy: ['bought a new bar', 'finally {name}', 'upgrade!'],
    },
};

let BOT_SEED = 1;
function botRng() { BOT_SEED = (BOT_SEED * 1664525 + 1013904223) >>> 0; return BOT_SEED / 4294967296; }

class Bot {
    constructor(i, plot, labels, view) {
        this.i = i;
        this.plot = plot;
        this.labels = labels;
        this.view = view;
        const names = (typeof ObbyBots !== 'undefined' && ObbyBots.NAMES && (ObbyBots.NAMES[Lang.code] || ObbyBots.NAMES.en)) || ['Player'];
        this.name = names[Math.floor(botRng() * names.length)] + (botRng() < 0.5 ? String(Math.floor(botRng() * 900 + 100)) : '');
        // прогресс: от новичка до «старожила»
        const t = [0.15, 0.35, 0.55, 0.75, 0.92][(i - 1) % 5] * (0.85 + botRng() * 0.3);
        this.level = Math.max(1, Math.round(4 + Math.pow(t, 2.2) * 520));
        this.xp = 0;
        this.bar = Math.min(GAME_DATA.BARS.length - 1, Math.floor(t * 8.5));
        const fi = Math.min(GAME_DATA.FOODS.length - 1, Math.floor(t * 14));
        this.food = GAME_DATA.FOODS[fi].id;
        this.cap = Math.min(2, Math.floor(t * 3));
        this.money = 50 * Math.pow(10, t * 6);
        /** @type {Array<{ uid: number, id: string, muts: string[] }>} */
        this.animals = [];
        const n = 5 + Math.floor(botRng() * 5);
        for (let k = 0; k < n; k++) this.animals.push(this.roll());
        this.sortAnimals();
        this.best = this.animals.reduce((m, a) => Math.max(m, Econ.income(a.id, a.muts)), 0);
        // вид
        const skins = SKIN_ITEMS.filter(s => s.tab === 'outfit' || s.tab === 'mythic');
        const hats = SKIN_ITEMS.filter(s => s.tab === 'hat'), backs = SKIN_ITEMS.filter(s => s.tab === 'back');
        const pick = (arr, p) => (arr.length && botRng() < p ? arr[Math.floor(botRng() * arr.length)].id : '');
        this.look = { skin: pick(skins, 1) || 'outfit_classic', hat: pick(hats, 0.55), back: pick(backs, 0.35) };
        const g = plot.gate();
        this.w = new Walker(g.inner.x, g.inner.y, 0);
        this.w.place(g.inner.x + (botRng() - 0.5) * 300, g.inner.y + (botRng() - 0.5) * 300, botRng() * 6.28);
        this.avatar = new Avatar(view, this.look);
        this.state = 'think';
        this.t = botRng() * 2;
        /** @type {Array<{x:number,y:number}>} */
        this.path = [];
        this.reps = 0;
        /** @type {FoodShot | null} */ this.shot = null;
        /** @type {AnimalActor | null} */ this.carry = null;
        /** @type {any} */ this.carryData = null;
        this.chatT = 6 + botRng() * 20;
        this.bubble = '';
        this.bubbleT = 0;
        plot.owner = this;
        this.syncPlot();
    }

    power() { return Econ.power(this.level, this.food); }
    income() { return this.animals.slice(0, Econ.capacity(this.cap).slots).reduce((s, a) => s + Econ.income(a.id, a.muts), 0); }
    roll() {
        const P = this.power() * (0.85 + botRng() * 0.4);
        const reach = Econ.zoneReach(P);
        const luck = Econ.luck(reach, this.food, 1);
        return { uid: ANIMAL_UID++, id: Econ.rollAnimal(Math.floor(reach), luck, botRng), muts: Econ.rollMutations(luck, botRng) };
    }
    sortAnimals() { this.animals.sort((a, b) => Econ.income(b.id, b.muts) - Econ.income(a.id, a.muts)); }
    visibleMax() {
        const m = IS_MOBILE ? (typeof BOT_VISIBLE_ANIMALS_MOBILE !== 'undefined' ? BOT_VISIBLE_ANIMALS_MOBILE : 4) : (typeof BOT_VISIBLE_ANIMALS !== 'undefined' ? BOT_VISIBLE_ANIMALS : 6);
        const q = typeof Quality !== 'undefined' && Quality.level === 0 ? Math.min(m, 3) : m;
        return q;
    }
    syncPlot() {
        const slots = Econ.capacity(this.cap).slots;
        this.plot.syncAnimals(this.animals.slice(0, slots), this.visibleMax());
        this.plot.setBar(this.bar);
        this.plot.setSign(this.name, Math.min(slots, this.animals.length) + '/' + slots, '#7fd8ff', 'small');
    }

    say(cat, vars) {
        const L = BOT_CHAT[Lang.code] || BOT_CHAT.en, list = L[cat];
        if (!list) return;
        let s = list[Math.floor(botRng() * list.length)];
        s = s.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
        this.bubble = s; this.bubbleT = 4.5;
    }

    goTo(x, y) {
        const p = Nav.ready ? Nav.path(this.w.x, this.w.y, x, y, 34, { partial: true }) : null;
        this.path = p && p.length ? p : [{ x, y }];
    }
    walk(dt) {
        if (!this.path.length) return true;
        const pt = this.path[0];
        if (this.w.walkTo(dt, pt.x, pt.y, 470, 30)) { this.path.shift(); }
        return !this.path.length;
    }

    think() {
        const r = botRng();
        if (this.carryData) { this.state = 'toPlot'; const g = this.plot.gate(); this.goTo(g.inner.x, g.inner.y); return; }
        if (r < 0.42 && this.plot.bar) { this.state = 'toBar'; const b = this.plot.bar; this.goTo(b.x - Math.cos(b.heading) * 10, b.y - Math.sin(b.heading) * 10); return; }
        if (r < 0.85) {
            const L = GameWorld.lane, side = (botRng() * 2 - 1) * (L.width / 2 - 220);
            this.tx = L.throwX - L.fx * 40 - L.fy * side; this.ty = L.throwY - L.fy * 40 + L.fx * side;
            this.state = 'toThrow'; this.goTo(this.tx, this.ty); return;
        }
        this.state = 'wander';
        const p = this.plot.point((botRng() * 2 - 1) * 1.4, (botRng() * 2 - 1) * 1.4);
        this.goTo(p.x, p.y);
    }

    update(dt) {
        this.t -= dt;
        const s = this.state;
        let clip = 'idle';
        if (s === 'think') { if (this.t <= 0) this.think(); }
        else if (s === 'wander' || s === 'toBar' || s === 'toThrow' || s === 'toPlot' || s === 'toSell') {
            const done = this.walk(dt);
            clip = this.w.moving ? 'run' : 'idle';
            if (done) {
                if (s === 'toBar') { const b = this.plot.bar; this.w.place(b.x, b.y, b.heading); this.state = 'pull'; this.reps = 6 + Math.floor(botRng() * 14); this.t = 0.4; }
                else if (s === 'toThrow') { this.w.heading = GameWorld.lane.heading; this.state = 'aim'; this.t = 0.8 + botRng() * 1.6; this.avatar.hold(this.food); }
                else if (s === 'toPlot') this.placeCarry();
                else { this.state = 'think'; this.t = 0.5 + botRng() * 2; }
            }
        } else if (s === 'pull') {
            clip = this.t > 0 ? 'hang' : 'pullup';
            if (this.t <= -(typeof REP_SECONDS !== 'undefined' ? REP_SECONDS : 1.05)) {
                this.t = 0;
                const r = Econ.addXp(this.level, this.xp, Econ.bar(this.bar).xp);
                this.level = r.level; this.xp = r.xp;
                if (--this.reps <= 0) { const b = this.plot.bar; this.w.place(b.x - Math.cos(b.heading) * 150, b.y - Math.sin(b.heading) * 150, b.heading + Math.PI); this.state = 'think'; this.t = 0.3; this.shop(); }
            }
        } else if (s === 'aim') {
            clip = 'throw_ready';
            if (this.t <= 0) { this.state = 'throwing'; this.t = 0.2; this.avatar.play('throw', { loop: false, restart: true, fade: 0.05 }); clip = 'throw'; }
        } else if (s === 'throwing') {
            clip = 'throw';
            if (this.t <= 0 && !this.shot) this.launch();
            if (this.shot) {
                this.shot.update(dt);
                if (this.shot.landed && this.shot.bounce > 0.6) { this.shot.dispose(); this.shot = null; this.caught(); }
            }
        }
        if (this.state !== 'throwing' && this.state !== 'aim') this.avatar.play(clip);
        this.avatar.place(this.w.x, this.w.y, this.w.h, this.w.heading);
        if (this.carry) this.carry.update(dt, null);
        // реплики и подпись
        this.chatT -= dt;
        const chatSec = typeof BOT_CHAT_SEC !== 'undefined' ? BOT_CHAT_SEC : 14;
        if (chatSec > 0 && this.chatT <= 0) { this.chatT = chatSec * (3 + botRng() * 4); this.say('talk'); }
        this.bubbleT = Math.max(0, this.bubbleT - dt);
        if (this.labels) {
            const id = 'bot' + this.i;
            const bub = this.bubbleT > 0 ? `<div class="bub">${this.bubble}</div>` : '';
            this.labels.set(id, `${bub}<div class="nm">${this.name}</div><div class="sub">${perSec(this.income())}</div>`, 'player', 5200);
            this.labels.pos(id, this.w.x, this.w.y, this.w.h + 240);
        }
        // доход и покупки
        this.money += this.income() * dt;
    }

    launch() {
        const L = GameWorld.lane, P = this.power() * (1 + botRng() * 0.3);
        this.reach = Econ.zoneReach(P * (0.95 + botRng() * 0.1));
        const dist = GameWorld.reachToDist(this.reach);
        const to = GameWorld.lanePoint(dist, (botRng() * 2 - 1) * L.width * 0.25);
        const hp = this.avatar.handPos();
        this.avatar.hold(null);
        // далёкий бросок рисуем только у полосы: дальше игрок всё равно не видит
        this.shot = new FoodShot(this.view, { food: this.food, from: { x: hp.x, y: hp.z, h: hp.y }, to, dist: Math.hypot(to.x - hp.x, to.y - hp.z), fx: null });
        sfx(['throw1', 'throw2'], { volume: 0.15 });
    }

    caught() {
        const zone = Math.floor(this.reach), luck = Econ.luck(this.reach, this.food, 1);
        const a = { uid: ANIMAL_UID++, id: Econ.rollAnimal(zone, luck, botRng), muts: Econ.rollMutations(luck, botRng) };
        this.carryData = a;
        this.carry = new AnimalActor(this.view, a, null);
        this.carry.place(this.w.x - Math.cos(this.w.heading) * 160, this.w.y - Math.sin(this.w.heading) * 160, this.w.heading);
        this.carry.follow(this.w, 0);
        const info = Econ.animal(a.id), name = info ? (Lang.code === 'ru' ? info.ru : info.en) : a.id;
        if (info && info.rIndex >= 4) this.say('rare', { name }); else if (botRng() < 0.4) this.say('catch', { name });
        this.best = Math.max(this.best, Econ.income(a.id, a.muts));
        this.w.heading += Math.PI;
        this.state = 'think'; this.t = 0.6;
    }

    placeCarry() {
        if (this.carryData) {
            const cap = Econ.capacity(this.cap).slots;
            this.animals.push(this.carryData);
            this.sortAnimals();
            while (this.animals.length > cap) { const x = this.animals.pop(); if (x) this.money += Econ.sellPrice(x.id, x.muts); }
            this.carryData = null;
            if (this.carry) { this.carry.dispose(); this.carry = null; }
            this.syncPlot();
        }
        this.state = 'think'; this.t = 0.5 + botRng();
    }

    shop() {
        let bought = '';
        const nb = this.bar + 1;
        if (nb < GAME_DATA.BARS.length && this.money >= Econ.bar(nb).price) { this.money -= Econ.bar(nb).price; this.bar = nb; bought = Lang.code === 'ru' ? Econ.bar(nb).ru : Econ.bar(nb).en; this.plot.setBar(nb); }
        const fi = Econ.foodIndex(this.food) + 1, f = GAME_DATA.FOODS[fi];
        if (f && this.money >= f.price) { this.money -= f.price; this.food = f.id; bought = Lang.code === 'ru' ? f.ru : f.en; }
        if (bought && botRng() < 0.5) this.say('buy', { name: bought });
    }

    dispose() {
        if (this.labels) this.labels.remove('bot' + this.i);
        if (this.shot) this.shot.dispose();
        if (this.carry) this.carry.dispose();
        this.avatar.dispose();
    }
}

/** @satisfies {Record<string, any>} */
const GameBots = {
    /** @type {Bot[]} */ bots: [],
    async init(app, labels) {
        BOT_SEED = (Date.now() & 0xffff) + 7;
        const n = Math.min(5, typeof BOTS_COUNT !== 'undefined' ? BOTS_COUNT : 5);
        for (let i = 0; i < n; i++) {
            const plot = GameWorld.plots[i + 1];
            if (!plot || !plot.m) continue;
            this.bots.push(new Bot(i + 1, plot, labels, app.location.view));
        }
    },
    update(dt) { for (const b of this.bots) b.update(dt); },
};
