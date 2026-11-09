// GameThrow.js — бросок еды.
//   FoodShot    — летящая еда (игрок и боты): дуга от руки к точке трассы, вращение, след, приземление.
//   PlayerThrow — сценарий броска игрока: шкала силы («TAP TO THROW!», PERFECT) -> замах -> полёт с камерой
//                 (удача растёт, имя зоны) -> приземление -> животное подходит к еде -> имя по буквам -> карточка
//                 «NEW!» -> «нажми, чтобы продолжить». Итог — callback({ id, muts, zone, luck }).
// Решения (дальность, зона, животное, мутации) — Econ (числа), Babylon — только вид.

class FoodShot {
    /**
     * @param {any} view View3D
     * @param {{ food: string, from: {x:number,y:number,h:number}, to: {x:number,y:number}, dist: number, fx?: any, onLand?: Function }} o
     */
    constructor(view, o) {
        this.view = view;
        this.o = o;
        this.t = 0;
        this.done = false;
        this.landed = false;
        this.bounce = 0;
        const speed = Math.max(typeof FLIGHT_SPEED !== 'undefined' ? FLIGHT_SPEED : 3200, o.dist / (typeof FLIGHT_TIME_MAX !== 'undefined' ? FLIGHT_TIME_MAX : 7));
        this.T = Math.max(0.6, o.dist / speed);
        const arcK = typeof FLIGHT_ARC !== 'undefined' ? FLIGHT_ARC : 0.08, arcMax = typeof FLIGHT_ARC_MAX !== 'undefined' ? FLIGHT_ARC_MAX : 1400;
        this.arc = Math.min(arcMax, 120 + o.dist * arcK);
        this.groundTo = Nav.ready ? Nav.height(o.to.x, o.to.y) : 0;
        this.x = o.from.x; this.y = o.from.y; this.h = o.from.h;
        this.mesh = null;
        this.trail = null;
        this.spin = 9 + Math.random() * 5;
        GameModels.build(GameAssets.path('food', o.food), view, 'shot', 'actor').then((m) => {
            if (!m) return;
            if (this.done) { Model3D.dispose(view, m); return; }
            this.mesh = m;
            m.scaling.setAll(1.6);
            this._apply();
            if (o.fx) { try { this.trail = o.fx.play('trail', m.position, { follow: m, color: '#fff6c8' }); } catch (e) { this.trail = null; } }
        });
    }

    /** Доля пройденного пути 0..1. */
    get frac() { return Math.min(1, this.t / this.T); }

    update(dt) {
        if (this.done) return;
        const o = this.o;
        if (!this.landed) {
            this.t += dt;
            const s = Math.min(1, this.t / this.T);
            this.x = o.from.x + (o.to.x - o.from.x) * s;
            this.y = o.from.y + (o.to.y - o.from.y) * s;
            const base = o.from.h + (this.groundTo + 20 - o.from.h) * s;
            this.h = base + this.arc * 4 * s * (1 - s);
            if (s >= 1) { this.landed = true; this.bounce = 0; if (this.trail) { this.trail.stop(); this.trail = null; } if (o.onLand) o.onLand(this); }
        } else {
            // подскок и остановка
            this.bounce += dt;
            const b = this.bounce;
            this.h = this.groundTo + 20 + Math.max(0, Math.sin(Math.min(1, b / 0.35) * Math.PI) * 60 * Math.max(0, 1 - b / 0.35));
            this.x += (o.to.x - o.from.x) / Math.max(1, o.dist) * 260 * Math.max(0, 0.5 - b) * dt;
            this.y += (o.to.y - o.from.y) / Math.max(1, o.dist) * 260 * Math.max(0, 0.5 - b) * dt;
            this.spin *= Math.pow(0.02, dt);
        }
        this._apply(dt);
    }

    _apply(dt) {
        const m = this.mesh;
        if (!m) return;
        m.position.set(this.x, this.h, this.y);
        if (dt) { m.rotation.x += this.spin * dt; m.rotation.z += this.spin * 0.6 * dt; }
        if (this.landed && this.bounce > 0.5) { m.rotation.x *= 0.9; m.rotation.z *= 0.9; }
    }

    dispose() {
        this.done = true;
        if (this.trail) { this.trail.stop(); this.trail = null; }
        if (this.mesh) { Model3D.dispose(this.view, this.mesh); this.mesh = null; }
    }
}

// ------------------------------------------------------------------------------------------------
// PlayerThrow — сценарий броска игрока
// ------------------------------------------------------------------------------------------------
/** @satisfies {Record<string, any>} */
const PlayerThrow = {
    /** @type {any} */ game: null,
    state: 'off',          // off | aim | windup | flight | land | approach | reveal
    t: 0,
    meterV: 0,
    meterT: 0,
    /** @type {FoodShot | null} */ shot: null,
    /** @type {AnimalActor | null} */ animal: null,
    result: /** @type {any} */ (null),
    power: 0, bonus: 0, perfect: false, reach: 0, dist: 0, lastZone: -1,
    cam: { x: 0, y: 0, h: 0, frameHeight: 520 },
    camAz: 0, camPitch: 0.3, orbit: 0,
    revealText: '', revealOrder: /** @type {number[]} */ ([]), revealN: 0,
    tapLock: 0,
    isNew: false,
    _leaving: false,
    arrived: false,
    arriveT: 0,
    prevZoom: 0,

    active() { return this.state !== 'off'; },

    /** Начать прицел: игрок встал на полосу броска. */
    start(game) {
        this.game = game;
        const hero = game.hero, L = GameWorld.lane;
        this.state = 'aim'; this.t = 0; this.meterT = Math.random() * 0.3; this.tapLock = 0.25;
        hero.heading = L.heading;
        game.avatar.hold(game.save.food);
        game.avatar.play('throw_ready');
        this.power = (Econ.power(game.save.level, game.save.food) + game.powerBonus()) * (game.save.superThrow ? 2 : 1);
        this.camAz = L.heading; this.camPitch = 0.2;
        this.prevZoom = game.app.camera.zoomTarget;
        game.app.camera.zoomTarget = 3;
        game.app.camera.follow(this.cam);
        game.app.location.view.camera.maxZ = game.farZ(true);
        GameUI.meter(true);
        sfx('open', { volume: 0.4 });
        Input.setContext({ id: 'throw', label: Lang.t('ui.throw'), icon: GameAssets.img('foodIcon', game.save.food), action: 'interact' }, 5);
        Tutorial.complete('goThrow');
    },

    restoreCam() {
        const g = this.game, cam = g.app.camera;
        cam.zoomTarget = this.prevZoom || cam.zoomTarget;
        cam.follow(g.cam);
        g.app.location.view.camera.maxZ = g.farZ(false);
    },

    cancel() {
        if (this.state !== 'aim') return;
        this.state = 'off';
        this.restoreCam();
        GameUI.meter(false);
        Input.clearContext('throw');
        this.game.avatar.hold(null);
    },

    tap() {
        if (this.tapLock > 0) return;
        if (this.state === 'aim') this._release();
        else if (this.state === 'reveal' && this.t > 0.6 && !this._leaving) { this._leaving = true; Platform.ads.next(() => { this._leaving = false; if (this.state === 'reveal') this._finish(); }); }
        else if (this.state === 'flight' || this.state === 'land' || this.state === 'approach') { /* ждать */ }
    },

    _release() {
        const g = this.game, v = this.meterV;
        this.bonus = Econ.meterBonus(this.power, v);
        this.perfect = v >= (typeof METER_PERFECT !== 'undefined' ? METER_PERFECT : 0.9);
        GameUI.meterResult(this.perfect, this.bonus);
        if (this.perfect) sfx('perfect', { volume: 0.7 });
        Input.clearContext('throw');
        this.state = 'windup'; this.t = 0;
        g.avatar.play('throw', { loop: false, restart: true, fade: 0.05 });
        Tutorial.complete('throw');
    },

    _launch() {
        const g = this.game, hero = g.hero, L = GameWorld.lane;
        const total = this.power + this.bonus;
        if (g.save.superThrow) { g.save.superThrow = false; g.persist(); }
        const jitter = 0.95 + Math.random() * 0.1;
        this.reach = Econ.zoneReach(total * jitter);
        this.dist = GameWorld.reachToDist(this.reach);
        const side = (Math.random() * 2 - 1) * L.width * 0.22;
        const to = GameWorld.lanePoint(this.dist, side);
        const hp = g.avatar.handPos();
        const from = { x: hp.x, y: hp.z, h: hp.y };
        // расстояние от руки до точки
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        g.avatar.hold(null);
        this.shot = new FoodShot(g.app.location.view, { food: g.save.food, from, to, dist, fx: g.app.fx, onLand: () => this._landed() });
        this.lastZone = -1;
        this.state = 'flight'; this.t = 0;
        sfx(['throw1', 'throw2'], { volume: 0.7 });
        GameUI.meter(false);
        GameUI.flight(true);
        void hero;
    },

    _landed() {
        const g = this.game;
        this.state = 'land'; this.t = 0;
        sfx('land', { volume: 0.7 });
        const s = this.shot;
        if (s && g.app.fx) { try { g.app.fx.play('dust', new BABYLON.Vector3(s.x, s.groundTo + 10, s.y), { burst: 18, rate: 0, capacity: 24, life: [0.4, 0.9] }); } catch (e) { /* без пыли */ } }
        // решение: зона и животное
        const zone = Math.min(Econ.zoneCount() - 1, Math.floor(this.reach));
        const luck = Econ.luck(this.reach, g.save.food, g.luckBoost());
        const rnd = Math.random;
        const id = Econ.rollAnimal(zone, luck, rnd);
        const muts = Econ.rollMutations(luck, rnd);
        this.result = { id, muts, zone, luck, uid: ANIMAL_UID++ };
    },

    _spawnAnimal() {
        const g = this.game, s = this.shot, L = GameWorld.lane;
        if (!s) return;
        const a = new AnimalActor(g.app.location.view, { id: this.result.id, muts: this.result.muts, uid: this.result.uid }, null);
        // выходит сбоку и спереди, идёт к еде
        const side = (Math.random() < 0.5 ? -1 : 1);
        const sx = s.x + L.fx * 330 - L.fy * side * 300, sy = s.y + L.fy * 330 + L.fx * side * 300;
        a.place(sx, sy, Math.atan2(s.y - sy, s.x - sx));
        const stop = 50 + Math.min(120, (Econ.animal(this.result.id) ? 40 : 40) + 30);
        this.arrived = false;
        const ang = Math.atan2(sy - s.y, sx - s.x);
        a.goTo(s.x + Math.cos(ang) * stop, s.y + Math.sin(ang) * stop, (act) => { act.mode = 'eat'; act.heading = Math.atan2(s.y - act.y, s.x - act.x); this.arrived = true; this.arriveT = this.t; });
        this.animal = a;
        // имя по буквам
        const info = Econ.animal(this.result.id);
        this.revealText = (info ? (Lang.code === 'ru' ? info.ru : info.en) : this.result.id).toUpperCase();
        const idx = [];
        for (let i = 0; i < this.revealText.length; i++) if (this.revealText[i] !== ' ') idx.push(i);
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
        this.revealOrder = idx; this.revealN = 0;
        GameUI.revealName(this._masked());
    },

    _masked() {
        const shown = new Set(this.revealOrder.slice(0, this.revealN));
        let out = '';
        for (let i = 0; i < this.revealText.length; i++) {
            const ch = this.revealText[i];
            out += ch === ' ' ? ' ' : (shown.has(i) ? ch : '_');
        }
        return out;
    },

    /** Карточка улова (после «золото» / «ещё один» — заново). */
    showCard() {
        const r = this.result, info = Econ.animal(r.id);
        GameUI.reveal({ id: r.id, muts: r.muts, isNew: this.isNew, income: Econ.income(r.id, r.muts), rarity: info ? info.rarity : 'common', name: this.revealText, gold: !!r.gold, double: !!r.double });
        this.t = Math.min(this.t, 0.3);
    },

    /** Зверь с новой мутацией встаёт на место прежнего. */
    respawnAnimal() {
        const s = this.shot;
        if (!s) return;
        const a = new AnimalActor(this.game.app.location.view, { id: this.result.id, muts: this.result.muts, uid: this.result.uid }, null);
        a.place(s.x + 130, s.y, Math.PI);
        a.mode = 'happy';
        this.animal = a;
        try { this.game.app.fx.play('magic', new BABYLON.Vector3(a.x, 80, a.y), { color: '#ffd21a' }); } catch (e) { /* */ }
    },

    _finish() {
        const g = this.game, r = this.result;
        GameUI.reveal(null);
        GameUI.flight(false);
        if (this.shot) { this.shot.dispose(); this.shot = null; }
        if (this.animal) { this.animal.dispose(); this.animal = null; }
        this.state = 'off';
        this.restoreCam();
        g.afterThrow(r);
    },

    /** Камера броска: цель, азимут, наклон. */
    camera(dt) {
        const g = this.game, cam = g.app.camera, hero = g.hero;
        const k = 1 - Math.pow(0.02, dt);
        if (this.state === 'aim' || this.state === 'windup') {
            const L = GameWorld.lane;
            this.cam.x = hero.x + L.fx * 60; this.cam.y = hero.y + L.fy * 60; this.cam.h = hero.h + 170;
            this.cam.frameHeight = 360;
            cam.c.followLerp = 0.25;
            this.camPitch += (0.16 - this.camPitch) * k;
            this.camAz = L.heading;
        } else if (this.state === 'flight' && this.shot) {
            const s = this.shot, L = GameWorld.lane;
            this.cam.x = s.x - L.fx * 120; this.cam.y = s.y - L.fy * 120; this.cam.h = s.h + 40;
            this.cam.frameHeight = 560;
            cam.c.followLerp = 0.55;
            this.camPitch += (0.22 - this.camPitch) * k;
            this.camAz = L.heading;
        } else if ((this.state === 'land' || this.state === 'approach' || this.state === 'reveal') && this.shot) {
            const s = this.shot, a = this.animal;
            const fx = a ? (s.x + a.x) / 2 : s.x, fy = a ? (s.y + a.y) / 2 : s.y;
            this.cam.x = fx; this.cam.y = fy; this.cam.h = s.groundTo + 70 + (a ? a.height * 0.35 : 0);
            const gap = a ? Math.hypot(a.x - s.x, a.y - s.y) : 0;
            this.cam.frameHeight = Math.max(320 + (a ? a.height * 2.2 : 120), gap * 1.5);
            cam.c.followLerp = 0.2;
            this.orbit += dt * 0.12;
            this.camPitch += (0.2 - this.camPitch) * k;
            this.camAz = GameWorld.lane.heading + Math.sin(this.orbit) * 0.5;
        }
        let d = this.camAz - cam.azimuth;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        cam.azimuth += d * Math.min(1, dt * 5);
        cam.pitch = this.camPitch;
    },

    update(dt) {
        if (this.state === 'off') return;
        const g = this.game;
        this.t += dt;
        this.tapLock = Math.max(0, this.tapLock - dt);
        if (this.state === 'aim') {
            this.meterT += dt;
            const sp = typeof METER_SPEED !== 'undefined' ? METER_SPEED : 0.85;
            this.meterV = 0.5 - 0.5 * Math.cos(this.meterT * sp * Math.PI * 2);
            GameUI.meterValue(this.meterV, Econ.meterBonus(this.power, this.meterV));
            if (Input.pressed('interact') || Input.pressed('jump')) this.tap();
        } else if (this.state === 'windup') {
            if (this.t >= 0.2 && !this.shot) this._launch();
        } else if (this.state === 'flight') {
            const s = this.shot;
            if (s) {
                s.update(dt);
                const L = GameWorld.lane;
                const d = (s.x - L.x) * L.fx + (s.y - L.y) * L.fy;
                const r = Math.max(0, GameWorld.distToReach(Math.max(0, d)));
                const zone = Math.floor(r);
                const luck = d < 0 ? 1 : Econ.luck(r, g.save.food, g.luckBoost());
                if (zone !== this.lastZone && d >= 0) {
                    this.lastZone = zone;
                    sfx('tick', { volume: 0.45, rate: 0.8 + zone * 0.02 });
                }
                GameUI.flightInfo(luck, d >= 0 ? zone : -1);
            }
        } else if (this.state === 'land') {
            if (this.shot) this.shot.update(dt);
            if (this.t > 0.7) { this.state = 'approach'; this.t = 0; this._spawnAnimal(); }
        } else if (this.state === 'approach' || this.state === 'reveal') {
            if (this.shot) this.shot.update(dt);
            if (this.animal) this.animal.update(dt, null);
            if (this.state === 'approach') {
                const per = 0.12;
                if (!this.arrived && this.t > 3.5 && this.animal) { const a0 = this.animal; a0.mode = 'eat'; this.arrived = true; this.arriveT = this.t; }
                const want = this.arrived ? Math.min(this.revealOrder.length, Math.floor(Math.max(0, this.t - this.arriveT - 0.3) / per)) : 0;
                if (want > this.revealN) {
                    this.revealN = want;
                    GameUI.revealName(this._masked());
                    sfx('tick', { volume: 0.5, rate: 1 + this.revealN * 0.04 });
                }
                if (this.arrived && this.revealN >= this.revealOrder.length && this.t > this.arriveT + 0.8) {
                    GameUI.flight(false);
                    this.state = 'reveal'; this.t = 0;
                    const r = this.result, info = Econ.animal(r.id);
                    const isNew = !g.save.index[r.id];
                    this.isNew = isNew;
                    this.showCard();
                    if (Tutorial.roundCounts()) Platform.ads.roundEnded(true);
                    sfx('reveal', { volume: 0.8 });
                    if (this.animal) {
                        this.animal.mode = 'happy';
                        const col = Econ.rarity(info ? info.rarity : 'common').color;
                        try { g.app.fx.play('magic', new BABYLON.Vector3(this.animal.x, this.animal.h + this.animal.height * 0.5, this.animal.y), { color: col }); } catch (e) { /* без искр */ }
                    }
                }
            } else if (Input.pressed('interact') || Input.pressed('jump')) this.tap();
        }
        this.camera(dt);
    },
};
