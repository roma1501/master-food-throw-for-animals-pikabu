// Game.js — «Master Food Throw for Animals»: Roblox-симулятор. Игрок подтягивается на турнике (уровни дают силу
// броска), встаёт на светящуюся полосу и бросает еду вдоль трассы из 28 зон-биомов; где еда упала — животное этой
// зоны приходит поесть и ловится; животные живут в загоне игрока и приносят $/с; деньги — на турники, еду и
// вместимость участка; кристаллы (за новые виды и уровни) — на скины из магазина. Рядом играют боты.
// Модули: GameData (данные), Econ (формулы), GameWorld (мир по маркерам), Avatar/Walker/AnimalActor (вид и
// движение), PlayerThrow + FoodShot (бросок), GameBots (боты), GameUI (интерфейс), GameLabels (подписи).
// Прогресс — один объект Platform.save (поле tutorialDone в нём же).

/** @satisfies {Record<string, any>} */
const Game = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ save: null,
    /** @type {any} */ avatar: null,
    /** @type {Walker | null} */ hero: null,
    /** @type {GameLabels | null} */ labels: null,
    state: 'menu',           // menu | play | pull | throw
    cam: { x: 0, y: 0, h: 0, frameHeight: 900, frameWidth: 1100 },
    /** @type {Map<number, AnimalActor>} */ followers: new Map(),
    offerT: 20, secT: 0, offerI: 0, incomeT: 0, saveT: 0, hintT: 0, boardT: 0, repT: 0, throwCool: 0, inFood: false, inPlot: false,
    time: 0, lastStep: 0,
    /** @type {any} */ near: null,
    uiPause: false,
    /** @type {any[] | null} */ tutSteps: null,
    _newBarShown: -1,

    // ---------------------------------------------------------------------------------------------
    // Запуск
    // ---------------------------------------------------------------------------------------------
    async init(app) {
        this.app = app;
        const saved = (await Platform.load()) || {};
        this.save = this.normalize(saved);
        if (typeof Quality !== 'undefined' && this.save.quality) { try { Quality.set(this.save.quality); } catch (e) { /* авто */ } }
        HudLayout.init({ app });
        // Камера: на ПК — только левая кнопка мыши в правой половине экрана (мышь как палец), на телефоне — палец справа.
        // Другие кнопки мыши камеру не крутят (с зажатыми двумя кнопками поворот раньше залипал).
        Input.init({ app, mouse: 'none', mouseTouch: true, controls: false, actions: Object.assign({}, Input.DEFAULTS, { interact: { keys: ['KeyE', 'Enter'], pad: [2] } }) });
        if (app.camera.c) app.camera.c.orbit = 0;
        GameAds.init(this);
        const sink = GameAds.sink(), persist = () => this.persist();
        DailyGift.init({ rewards: DAILY_REWARDS, exclusive: DAILY_EXCLUSIVE, rewardsSink: sink, state: this.save.daily, persist });
        this.save.daily = DailyGift.state;
        Wheel.init({ sectors: WHEEL_SECTORS, rewardsSink: sink, state: this.save.wheel, persist });
        this.save.wheel = Wheel.state;
        Wheel.on((e) => { if (e.type === 'prize' && e.recovered) GameUI.toast(Lang.t('wheel.win'), 'blue'); });
        GameUI.init(this, this.handlers());
        this.labels = new GameLabels(app.location.view);
        await this.prepare(app);
        this.tutSteps = [
                { id: 'goThrow', title: 'tut.throw.t', hint: 'tut.throw.h', event: 'goThrow', world: () => ({ x: GameWorld.lane.throwX, y: GameWorld.lane.throwY, h: 0 }) },
                { id: 'throw', title: 'tut.tap.t', hint: { keyboard: 'tut.tap.k', touch: 'tut.tap.h', mouse: 'tut.tap.h', pad: 'tut.tap.k' }, event: 'throw' },
                { id: 'place', title: 'tut.place.t', hint: 'tut.place.h', event: 'place', skipIf: () => this.save.plot.length > 0, world: () => this.plotGate() },
                { id: 'bar', title: 'tut.bar.t', hint: 'tut.bar.h', event: 'bar', skipIf: () => this.save.bar >= 0, world: () => this.barPoint() },
                { id: 'pull', title: 'tut.pull.t', hint: 'tut.pull.h', event: 'levelup', world: () => this.barPoint() },
                { id: 'food', title: 'tut.food.t', hint: 'tut.food.h', event: 'food', skipIf: () => !!this.save.foods.apple, world: () => this.shopPoint() },
        ];
        Tutorial.init({
            app, state: () => this.save, field: 'tutorialDone', persist: () => this.persist(), skipKey: null,
            steps: this.tutSteps,
            onFinish: () => { this.hintT = 0; },
        });
        // Esc не используется: браузер закрывает им полноэкранный режим (требование площадок). F — окно зверей.
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF' && this.state === 'play' && !GameUI.open_) GameUI.openWin('animals');
        });
        window.addEventListener('lory-release-input', () => { /* Input сам отпускает клавиши */ });
        this.state = 'menu';
        GameUI.menu(true);
        this.updateStats();
    },

    async ready() { Platform.gameplay(false); },

    normalize(s) {
        const d = {
            v: 1, money: 0, gems: 60, level: 1, xp: 0, bar: -1, cap: 0, food: 'carrot', foods: { carrot: true },
            plot: [], backpack: [], index: {}, bestZone: 0, best: null, throws: 0,
            owned: {}, equip: { outfit: 'outfit_classic', hat: '', back: '' }, boosts: {}, freeAnimal: false,
            tutorialDone: false, quality: '', uid: 1, adProg: {}, timed: {}, adDay: { day: '', gems: 0 }, superThrow: false, daily: null, wheel: null,
        };
        const o = Object.assign(d, s && typeof s === 'object' ? s : {});
        o.foods = Object.assign({ carrot: true }, o.foods || {});
        o.equip = Object.assign({ outfit: 'outfit_classic', hat: '', back: '' }, o.equip || {});
        o.plot = Array.isArray(o.plot) ? o.plot.filter(a => a && Econ.animal(a.id)) : [];
        o.backpack = Array.isArray(o.backpack) ? o.backpack.filter(a => a && Econ.animal(a.id)) : [];
        for (const a of o.plot.concat(o.backpack)) { if (!a.uid) a.uid = o.uid++; if (!Array.isArray(a.muts)) a.muts = []; }
        ANIMAL_UID = Math.max(ANIMAL_UID, o.uid, ...o.plot.concat(o.backpack).map(a => a.uid + 1));
        return o;
    },

    persist() {
        this.save.uid = ANIMAL_UID;
        try { Platform.save(this.save); } catch (e) { console.warn('Platform.save:', e); }
    },

    async prepare(app) {
        const loc = app.location;
        Nav.build(loc);
        await GameWorld.init(app, this.labels);
        // дальность обзора: длинная трасса видна дальше (на телефоне — короче); арка и мелкий реквизит не заслоняют героя
        loc.view.camera.maxZ = this.farZ();
        if (app.camera.sight) app.camera.sight.fadeFilter = (rec) => /arch_gate|lamp_post|sign_arrow|crate|barrel|bench|flower_box|trash_bin/.test(rec.def.model || '');
        const sp = GameWorld.spawn;
        this.hero = new Walker(sp.x, sp.y, sp.heading);
        this.hero.place(sp.x, sp.y, sp.heading);
        this.avatar = new Avatar(loc.view, { skin: this.save.equip.outfit, hat: this.save.equip.hat, back: this.save.equip.back });
        this.avatar.place(this.hero.x, this.hero.y, this.hero.h, this.hero.heading);
        this.avatar.play('idle');
        // свой участок
        const myPlot = GameWorld.plots[0];
        myPlot.owner = { name: Lang.t('ui.you'), isPlayer: true };
        myPlot.setBar(this.save.bar);
        myPlot.syncAnimals(this.save.plot, 99);
        this.updateSign();
        this.syncFollowers();
        app.camera.azimuth = sp.heading;
        app.camera.pitch = 0.42;
        app.camera.follow(this.cam);
        this.syncCam(0);
        app.camera.snap();
        await GameBots.init(app, this.labels);
        app.onUpdate((dt) => { if (!this.uiPause) Rig.updateAll(dt); });
        app.onFrame((dt) => { if (this.labels) this.labels.update(dt); GameModels.updateRainbow(this.time); });
        this.drawBoards();
    },

    handlers() {
        return {
            play: () => this.play(),
            index: () => GameUI.openWin('index'),
            shop: () => GameUI.openWin('shop'),
            animals: () => (GameUI.open_ === 'animals' ? GameUI.close() : GameUI.openWin('animals')),
            settings: () => GameUI.openWin('settings'),
            stop: () => this.stopPull(),
            prompt: () => this.interact(),
            continue: () => PlayerThrow.tap(),
            throwTap: () => PlayerThrow.tap(),
            uiClick: (a) => this.uiInterstitial(a),
            buyBar: () => this.buyBar(),
            closeNewBar: () => { GameUI.newBar(null); this._newBarShown = this.save.bar + 1; },
            buyFood: (id) => this.buyFood(id),
            equipFood: (id) => { this.save.food = id; this.persist(); GameUI.renderFood(); this.updateStats(); },
            buyBoost: (id) => this.buyBoost(id),
            claimFree: () => this.claimFree(),
            buySkin: (id) => this.buySkin(id),
            equip: (id) => this.equipSkin(id),
            unequip: (id) => this.unequipSkin(id),
            pickUp: (uid) => this.pickUp(+uid),
            place: (uid) => this.placeOne(+uid),
            sell: (uid) => this.sellOne(+uid),
            equipBest: () => this.equipBest(),
            sound: () => { Sound.toggleMuted(); GameUI.renderSettings(); },
            quality: (q) => { try { Quality.set(q); } catch (e) { /* */ } this.save.quality = q; this.persist(); GameUI.renderSettings(); },
            howto: () => { GameUI.close(); Tutorial.start({ replay: true }); },
            ad: (key) => this.adOffer(key),
            offers: () => GameUI.openWin('offers'),
            daily: () => GameUI.openWin('daily'),
            wheel: () => GameUI.openWin('wheel'),
            offerClose: () => { GameUI.offerCard(null); this.offerT = (typeof ADS_OFFER_SEC !== 'undefined' ? ADS_OFFER_SEC : 45) * 1.5; },
            dailyClaim: () => { const r = DailyGift.claim(); if (r && r.ok) { sfx('reveal', { volume: 0.6 }); GameUI.toast(Lang.t('ui.giftTaken'), ''); } this.afterReward(); GameUI.renderDaily(); },
            dailyX2: async () => { const r = await DailyGift.claimX2(); if (r && r.ok) { sfx('reveal', { volume: 0.7 }); GameUI.toast(Lang.t('ui.giftTaken') + ' x2', ''); } this.afterReward(); GameUI.renderDaily(); },
            wheelFree: () => this.spinWheel(false),
            wheelAd: () => this.spinWheel(true),
            onOpen: (name) => { if (name !== 'animals') { this.uiPause = true; Input.configure({ controls: false }); } },
            onClose: () => { this.uiPause = false; if (this.state !== 'menu') Input.configure({ controls: true }); },
        };
    },

    play() {
        if (this.state !== 'menu') return;
        GameUI.menu(false);
        this.state = 'play';
        Input.configure({ controls: true });
        Platform.gameplay(true);
        try { Sound.music(GameAssets.sound('music') || '', { volume: 0.35 }); } catch (e) { /* без музыки */ }
        if (!this.save.tutorialDone) Tutorial.autoStart();
        this.hintT = 0;
    },

    // ---------------------------------------------------------------------------------------------
    // Точки мира
    // ---------------------------------------------------------------------------------------------
    farZ(throwing) { return throwing ? 17000 : (IS_MOBILE ? 10000 : 14000); },

    plotGate() { const g = GameWorld.plots[0].gate(); return { x: g.inner.x, y: g.inner.y, h: 0 }; },
    barPoint() { const b = GameWorld.plots[0].bar; return b ? { x: b.x, y: b.y, h: 0 } : null; },
    padPoint() { const b = GameWorld.plots[0].pad; return b ? { x: b.x, y: b.y, h: 0 } : null; },
    shopPoint() { const s = GameWorld.shopFood; return s ? { x: s.x, y: s.y, h: 0 } : null; },

    // ---------------------------------------------------------------------------------------------
    // Бусты и сила
    // ---------------------------------------------------------------------------------------------
    boostDefs() {
        return [
            { id: 'cash2', gems: 1500, icon: 'cash', color: '', title: 'ui.b.cash.t', desc: 'ui.b.cash.d' },
            { id: 'xp2', gems: 1000, icon: 'power', color: 'purple', title: 'ui.b.xp.t', desc: 'ui.b.xp.d' },
            { id: 'luck', gems: 2200, icon: 'luck', color: 'green', title: 'ui.b.luck.t', desc: 'ui.b.luck.d' },
        ];
    },
    cashMult() { return (this.save.boosts.cash2 ? 2 : 1) * GameAds.mult('cash'); },
    xpMult() { return (this.save.boosts.xp2 ? 2 : 1) * GameAds.mult('xp'); },
    luckBoost() { return (this.save.boosts.luck ? 1.5 : 1) * GameAds.mult('luck'); },
    /** Деньги «за N минут дохода» (не меньше $50 и не меньше цены следующей еды / 4). */
    cashGift(min) {
        const nf = GAME_DATA.FOODS.find(f => !this.save.foods[f.id]);
        return Math.max(50, Math.round(this.income() * 60 * min), nf ? Math.round(nf.price / 4) : 0);
    },
    powerBonus() { return 0; },
    power() { return Econ.power(this.save.level, this.save.food) + this.powerBonus(); },
    income() { return this.save.plot.reduce((s, a) => s + Econ.income(a.id, a.muts), 0) * this.cashMult(); },

    // ---------------------------------------------------------------------------------------------
    // Кадр
    // ---------------------------------------------------------------------------------------------
    update(dt) {
        const app = /** @type {LoryApp} */ (this.app);
        // открыто окно (магазин, индекс, колесо…): мир стоит, а звук интерфейса играет (пауза движка глушила бы его)
        if (this.uiPause) { Input.consumeLook(); return; }
        this.time += dt;
        const cam = app.camera;
        if (this.state === 'menu') {
            cam.azimuth += dt * 0.08;
            this.syncCam(dt);
            GameBots.update(dt);
            this.updatePlots(dt);
            return;
        }
        // бросок закончился нажатием на карточку (вне кадра игры) — вернуться в обычный режим и к камере героя
        if (this.state === 'throw' && !PlayerThrow.active()) this.state = 'play';
        // взгляд: мышь/палец
        const look = Input.consumeLook();
        if (!PlayerThrow.active()) {
            cam.azimuth += look.dx * 0.005;
            cam.pitch = Math.max(0.12, Math.min(1.2, cam.pitch + look.dy * 0.004));
        }
        if (PlayerThrow.active()) {
            this.state = 'throw';
            PlayerThrow.update(dt);
            this.avatar.place(this.hero.x, this.hero.y, this.hero.h, this.hero.heading);
            if (!PlayerThrow.active()) this.state = 'play';
        } else if (this.state === 'pull') this.stepPull(dt);
        else this.stepHero(dt);
        if (this.state !== 'throw') { this.syncCam(dt); }
        // доход
        this.incomeT += dt;
        if (this.incomeT >= 1) {
            this.incomeT -= 1;
            const inc = this.income();
            if (inc > 0) { this.save.money += inc; this.updateStats(); }
        }
        this.throwCool = Math.max(0, this.throwCool - dt);
        this.updateFollowers(dt);
        this.updatePlots(dt);
        GameBots.update(dt);
        this.hintT -= dt;
        if (this.hintT <= 0) { this.hintT = 0.4; this.updateHint(); }
        GameWorld.updateGuide(dt, this.state === 'throw' ? null : this.hero);
        this.boardT -= dt;
        if (this.boardT <= 0) { this.boardT = 3; this.drawBoards(); }
        this.saveT += dt;
        if (this.saveT > 10) { this.saveT = 0; this.persist(); }
        this.secT = (this.secT || 0) + dt;
        if (this.secT >= 1) { this.secT = 0; this.everySecond(); }
        this.offerT -= dt;
        if (this.offerT <= 0) { this.offerT = typeof ADS_OFFER_SEC !== 'undefined' ? ADS_OFFER_SEC : 45; this.showOffer(); }
    },

    updatePlots(dt) {
        GameWorld.updateNpcs(dt);
        const camPos = /** @type {LoryApp} */ (this.app).location.view.camera.position;
        for (const p of GameWorld.plots) p.update(dt, camPos);
    },

    syncCam(dt) {
        const h = this.hero;
        if (!h) return;
        this.cam.x = h.x; this.cam.y = h.y; this.cam.h = h.h + 120;
        this.cam.frameHeight = this.state === 'pull' ? 760 : 900;
        const cam = /** @type {LoryApp} */ (this.app).camera;
        if (cam.c && cam.c.followLerp !== 0.14) cam.c.followLerp += (0.14 - cam.c.followLerp) * Math.min(1, (dt || 0) * 4);
    },

    stepHero(dt) {
        const app = /** @type {LoryApp} */ (this.app), cam = app.camera, h = /** @type {Walker} */ (this.hero);
        const m = GameUI.open_ && GameUI.open_ !== 'animals' ? { x: 0, y: 0 } : Input.move();
        const fx = Math.cos(cam.azimuth), fz = Math.sin(cam.azimuth);
        const dx = fx * m.y - fz * m.x, dy = fz * m.y + fx * m.x;
        const jump = Input.pressed('jump');
        const wasG = h.grounded;
        h.step(dt, dx, dy, typeof HERO_WALK_SPEED !== 'undefined' ? HERO_WALK_SPEED : 560, jump);
        if (jump && wasG && !h.grounded) sfx('jump', { volume: 0.4 });
        if (h.landed) { h.landed = false; }
        // шаги
        if (h.moving && h.grounded && this.time - this.lastStep > 0.32) { this.lastStep = this.time; sfx(['step1', 'step2', 'step3'], { volume: 0.25 }); }
        this.avatar.place(h.x, h.y, h.h, h.heading);
        this.avatar.play(!h.grounded ? (h.vh > 0 ? 'jump' : 'fall') : h.moving ? 'run' : 'idle');
        if (Input.pressed('interact')) this.interact();
        this.checkZones();
    },

    /** Что рядом: турник, площадка, табличка, лавки, полоса броска, загон. */
    checkZones() {
        const h = /** @type {Walker} */ (this.hero), s = this.save, plot = GameWorld.plots[0];
        const d = (p) => (p ? Math.hypot(p.x - h.x, p.y - h.y) : 1e9);
        let near = null;
        // полоса броска
        if (GameWorld.onThrowLine(h.x, h.y) && this.throwCool <= 0 && !GameUI.open_) {
            PlayerThrow.start(this);
            this.hero.place(h.x, h.y, GameWorld.lane.heading);
            return;
        }
        if (plot.bar && d(plot.bar) < 170) near = { kind: 'bar' };
        else if (plot.pad && d(plot.pad) < 110 && s.bar + 1 < GAME_DATA.BARS.length && s.bar >= 0) near = { kind: 'pad' };
        else if (plot.cap && d(plot.cap) < 190 && s.cap + 1 < GAME_DATA.PLOT_CAPACITY.length) near = { kind: 'cap' };
        else if (GameWorld.shopSell && d(GameWorld.shopSell) < GameWorld.shopSell.sx) near = { kind: 'sell' };
        else if (GameWorld.shopFood && d(GameWorld.shopFood) < GameWorld.shopFood.sx) near = { kind: 'food' };
        // лавка еды открывается сама при входе в круг
        const inFood = !!near && near.kind === 'food';
        if (inFood && !this.inFood && !GameUI.open_) GameUI.openWin('food');
        this.inFood = inFood;
        // загон: выпустить животных из рюкзака
        const inPlot = plot.contains(h.x, h.y, 60);
        if (inPlot && !this.inPlot && s.backpack.length) this.autoPlace();
        this.inPlot = inPlot;
        this.near = near;
        this.showPrompt();
    },

    showPrompt() {
        const n = this.near, s = this.save;
        if (!n || this.state !== 'play') { GameUI.prompt('', ''); Input.clearContext('act'); return; }
        let t1 = '', t2 = '';
        if (n.kind === 'bar') {
            if (s.bar < 0) { const b = Econ.bar(0); t1 = Lang.code === 'ru' ? b.ru : b.en; t2 = Lang.t('ui.buyFor', { p: Econ.money(b.price) }); }
            else { t1 = Lang.code === 'ru' ? Econ.bar(s.bar).ru : Econ.bar(s.bar).en; t2 = Lang.t('ui.pullUp'); }
        } else if (n.kind === 'pad') { const b = Econ.bar(s.bar + 1); t1 = Lang.t('ui.upgradeTo', { name: Lang.code === 'ru' ? b.ru : b.en }); t2 = Econ.money(b.price); }
        else if (n.kind === 'cap') { const c = Econ.capacity(s.cap), nx = Econ.capacity(s.cap + 1); t1 = Lang.t('ui.plotSlots', { a: c.slots, b: nx.slots }); t2 = Econ.money(nx.price); }
        else if (n.kind === 'sell') { const v = s.backpack.reduce((a, x) => a + Econ.sellPrice(x.id, x.muts), 0); t1 = Lang.t('ui.sellStall'); t2 = s.backpack.length ? Lang.t('ui.sellAll', { p: Econ.money(v) }) : Lang.t('ui.myAnimals'); }
        else if (n.kind === 'food') { t1 = Lang.t('ui.foodShop'); t2 = Lang.t('ui.open'); }
        const adKey = n.kind === 'pad' ? 'bar:' + s.bar : n.kind === 'cap' ? 'cap:' + s.cap : n.kind === 'sell' && s.backpack.length ? 'sell_x2' : '';
        GameUI.prompt(t1, t2, null, adKey, n.kind === 'sell' ? 'x2' : '');
        Input.setContext({ id: 'act', label: t2, icon: GameAssets.img('icon', 'hand') }, 1);
    },

    interact() {
        const n = this.near, s = this.save;
        if (PlayerThrow.active()) { PlayerThrow.tap(); return; }
        if (!n || this.state !== 'play') return;
        if (n.kind === 'bar') { if (s.bar < 0) this.buyBar(); else this.startPull(); }
        else if (n.kind === 'pad') this.buyBar();
        else if (n.kind === 'cap') this.buyCap();
        else if (n.kind === 'sell') { if (s.backpack.length) this.sellBackpack(); else GameUI.openWin('animals'); }
        else if (n.kind === 'food') GameUI.openWin('food');
    },

    // ---------------------------------------------------------------------------------------------
    // Подтягивания
    // ---------------------------------------------------------------------------------------------
    startPull() {
        const b = GameWorld.plots[0].bar;
        if (!b || this.save.bar < 0) return;
        this.state = 'pull';
        this.repT = 0;
        this.hero.place(b.x, b.y, b.heading);
        this.avatar.place(b.x, b.y, this.hero.h, b.heading);
        this.avatar.play('hang', { fade: 0.2 });
        GameUI.pull(true);
        GameUI.prompt('', '');
        Input.clearContext('act');
        Input.setContext({ id: 'stop', label: Lang.t('ui.stop'), icon: GameAssets.img('icon', 'close') }, 2);
        this.updateLevelBar();
    },
    stopPull() {
        if (this.state !== 'pull') return;
        this.state = 'play';
        GameUI.pull(false);
        Input.clearContext('stop');
        const b = GameWorld.plots[0].bar;
        if (b) { const bx = b.x - Math.cos(b.heading) * 150, by = b.y - Math.sin(b.heading) * 150; this.hero.place(bx, by, b.heading + Math.PI); }
        this.avatar.play('idle');
        this.near = null;
    },
    stepPull(dt) {
        const m = Input.move();
        if (Input.pressed('interact') || Input.pressed('jump') || Math.hypot(m.x, m.y) > 0.6) { this.stopPull(); return; }
        this.repT += dt;
        if (this.repT > 0.3) this.avatar.play('pullup');
        const rs = (typeof REP_SECONDS !== 'undefined' ? REP_SECONDS : 1.05) / GameAds.mult('speed');
        if (this.repT >= 0.3 + rs) { this.repT = 0.3; this.rep(); }
    },
    rep() {
        const s = this.save, gain = Econ.bar(s.bar).xp * this.xpMult();
        const r = Econ.addXp(s.level, s.xp, gain);
        s.level = r.level; s.xp = r.xp;
        sfx(['rep1', 'rep2', 'rep3'], { volume: 0.35 });
        const b = GameWorld.plots[0].bar;
        if (b && this.labels) this.labels.float(b.x, b.y, 300, Lang.t('ui.xpPlus', { n: Econ.short(gain) }), 'xp', 0.9);
        if (r.ups > 0) {
            s.gems += r.ups;
            GameUI.levelUp(r.ups, Econ.cfg().levelPower * r.ups);
            sfx('levelup', { volume: 0.6 });
            try { const v = this.avatar.node.position; /** @type {LoryApp} */ (this.app).fx.play('magic', new BABYLON.Vector3(v.x, v.y + 200, v.z), { color: '#ffe23a' }); } catch (e) { /* */ }
            Tutorial.complete('levelup');
        }
        this.updateLevelBar();
        this.updateStats();
    },
    updateLevelBar() { GameUI.level(this.save.level, this.save.xp, Econ.xpNeed(this.save.level)); },

    // ---------------------------------------------------------------------------------------------
    // После броска
    // ---------------------------------------------------------------------------------------------
    afterThrow(r) {
        this.state = 'play';
        const s = this.save, info = Econ.animal(r.id);
        const isNew = !s.index[r.id];
        s.index[r.id] = (s.index[r.id] || 0) + 1;
        s.throws++;
        if (isNew && info) { const g = [5, 8, 12, 20, 35, 60, 120][info.rIndex] || 5; s.gems += g; GameUI.toast(Lang.t('ui.newSpecies', { n: g }), 'blue'); }
        if (r.zone > s.bestZone) { s.bestZone = r.zone; GameUI.toast(Lang.t('ui.newZone', { zone: this.zoneName(r.zone) }), ''); s.gems += 25; }
        const inc = Econ.income(r.id, r.muts);
        if (!s.best || inc > s.best.income) s.best = { id: r.id, muts: r.muts, income: inc };
        const a = { uid: r.uid, id: r.id, muts: r.muts };
        s.backpack.push(a);
        if (r.double) { s.backpack.push({ uid: ANIMAL_UID++, id: r.id, muts: r.muts.slice() }); s.index[r.id]++; }
        // вернуть героя чуть назад от полосы
        const L = GameWorld.lane;
        this.hero.place(L.throwX - L.fx * 330 + (this.hero.x - L.throwX) * 0.5, L.throwY - L.fy * 330 + (this.hero.y - L.throwY) * 0.5, L.heading + Math.PI);
        this.avatar.play('cheer');
        this.throwCool = 1.2;
        this.syncFollowers(true);
        const app = /** @type {LoryApp} */ (this.app);
        app.camera.azimuth = L.heading + Math.PI;
        app.camera.pitch = 0.42;
        this.syncCam(0);
        app.camera.snap();
        this.persist();
        this.updateStats();
        GameUI.dot('animals', s.backpack.length);
        setTimeout(() => { if (this.state === 'play' && !this.hero.moving) this.avatar.play('idle'); }, 1400);
    },

    zoneName(z) { const Z = GAME_DATA.ZONES[z]; return Z ? (Lang.code === 'ru' ? Z.ru : Z.en) : ''; },

    // ---------------------------------------------------------------------------------------------
    // Животные: рюкзак, загон, продажа
    // ---------------------------------------------------------------------------------------------
    syncFollowers(poof) {
        const view = /** @type {LoryApp} */ (this.app).location.view;
        const show = this.save.backpack.slice(-3);
        const keep = new Set(show.map(a => a.uid));
        for (const [uid, act] of this.followers) if (!keep.has(uid)) { act.dispose(); this.followers.delete(uid); }
        show.forEach((a, i) => {
            let act = this.followers.get(a.uid);
            if (!act) {
                act = new AnimalActor(view, a, this.labels);
                const h = /** @type {Walker} */ (this.hero);
                act.place(h.x - Math.cos(h.heading) * 200, h.y - Math.sin(h.heading) * 200, h.heading);
                this.followers.set(a.uid, act);
                if (poof) { try { /** @type {LoryApp} */ (this.app).fx.play('magic', new BABYLON.Vector3(act.x, 60, act.y)); } catch (e) { /* */ } }
            }
            act.follow(this.hero, i);
        });
        GameUI.hotbar(this.save.backpack);
    },
    updateFollowers(dt) {
        const camPos = /** @type {LoryApp} */ (this.app).location.view.camera.position;
        for (const a of this.followers.values()) a.update(dt, camPos);
    },

    autoPlace() {
        const s = this.save, cap = Econ.capacity(s.cap).slots;
        if (s.plot.length >= cap) { GameUI.toast(Lang.t('ui.plotFull'), 'red'); return; }
        let n = 0;
        s.backpack.sort((a, b) => Econ.income(b.id, b.muts) - Econ.income(a.id, a.muts));
        while (s.backpack.length && s.plot.length < cap) { s.plot.push(/** @type {any} */ (s.backpack.shift())); n++; }
        if (n) {
            this.afterAnimalsChanged();
            GameUI.toast(Lang.t('ui.placed', { n }), '');
            sfx('pop', { volume: 0.6 });
            Tutorial.complete('place');
        }
    },
    afterAnimalsChanged() {
        const s = this.save;
        s.plot.sort((a, b) => Econ.income(b.id, b.muts) - Econ.income(a.id, a.muts));
        GameWorld.plots[0].syncAnimals(s.plot, 99);
        this.syncFollowers();
        GameUI.dot('animals', s.backpack.length);
        GameUI.refresh();
        this.persist();
        this.updateStats();
    },
    findAnimal(uid) {
        const s = this.save;
        let i = s.plot.findIndex(a => a.uid === uid);
        if (i >= 0) return { list: s.plot, i };
        i = s.backpack.findIndex(a => a.uid === uid);
        if (i >= 0) return { list: s.backpack, i };
        return null;
    },
    pickUp(uid) { const f = this.findAnimal(uid); if (!f || f.list !== this.save.plot) return; this.save.backpack.push(f.list.splice(f.i, 1)[0]); this.afterAnimalsChanged(); },
    placeOne(uid) {
        const s = this.save, f = this.findAnimal(uid);
        if (!f || f.list !== s.backpack) return;
        if (s.plot.length >= Econ.capacity(s.cap).slots) { GameUI.toast(Lang.t('ui.plotFull'), 'red'); sfx('error', { volume: 0.5 }); return; }
        s.plot.push(f.list.splice(f.i, 1)[0]);
        this.afterAnimalsChanged();
        Tutorial.complete('place');
    },
    sellOne(uid) {
        const f = this.findAnimal(uid);
        if (!f) return;
        const a = f.list.splice(f.i, 1)[0];
        const p = Econ.sellPrice(a.id, a.muts);
        this.save.money += p;
        sfx('sell', { volume: 0.6 });
        GameUI.toast(Lang.t('ui.sold', { p: Econ.money(p) }), '');
        this.afterAnimalsChanged();
    },
    sellBackpack(mult) {
        const s = this.save;
        if (!s.backpack.length) return;
        const p = s.backpack.reduce((a, x) => a + Econ.sellPrice(x.id, x.muts), 0) * (mult || 1);
        s.backpack = [];
        s.money += p;
        sfx('sell', { volume: 0.7 });
        if (this.labels && GameWorld.shopSell) this.labels.float(GameWorld.shopSell.x, GameWorld.shopSell.y, 260, '+' + Econ.money(p), 'money', 1.3);
        GameUI.toast(Lang.t('ui.sold', { p: Econ.money(p) }), '');
        this.afterAnimalsChanged();
    },
    equipBest() {
        const s = this.save, cap = Econ.capacity(s.cap).slots;
        const all = s.plot.concat(s.backpack).sort((a, b) => Econ.income(b.id, b.muts) - Econ.income(a.id, a.muts));
        const before = s.plot.map(a => a.uid).join(',');
        s.plot = all.slice(0, cap); s.backpack = all.slice(cap);
        if (s.plot.map(a => a.uid).join(',') === before) GameUI.toast(Lang.t('ui.alreadyBest'), 'blue');
        this.afterAnimalsChanged();
    },

    // ---------------------------------------------------------------------------------------------
    // Покупки
    // ---------------------------------------------------------------------------------------------
    spend(price) {
        if (this.save.money < price) { GameUI.toast(Lang.t('ui.noMoney'), 'red'); sfx('error', { volume: 0.5 }); return false; }
        this.save.money -= price;
        sfx('buy', { volume: 0.6 });
        return true;
    },
    buyBar() {
        const s = this.save, next = s.bar + 1;
        if (next >= GAME_DATA.BARS.length) return;
        const b = Econ.bar(next);
        if (!this.spend(b.price)) return;
        s.bar = next;
        GameWorld.plots[0].setBar(next);
        GameUI.toast(Lang.t('ui.upgradedTo', { name: Lang.code === 'ru' ? b.ru : b.en }), '');
        GameUI.newBar(null);
        const p = GameWorld.plots[0].bar;
        try { if (p) /** @type {LoryApp} */ (this.app).fx.play('magic', new BABYLON.Vector3(p.x, 200, p.y), { color: '#ffe23a' }); } catch (e) { /* */ }
        Tutorial.complete('bar');
        this.persist(); this.updateStats();
    },
    buyCap() {
        const s = this.save, n = s.cap + 1;
        if (n >= GAME_DATA.PLOT_CAPACITY.length) return;
        if (!this.spend(Econ.capacity(n).price)) return;
        s.cap = n;
        GameUI.toast(Lang.t('ui.plotUpgraded', { n: Econ.capacity(n).slots }), '');
        this.updateSign();
        if (s.backpack.length) this.autoPlace();
        this.persist(); this.updateStats();
    },
    buyFood(id) {
        const f = Econ.food(id), s = this.save;
        if (!f || s.foods[id]) return;
        if (!this.spend(f.price)) return;
        s.foods[id] = true; s.food = id;
        GameUI.toast(Lang.t('ui.bought', { name: Lang.code === 'ru' ? f.ru : f.en }), '');
        Tutorial.complete('food');
        this.persist(); this.updateStats(); GameUI.renderFood();
    },
    buyBoost(id) {
        const b = this.boostDefs().find(x => x.id === id), s = this.save;
        if (!b || s.boosts[id] || s.gems < b.gems) return;
        s.gems -= b.gems; s.boosts[id] = true;
        sfx('buy', { volume: 0.7 });
        GameUI.toast(Lang.t(b.title), 'blue');
        this.persist(); GameUI.renderShop(); this.updateStats();
    },
    claimFree() {
        const s = this.save;
        if (s.freeAnimal) return;
        s.freeAnimal = true;
        s.backpack.push({ uid: ANIMAL_UID++, id: 'hyena', muts: ['big'] });
        s.index.hyena = (s.index.hyena || 0) + 1;
        sfx('reveal', { volume: 0.7 });
        GameUI.toast(Lang.t('ui.freeClaimed'), '');
        this.syncFollowers(true);
        this.persist(); GameUI.renderShop();
    },
    buySkin(id) {
        const it = SKIN_ITEMS.find(x => x.id === id), s = this.save;
        if (!it || s.owned[id]) return;
        if (s.gems < it.gems) { GameUI.toast(Lang.t('ui.noGems'), 'red'); sfx('error', { volume: 0.5 }); return; }
        s.gems -= it.gems; s.owned[id] = true;
        sfx('buy', { volume: 0.7 });
        this.equipSkin(id);
    },
    equipSkin(id) {
        const it = SKIN_ITEMS.find(x => x.id === id), s = this.save;
        if (!it || !(s.owned[id] || it.default)) return;
        const slot = it.tab === 'mythic' ? 'outfit' : it.tab;
        s.equip[slot] = id;
        this.avatar.setLook({ skin: s.equip.outfit, hat: s.equip.hat, back: s.equip.back });
        this.persist(); GameUI.renderShop();
    },
    unequipSkin(id) {
        const it = SKIN_ITEMS.find(x => x.id === id), s = this.save;
        if (!it || it.tab === 'outfit' || it.tab === 'mythic') return;
        s.equip[it.tab] = '';
        this.avatar.setLook({ skin: s.equip.outfit, hat: s.equip.hat, back: s.equip.back });
        this.persist(); GameUI.renderShop();
    },

    // ---------------------------------------------------------------------------------------------
    // HUD, подсказки, табло
    // ---------------------------------------------------------------------------------------------
    updateStats() {
        GameUI.stats(this.power(), this.save.money);
        GameUI.gems(this.save.gems);
        // новый турник по карману — всплывашка
        const s = this.save, nb = s.bar + 1;
        if (s.bar >= 0 && nb < GAME_DATA.BARS.length && s.money >= Econ.bar(nb).price && this._newBarShown !== nb && this.state === 'play') {
            this._newBarShown = nb;
            const b = Econ.bar(nb);
            GameUI.newBar(b, b.price, b.xp);
        }
        this.updateBarLabel();
    },
    updateBarLabel() {
        const plot = GameWorld.plots[0], s = this.save;
        if (!plot || !plot.bar || !this.labels) return;
        const nb = s.bar + 1;
        if (nb >= GAME_DATA.BARS.length) { this.labels.remove('barprice'); return; }
        const b = Econ.bar(nb);
        this.labels.set('barprice', `${Econ.money(b.price)}<div class="sub">${Lang.t('ui.xpRep', { n: b.xp })}</div>`, 'price', 4000);
        const p = s.bar < 0 ? plot.bar : (plot.pad || plot.bar);
        this.labels.pos('barprice', p.x, p.y, s.bar < 0 ? 340 : 170);
    },
    updateSign() {
        const plot = GameWorld.plots[0], s = this.save;
        const c = Econ.capacity(s.cap), n = s.cap + 1 < GAME_DATA.PLOT_CAPACITY.length ? Econ.capacity(s.cap + 1) : null;
        if (n) plot.setSign(c.slots + ' ▸ ' + n.slots, '▲ ' + Econ.money(n.price), '#8dff6a', 'big');
        else plot.setSign(String(c.slots), Lang.t('ui.maxSlots'), '#ffe14a', 'big');
    },
    updateHint() {
        const s = this.save;
        if (this.state === 'menu') return;
        let text = '', target = null;
        if (Tutorial.active) {
            const st = this.tutSteps ? this.tutSteps.find(x => x.id === Tutorial.step) : null;
            if (st && st.world) target = st.world();
            GameUI.hint('');
            GameWorld.guide(this.state === 'play' ? target : null);
            return;
        }
        if (this.state === 'pull') { text = ''; }
        else if (this.state === 'play') {
            const cap = Econ.capacity(s.cap).slots, nb = s.bar + 1, nf = GAME_DATA.FOODS[Econ.foodIndex(s.food) + 1];
            const nextFood = GAME_DATA.FOODS.find(f => !s.foods[f.id]);
            if (s.backpack.length && s.plot.length < cap) { text = Lang.t('ui.h.place'); target = this.plotGate(); }
            else if (s.bar < 0) { text = Lang.t('ui.h.bar'); target = this.barPoint(); }
            else if (nb < GAME_DATA.BARS.length && s.money >= Econ.bar(nb).price) { text = Lang.t('ui.h.upgrade'); target = this.padPoint(); }
            else if (nextFood && s.money >= nextFood.price) { text = Lang.t('ui.h.food'); target = this.shopPoint(); }
            else if (s.backpack.length && s.plot.length >= cap) { text = Lang.t('ui.h.sell'); target = GameWorld.shopSell ? { x: GameWorld.shopSell.x, y: GameWorld.shopSell.y, h: 0 } : null; }
            else { text = Lang.t('ui.h.throw'); target = { x: GameWorld.lane.throwX, y: GameWorld.lane.throwY, h: 0 }; }
            void nf;
            // рядом с целью стрелки не нужны
            if (target && Math.hypot(target.x - this.hero.x, target.y - this.hero.y) < 260) target = null;
        }
        GameUI.hint(text);
        GameWorld.guide(target);
    },
    // ---------------------------------------------------------------------------------------------
    // Реклама: предложения, подарок дня, колесо
    // ---------------------------------------------------------------------------------------------
    /** Кнопка «За рекламу»: просмотр -> при наборе всех просмотров выдать награду. */
    async adOffer(key) {
        const done = await GameAds.watch(key);
        GameUI.refresh();
        if (!done) return;
        const s = this.save;
        const [kind, arg] = key.split(':');
        sfx('reveal', { volume: 0.6 });
        if (GameAds.BOOST_KEYS[key]) {
            GameAds.addBoost(GameAds.BOOST_KEYS[key], typeof ADS_BOOST_MIN !== 'undefined' ? ADS_BOOST_MIN : 5);
            GameUI.toast(Lang.t('ads.boostOn', { name: Lang.t(GameUI.OFFER_INFO[key][0], GameUI.offerVars()) }), 'blue');
        } else if (key === 'free_cash') {
            const v = this.cashGift(typeof ADS_CASH_MIN !== 'undefined' ? ADS_CASH_MIN : 5);
            s.money += v; GameUI.toast('+' + Econ.money(v), '');
            if (this.labels) this.labels.float(this.hero.x, this.hero.y, 260, '+' + Econ.money(v), 'money', 1.4);
        } else if (key === 'free_gems') {
            GameAds.gemsLeft(); s.adDay.gems++;
            s.gems += typeof ADS_GEMS !== 'undefined' ? ADS_GEMS : 40;
            GameUI.toast(Lang.t('ui.gemsGot', { n: typeof ADS_GEMS !== 'undefined' ? ADS_GEMS : 40 }), 'blue');
        } else if (key === 'super_throw') {
            s.superThrow = true; GameUI.toast(Lang.t('ads.superOn'), '');
            if (PlayerThrow.state === 'aim') { PlayerThrow.power *= 2; GameUI.meter(true); }
        } else if (key === 'levels') {
            const r = Econ.addXp(s.level, s.xp, 0); void r;
            s.level += 3; s.gems += 3;
            GameUI.levelUp(3, Econ.cfg().levelPower * 3);
            this.updateLevelBar();
            sfx('levelup', { volume: 0.6 });
        } else if (key === 'mystery') this.giveMystery();
        else if (key === 'sell_x2') this.sellBackpack(2);
        else if (key === 'gold_catch' && PlayerThrow.result) {
            const r = PlayerThrow.result;
            r.muts = r.muts.filter(m => m === 'big').concat(['gold']); r.gold = true;
            if (PlayerThrow.animal) { PlayerThrow.animal.dispose(); PlayerThrow.animal = null; PlayerThrow.respawnAnimal(); }
            PlayerThrow.showCard();
        } else if (key === 'double_catch' && PlayerThrow.result) {
            PlayerThrow.result.double = true;
            PlayerThrow.showCard();
        } else if (kind === 'food') {
            s.foods[arg] = true; s.food = arg;
            Tutorial.complete('food');
            const f = Econ.food(arg); GameUI.toast(Lang.t('ui.bought', { name: f ? (Lang.code === 'ru' ? f.ru : f.en) : arg }), '');
        } else if (kind === 'bar') {
            if (+arg === s.bar && s.bar + 1 < GAME_DATA.BARS.length) {
                s.bar++; GameWorld.plots[0].setBar(s.bar);
                const b = Econ.bar(s.bar); GameUI.toast(Lang.t('ui.upgradedTo', { name: Lang.code === 'ru' ? b.ru : b.en }), '');
                GameUI.newBar(null); Tutorial.complete('bar');
            }
        } else if (kind === 'cap') {
            if (+arg === s.cap && s.cap + 1 < GAME_DATA.PLOT_CAPACITY.length) {
                s.cap++; this.updateSign(); GameUI.toast(Lang.t('ui.plotUpgraded', { n: Econ.capacity(s.cap).slots }), '');
                if (s.backpack.length) this.autoPlace();
            }
        } else if (kind === 'skin') {
            s.owned[arg] = true; this.equipSkin(arg);
        }
        this.persist(); this.updateStats(); GameUI.refresh(); this.showPrompt();
    },

    /** Только сборка Playables: межстраничная реклама после клика по кнопке интерфейса (просьба пользователя).
     *  Не во время игрового действия (бросок, подтягивания) и не во время / сразу после rewarded; кнопки «за рекламу» не считаются.
     *  Показывать ли ролик и как часто, решает SDK Playables (requestInterstitialAd), игра идёт дальше без него. */
    uiInterstitial(a) {
        if (typeof GAME_PLATFORM === 'undefined' || String(GAME_PLATFORM) !== 'playables' || Platform.name !== 'playables') return;
        if (/^(ad|dailyX2|wheelAd|throwTap|continue|stop|prompt)$/.test(a)) return;
        if (PlayerThrow.active() || this.state === 'pull' || this.state === 'throw') return;
        if (GameAds.busy || Platform.adActive || GameUI._spinning) return;
        if (Date.now() - (this._lastRewardAt || 0) < 4000) return;
        if (typeof Platform.interstitialSupported === 'function' && !Platform.interstitialSupported()) return;
        Platform.interstitial().catch(() => { /* нет рекламы — игра идёт дальше */ });
    },

    afterReward() { this.updateStats(); this.syncFollowers(); GameUI.refresh(); this.persist(); },

    /** Зверь из следующей (ещё не открытой) зоны с удачей x3. */
    giveMystery() {
        const s = this.save, zone = Math.min(Econ.zoneCount() - 1, (s.bestZone | 0) + 1);
        const id = Econ.rollAnimal(zone, 3, Math.random), muts = Econ.rollMutations(3, Math.random);
        const isNew = !s.index[id];
        s.index[id] = (s.index[id] || 0) + 1;
        s.backpack.push({ uid: ANIMAL_UID++, id, muts });
        const info = Econ.animal(id);
        GameUI.toast(Lang.t('ads.mysteryGot', { name: info ? (Lang.code === 'ru' ? info.ru : info.en) : id }) + (isNew ? ' — ' + Lang.t('ui.new') : ''), 'blue');
        this.syncFollowers(true);
        this.persist();
    },

    async spinWheel(ad) {
        if (GameUI._spinning) return;
        const r = ad ? await Wheel.spinAd() : Wheel.spinFree();
        if (!r || !r.ok) { GameUI.renderWheel(); if (r && r.reason === 'cooldown') GameUI.toast(Lang.t('ads.in', { n: GameAds.cooldown() }), 'blue'); return; }
        const target = typeof Wheel.angleFrom === 'function' ? Wheel.angleFrom(GameUI._wheelAngle, r) : r.angle;
        GameUI.spinWheel(target, r.durationMs || 5500, () => {
            Wheel.finish();
            sfx('reveal', { volume: 0.7 });
            this.afterReward();
            GameUI.wheelWin(r.sector != null ? (typeof r.sector === 'number' ? r.sector : r.sector.index) : 0);
        });
    },

    /** Раз в секунду: таймеры бустов, точки на кнопках подарка и колеса. */
    everySecond() {
        const list = [];
        const add = (k, icon, text) => { const left = GameAds.boostLeft(k); if (left > 0) list.push({ icon, text, left }); };
        add('cash', 'cash', 'x2'); add('xp', 'power', 'x2'); add('luck', 'luck', 'x2'); add('speed', 'shoe', 'x2');
        GameUI.boosts(list);
        try { GameUI.dot('daily', DailyGift.status().canClaim ? 1 : 0); } catch (e) { /* */ }
        try { GameUI.dot('wheel', Wheel.status().canSpinFree ? 1 : 0); } catch (e) { /* */ }
        if (this._wasIncome !== Math.round(this.income())) { this._wasIncome = Math.round(this.income()); }
        // подарок дня — после обучения, один раз за вход
        if (!this._dailyOffered && this.state === 'play' && !Tutorial.active && !GameUI.open_ && DailyGift.shouldOffer()) {
            this._dailyOffered = true; DailyGift.markOffered(); GameUI.openWin('daily');
        }
    },

    /** Карточка предложения сбоку — по кругу, пропуская активные бусты. */
    showOffer() {
        if (this.state !== 'play' || Tutorial.active || GameUI.open_ || !GameAds.available()) { GameUI.offerCard(null); return; }
        const order = ['free_cash', 'boost_cash', 'boost_luck', 'mystery', 'boost_xp', 'free_gems', 'boost_speed', 'super_throw'];
        for (let i = 0; i < order.length; i++) {
            const k = order[(this.offerI + i) % order.length], bk = GameAds.BOOST_KEYS[k];
            if (bk && GameAds.boostLeft(bk) > 0) continue;
            if (k === 'free_gems' && GameAds.gemsLeft() <= 0) continue;
            if (k === 'super_throw' && this.save.superThrow) continue;
            this.offerI = (this.offerI + i + 1) % order.length;
            GameUI.offerCard(k);
            return;
        }
    },

    drawBoards() {
        const s = this.save;
        const me = { name: Lang.t('ui.you'), power: this.power(), income: this.income(), best: s.best ? s.best.income : 0, me: true };
        const all = GameBots.bots.map(b => ({ name: b.name, power: b.power(), income: b.income(), best: b.best, me: false })).concat([me]);
        const rows = (key, fmt) => all.slice().sort((a, b) => b[key] - a[key]).map(r => ({ name: r.name, value: fmt(r[key]), me: r.me }));
        GameWorld.drawBoard('power', Lang.t('ui.topPower'), rows('power', Econ.short.bind(Econ)), '#2a8ae0');
        GameWorld.drawBoard('money', Lang.t('ui.topMoney'), rows('income', (v) => perSec(v)), '#22b13a');
        GameWorld.drawBoard('luck', Lang.t('ui.luckiest'), rows('best', (v) => perSec(v)), '#b45cff');
    },
};
