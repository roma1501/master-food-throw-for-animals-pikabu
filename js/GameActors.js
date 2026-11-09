// GameActors.js — персонажи и животные в сцене.
//   Avatar      — вид персонажа: скин-риг (assets/models/skins/<id>.glb) + клипы skin_clips.glb, шапка на кости Hat,
//                 предмет на спине на кости Back, еда в руке Hand_R. Пока скин грузится — простая блочная фигурка.
//   Walker      — положение и движение по карте (Nav: стены, заборы, высота), прыжок, курс. Логика — числа, не Babylon.
//   AnimalActor — животное: риг + клипы архетипа, мутации (размер, золото, алмаз, радуга), бродит по загону,
//                 идёт за хозяином, подходит к еде. Подпись «Имя $N/s» — GameLabels.
// Координаты — карта: x вправо, y вниз по карте, h — высота (px). Babylon: (x, h, y).

/** @satisfies {Record<string, any>} */
const GameModels = {
    /** @type {Map<string, Promise<any>>} */
    _cache: new Map(),
    /** Загрузить модель (кэш промисов; ошибка -> null, сцена не падает). */
    load(url) {
        if (!url) return Promise.resolve(null);
        let p = this._cache.get(url);
        if (!p) {
            p = Rig.load(url).catch((e) => { console.warn('Модель не загрузилась:', url, e && e.message); return null; });
            this._cache.set(url, p);
        }
        return p;
    },
    /** Статичная модель (еда, шапка, реквизит) -> корень меша или null. */
    async build(url, view, name, kind) {
        const model = await this.load(url);
        if (!model || !view || !view.scene || view.scene.isDisposed) return null;
        const root = Model3D.build(model, view.scene, { name: name || 'obj' });
        World3D.addObject(view, root, kind || 'prop');
        return root;
    },
    /** Перекраска мешей в тон мутации. Материалы клонируются один раз на (материал, тон). */
    /** @type {Map<string, any>} */
    _tints: new Map(),
    /** @type {any[]} */
    _rainbow: [],
    tint(meshes, tint) {
        if (!tint) return;
        for (const m of meshes) {
            const mat = m.material;
            if (!mat) continue;
            const key = mat.uniqueId + '|' + tint;
            let t = this._tints.get(key);
            if (!t) {
                t = mat.clone(mat.name + '-' + tint);
                const subs = t.subMaterials ? t.subMaterials : [t];
                if (t.subMaterials) t.subMaterials = subs.map((s) => (s ? s.clone(s.name + '-' + tint) : s));
                for (const s of (t.subMaterials || [t])) {
                    if (!s || !s.diffuseColor) continue;
                    if (tint === 'rainbow') { this._rainbow.push(s); continue; }
                    const c = BABYLON.Color3.FromHexString(tint);
                    s.diffuseColor = new BABYLON.Color3(Math.min(1.4, c.r * 1.25), Math.min(1.4, c.g * 1.25), Math.min(1.4, c.b * 1.25));
                    s.emissiveColor = new BABYLON.Color3(c.r * 0.22, c.g * 0.22, c.b * 0.22);
                    s.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
                }
                this._tints.set(key, t);
            }
            m.material = t;
        }
    },
    /** Радужные материалы переливаются (раз в кадр). */
    updateRainbow(time) {
        if (!this._rainbow.length) return;
        const c = BABYLON.Color3.FromHSV((time * 90) % 360, 0.65, 1);
        for (const s of this._rainbow) {
            s.diffuseColor.copyFromFloats(c.r * 1.2, c.g * 1.2, c.b * 1.2);
            if (s.emissiveColor) s.emissiveColor.copyFromFloats(c.r * 0.25, c.g * 0.25, c.b * 0.25);
        }
    },
};

// ------------------------------------------------------------------------------------------------
// Avatar — вид персонажа
// ------------------------------------------------------------------------------------------------
class Avatar {
    /** @param {any} view View3D @param {{ skin?: string, hat?: string, back?: string, name?: string }} [look] */
    constructor(view, look) {
        this.view = view;
        this.node = new BABYLON.TransformNode('avatar', view.scene);
        /** @type {any} */ this.rig = null;
        /** @type {any} */ this.hat = null;
        /** @type {any} */ this.back = null;
        /** @type {any} */ this.held = null;
        this.look = { skin: '', hat: '', back: '' };
        this.clip = '';
        this.clipOpts = null;
        this._holdId = '';
        this._token = 0;
        this.fallback = this._makeFallback();
        this.visible = true;
        if (look) this.setLook(look);
    }

    _makeFallback() {
        const s = this.view.scene, root = new BABYLON.TransformNode('avatar-fb', s);
        const mat = new BABYLON.StandardMaterial('avatar-fb-m', s);
        mat.diffuseColor = new BABYLON.Color3(0.95, 0.8, 0.6);
        const body = BABYLON.MeshBuilder.CreateBox('fb-body', { width: 60, height: 110, depth: 40 }, s);
        body.position.y = 100; body.material = mat; body.parent = root;
        const head = BABYLON.MeshBuilder.CreateBox('fb-head', { size: 46 }, s);
        head.position.y = 180; head.material = mat; head.parent = root;
        root.parent = this.node;
        for (const m of root.getChildMeshes()) { World3D.addObject(this.view, m, 'actor'); m.isPickable = false; }
        return root;
    }

    async setLook(look) {
        const lk = Object.assign({}, this.look, look || {});
        const token = ++this._token;
        if (lk.skin !== this.look.skin || !this.rig) {
            const url = GameAssets.path('skin', lk.skin || 'outfit_classic') || GameAssets.path('skin', 'outfit_classic');
            const [model, lib] = await Promise.all([GameModels.load(url), GameModels.load(GameAssets.path('skin', 'skin_clips'))]);
            if (token !== this._token || !this.node || this.node.isDisposed()) return;
            if (model) {
                const old = this.rig;
                const rig = Rig.create(model, this.view, { name: 'skin', kind: 'actor', clips: lib ? [lib] : [] });
                rig.root.parent = this.node;
                this.rig = rig;
                if (old) { this._detachAll(old); old.dispose(); }
                if (this.fallback) { this.fallback.dispose(false, true); this.fallback = null; }
                this.hat = null; this.back = null;
                this.look.hat = ''; this.look.back = '';
                if (this.held) { this.held = null; if (this._holdId) this._attachHeld(this._holdId); }
                if (this.clip) { const c = this.clip; this.clip = ''; this.play(c, this.clipOpts || {}); }
                rig.setEnabled(this.visible);
            }
            this.look.skin = lk.skin;
        }
        if (!this.rig) return;
        await this._accessory('hat', 'Hat', lk.hat, token);
        await this._accessory('back', 'Back', lk.back, token);
    }

    async _accessory(kind, bone, id, token) {
        if (this.look[kind] === id && (this[kind] || !id)) return;
        if (this[kind] && this.rig) { this.rig.detach(this[kind], true); this[kind] = null; }
        this.look[kind] = id || '';
        if (kind === 'hat') this._hair(id);
        if (!id) return;
        const mesh = await GameModels.build(GameAssets.path(kind, id), this.view, kind + ':' + id, 'actor');
        if (!mesh) return;
        if (token !== this._token || !this.rig || this.look[kind] !== id) { Model3D.dispose(this.view, mesh); return; }
        this.rig.attach(bone, mesh);
        this[kind] = mesh;
    }

    /** Шапка прячет волосы скина: hair 'hide' — все части Hair, 'flat' — только Hair_Top. */
    _hair(hatId) {
        if (!this.rig) return;
        this.rig.setPartVisible('Hair', true);
        const it = hatId ? SKIN_ITEMS.find(x => x.id === hatId) : null;
        if (it && it.hair === 'hide') this.rig.setPartVisible('Hair', false);
        else if (it && it.hair === 'flat') this.rig.setPartVisible('Hair_Top', false);
    }

    _detachAll(rig) {
        for (const k of ['hat', 'back', 'held']) {
            if (this[k]) { try { rig.detach(this[k], true); } catch (e) { /* уже снято */ } this[k] = null; }
        }
    }

    /** Еда в правой руке (id еды) или null — убрать. */
    async hold(foodId) {
        if (this.held) { if (this.rig) this.rig.detach(this.held, true); else Model3D.dispose(this.view, this.held); this.held = null; }
        this._holdId = foodId || '';
        if (!foodId) return;
        await this._attachHeld(foodId);
    }
    async _attachHeld(foodId) {
        const mesh = await GameModels.build(GameAssets.path('food', foodId), this.view, 'held', 'actor');
        if (!mesh) return;
        if (this._holdId !== foodId || !this.rig) { Model3D.dispose(this.view, mesh); return; }
        if (this.held) this.rig.detach(this.held, true);
        mesh.scaling.setAll(0.55);
        this.rig.attach('Hand_R', mesh, { scale: 0.55 });
        this.held = mesh;
    }

    play(clip, opts) {
        if (this.clip === clip && !(opts && opts.restart)) return;
        this.clip = clip; this.clipOpts = opts || null;
        if (!this.rig) return;
        const o = Object.assign({ fade: 0.15 }, opts || {});
        if (!this.rig.play(clip, o) && clip !== 'idle') this.rig.play(clip === 'run' ? 'walk' : 'idle', { fade: 0.15 });
    }

    place(x, y, h, heading) {
        this.node.position.set(x, h, y);
        this.node.rotation.y = -heading;
    }

    setVisible(on) {
        this.visible = !!on;
        if (this.rig) this.rig.setEnabled(this.visible);
        if (this.fallback) this.fallback.setEnabled(this.visible);
    }

    /** Мировая точка руки (вылет еды) или над головой. */
    handPos(out) {
        if (this.rig) return this.rig.nodePosition('Hand_R', out);
        const v = out || new BABYLON.Vector3();
        v.copyFrom(this.node.position); v.y += 150;
        return v;
    }

    dispose() {
        this._token++;
        if (this.rig) { this._detachAll(this.rig); this.rig.dispose(); this.rig = null; }
        if (this.fallback) { this.fallback.dispose(false, true); this.fallback = null; }
        this.node.dispose();
    }
}

// ------------------------------------------------------------------------------------------------
// Walker — движение по карте (Nav). Состояние — числа (инвариант 4).
// ------------------------------------------------------------------------------------------------
class Walker {
    constructor(x, y, heading) {
        this.x = x; this.y = y; this.h = 0; this.heading = heading || 0;
        this.vh = 0; this.grounded = true; this.moving = false; this.speed = 0;
        this.radius = typeof HERO_RADIUS !== 'undefined' ? HERO_RADIUS : 34;
    }
    ground(x, y) { return typeof Nav !== 'undefined' && Nav.ready ? Nav.height(x, y) : 0; }
    place(x, y, heading) {
        this.x = x; this.y = y; if (heading != null) this.heading = heading;
        this.h = this.ground(x, y); this.vh = 0; this.grounded = true;
    }
    /** dx, dy — направление (длина ≤ 1) по карте; speed px/с; jump — прыжок. */
    step(dt, dx, dy, speed, jump) {
        const len = Math.hypot(dx, dy);
        this.moving = len > 0.05;
        if (this.moving) {
            const v = speed * Math.min(1, len);
            let nx = this.x + dx / len * v * dt, ny = this.y + dy / len * v * dt;
            if (typeof Nav !== 'undefined' && Nav.ready) {
                const p = Nav.move(this.x, this.y, nx - this.x, ny - this.y, this.radius);
                nx = p.x; ny = p.y;
            }
            this.speed = Math.hypot(nx - this.x, ny - this.y) / Math.max(1e-4, dt);
            this.x = nx; this.y = ny;
            const want = Math.atan2(dy, dx);
            let d = want - this.heading;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            this.heading += d * Math.min(1, dt * 12);
        } else this.speed = 0;
        const g = this.ground(this.x, this.y);
        const grav = typeof HERO_GRAVITY !== 'undefined' ? HERO_GRAVITY : 2600;
        if (jump && this.grounded) { this.vh = typeof HERO_JUMP_SPEED !== 'undefined' ? HERO_JUMP_SPEED : 900; this.grounded = false; }
        if (!this.grounded || this.h > g + 2) {
            this.vh -= grav * dt;
            this.h += this.vh * dt;
            if (this.h <= g) { this.h = g; this.vh = 0; this.grounded = true; this.landed = true; }
            else this.grounded = false;
        } else this.h = g;
    }
    /** Пойти к точке: вернуть true, когда дошёл. */
    walkTo(dt, tx, ty, speed, stopDist) {
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
        if (d <= (stopDist || 20)) { this.step(dt, 0, 0, 0, false); return true; }
        const k = Math.min(1, d / Math.max(1, speed * dt));
        this.step(dt, dx / d * k, dy / d * k, speed, false);
        return false;
    }
}

// ------------------------------------------------------------------------------------------------
// AnimalActor — животное в сцене
// ------------------------------------------------------------------------------------------------
let ANIMAL_UID = 1;

class AnimalActor {
    /** @param {any} view @param {{ id: string, muts?: string[], uid?: number }} data @param {any} labels GameLabels */
    constructor(view, data, labels) {
        this.view = view;
        this.data = data;
        this.uid = data.uid || ANIMAL_UID++;
        this.info = Econ.animal(data.id);
        this.labels = labels;
        this.node = new BABYLON.TransformNode('animal', view.scene);
        /** @type {any} */ this.rig = null;
        this.x = 0; this.y = 0; this.h = 0; this.heading = 0;
        this.mode = 'idle';          // idle | wander | follow | goto | eat | hidden
        this.tx = 0; this.ty = 0; this.wait = Math.random() * 2;
        /** @type {{ x: number, y: number, hx: number, hy: number, rot: number } | null} */
        this.area = null;
        /** @type {{ x: number, y: number, heading: number } | null} */
        this.leader = null;
        this.followIndex = 0;
        this.speed = 0;
        this.clip = '';
        this.visible = true;
        this.culled = false;
        this.showLabel = true;
        this.scale = 1;
        this.big = (data.muts || []).includes('big');
        this.loaded = this._load();
    }

    async _load() {
        const id = this.data.id, arch = this.info ? this.info.arch : 'quad';
        const [model, lib] = await Promise.all([GameModels.load(GameAssets.path('animal', id)), GameModels.load(GameAssets.path('clips', arch))]);
        if (!this.node || this.node.isDisposed()) return;
        if (!model) { this._placeholder(); return; }
        const rig = Rig.create(model, this.view, { name: 'animal:' + id, kind: 'actor', clips: lib ? [lib] : [] });
        rig.root.parent = this.node;
        this.rig = rig;
        const big = GAME_DATA.MUTATIONS.find(m => m.id === 'big');
        this.scale = this.big && big ? big.scale : 1;
        this.node.scaling.setAll(this.scale);
        const tintMut = (this.data.muts || []).map(m => Econ.mutation(m)).find(m => m && m.tint);
        if (tintMut) GameModels.tint(rig._meshes, tintMut.tint);
        rig.play(this.clip || 'idle', { at: Math.random() });
        rig.setEnabled(this.visible && !this.culled);
    }

    _placeholder() {
        const s = this.view.scene, r = Econ.rarity(this.info ? this.info.rarity : 'common');
        const mat = new BABYLON.StandardMaterial('animal-ph', s);
        mat.diffuseColor = BABYLON.Color3.FromHexString(r.color);
        const b = BABYLON.MeshBuilder.CreateBox('animal-ph', { width: 90, height: 60, depth: 50 }, s);
        b.position.y = 40; b.material = mat; b.parent = this.node; b.isPickable = false;
        World3D.addObject(this.view, b, 'actor');
    }

    get height() { return (this.rig ? this.rig.height : 80) * this.scale; }
    get income() { return Econ.income(this.data.id, this.data.muts); }

    labelHtml() {
        const a = this.info, muts = (this.data.muts || []).map(m => { const d = Econ.mutation(m); return d ? (Lang.code === 'ru' ? d.ru : d.en) : ''; }).filter(Boolean);
        const name = a ? (Lang.code === 'ru' ? a.ru : a.en) : this.data.id;
        const col = a ? Econ.rarity(a.rarity).color : '#fff';
        return `<div class="nm" style="color:${col}">${name}</div>` + (muts.length ? `<div class="mut">${muts.join(' ')}</div>` : '') +
            `<div class="sub">${perSec(this.income)}</div>`;
    }

    play(clip) {
        if (this.clip === clip) return;
        this.clip = clip;
        if (this.rig && !this.rig.play(clip, { fade: 0.2 }) && clip === 'run') this.rig.play('walk', { fade: 0.2 });
    }

    place(x, y, heading) {
        this.x = x; this.y = y; if (heading != null) this.heading = heading;
        this.h = typeof Nav !== 'undefined' && Nav.ready ? Nav.height(x, y) : 0;
        this._apply();
    }

    _apply() {
        this.node.position.set(this.x, this.h, this.y);
        this.node.rotation.y = -this.heading;
    }

    setVisible(on) {
        this.visible = !!on;
        this.node.setEnabled(this.visible && !this.culled);
        if (this.rig) this.rig.setEnabled(this.visible && !this.culled);
        if (!this.visible && this.labels) this.labels.pos('a' + this.uid, 0, 0, 0, false);
    }

    /** Бродить внутри прямоугольника загона. */
    wanderIn(area) { this.area = area; this.mode = 'wander'; this.wait = Math.random() * 2.5; this.leader = null; }
    follow(leader, index) { this.leader = leader; this.followIndex = index || 0; this.mode = 'follow'; this.area = null; }
    goTo(x, y, then) { this.tx = x; this.ty = y; this.mode = 'goto'; this._then = then || null; }

    _randomInArea() {
        const a = this.area;
        if (!a) return { x: this.x, y: this.y };
        const u = (Math.random() * 2 - 1) * a.hx * 0.82, v = (Math.random() * 2 - 1) * a.hy * 0.82;
        const c = Math.cos(a.rot), s = Math.sin(a.rot);
        return { x: a.x + u * c - v * s, y: a.y + u * s + v * c };
    }

    _move(dt, tx, ty, speed, stop) {
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
        if (d <= stop) { this.speed = 0; return true; }
        const v = Math.min(speed, d / Math.max(dt, 1e-3));
        this.x += dx / d * v * dt; this.y += dy / d * v * dt;
        this.speed = v;
        const want = Math.atan2(dy, dx);
        let dh = want - this.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.heading += dh * Math.min(1, dt * 7);
        return false;
    }

    update(dt, camPos) {
        // отсечение по дальности от камеры (вид), счёт движения идёт дальше
        if (camPos) {
            const lim = typeof ANIMAL_CULL_DIST !== 'undefined' ? ANIMAL_CULL_DIST : 5200;
            const far = Math.hypot(camPos.x - this.x, camPos.z - this.y) > lim;
            if (far !== this.culled) { this.culled = far; this.node.setEnabled(this.visible && !far); if (this.rig) this.rig.setEnabled(this.visible && !far); }
        }
        const base = 150 + Math.min(220, this.height * 0.9);
        if (this.mode === 'wander') {
            if (this.wait > 0) {
                this.wait -= dt;
                this.play(this._eating ? 'eat' : 'idle');
                if (this.wait <= 0) { const p = this._randomInArea(); this.tx = p.x; this.ty = p.y; this._eating = false; }
            } else if (this._move(dt, this.tx, this.ty, base * 0.55, 12)) {
                this.wait = 1.5 + Math.random() * 3.5; this._eating = Math.random() < 0.35;
            } else this.play('walk');
        } else if (this.mode === 'follow' && this.leader) {
            const L = this.leader, back = 130 + this.followIndex * 120 + this.height * 0.3;
            const side = (this.followIndex % 2 ? 1 : -1) * (60 + (this.followIndex >> 1) * 40);
            const hx = Math.cos(L.heading), hy = Math.sin(L.heading);
            const tx = L.x - hx * back - hy * side, ty = L.y - hy * back + hx * side;
            const d = Math.hypot(tx - this.x, ty - this.y);
            if (d > 1600) { this.x = tx; this.y = ty; }
            const sp = d > 400 ? base * 3.2 : d > 120 ? base * 2.2 : base;
            if (this._move(dt, tx, ty, sp, 30)) this.play('idle'); else this.play(d > 260 ? 'run' : 'walk');
        } else if (this.mode === 'goto') {
            if (this._move(dt, this.tx, this.ty, base * 1.7, 26)) {
                this.mode = 'idle';
                const f = this._then; this._then = null;
                if (f) f(this);
            } else this.play('walk');
        } else if (this.mode === 'eat') this.play('eat');
        else if (this.mode === 'happy') this.play('happy');
        else this.play('idle');
        this.h = typeof Nav !== 'undefined' && Nav.ready ? Nav.height(this.x, this.y) : 0;
        this._apply();
        if (this.labels && this.showLabel) {
            const id = 'a' + this.uid;
            if (!this.labels.has(id)) this.labels.set(id, this.labelHtml(), 'animal', 2600);
            this.labels.pos(id, this.x, this.y, this.h + this.height + 30, this.visible && !this.culled);
        }
    }

    dispose() {
        if (this.labels) this.labels.remove('a' + this.uid);
        if (this.rig) { this.rig.dispose(); this.rig = null; }
        if (this.node) { this.node.dispose(false, true); }
    }
}
