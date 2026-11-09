// GameWorld.js — мир по маркерам карты (js/Maps.js, правится в редакторе):
//   трасса (throw-line, lane-1…lane-28, lane-end) — геометрия зон и перевод «дальность в зонах» -> точка;
//   участки plot-1…6 с турниками bar-N, площадками улучшения barpad-N и табличками вместимости cap-N;
//   лавки shop-food / shop-sell и продавцы npc-*; табло board-power / board-money / board-luck;
//   разметка на земле (пунктирные круги), жёлтые стрелки-подсказки к цели.
// Модели турников, площадок, табличек и полосы броска ставит игра (они меняются), остальное — карта.

const DEG = Math.PI / 180;

/** Маркер -> { x, y, h, heading (рад), sx, sz (px полуразмеры), name } */
function markerInfo(m) {
    if (!m) return null;
    const rot = m.rot || [0, 0, 0], sc = m.scale || [1, 1, 1];
    return { name: m.name, x: m.x, y: m.y, h: m.h || 0, heading: (rot[1] || 0) * DEG, sx: (sc[0] || 1) * 100, sz: (sc[2] || sc[0] || 1) * 100, sy: (sc[1] || 1) * 100 };
}
function markerNum(name) { const m = /-(\d+)$/.exec(name || ''); return m ? +m[1] : 0; }

// ------------------------------------------------------------------------------------------------
// Участок: загон, турник, площадка улучшения, табличка вместимости
// ------------------------------------------------------------------------------------------------
class Plot {
    constructor(index, world) {
        this.index = index;
        this.world = world;
        const loc = world.app.location;
        this.m = markerInfo(loc.marker('plot-' + index));
        this.bar = markerInfo(loc.marker('bar-' + index));
        this.pad = markerInfo(loc.marker('barpad-' + index));
        this.cap = markerInfo(loc.marker('cap-' + index));
        const m = this.m || { x: 0, y: 0, heading: 0, sx: 700, sz: 700 };
        this.area = { x: m.x, y: m.y, hx: m.sx, hy: m.sz, rot: m.heading };
        /** @type {any} */ this.owner = null;
        /** @type {Map<number, AnimalActor>} */ this.actors = new Map();
        this.barTier = -2;
        /** @type {any} */ this.barMesh = null;
        /** @type {any} */ this.padMesh = null;
        /** @type {any} */ this.signMesh = null;
        this.signText = '';
    }

    /** Точка внутри загона (u, v — доли полуразмеров -1..1). */
    point(u, v) {
        const a = this.area, c = Math.cos(a.rot), s = Math.sin(a.rot);
        const px = u * a.hx, py = v * a.hy;
        return { x: a.x + px * c - py * s, y: a.y + px * s + py * c };
    }
    contains(x, y, pad) {
        const a = this.area, c = Math.cos(-a.rot), s = Math.sin(-a.rot);
        const dx = x - a.x, dy = y - a.y, u = dx * c - dy * s, v = dx * s + dy * c;
        return Math.abs(u) <= a.hx + (pad || 0) && Math.abs(v) <= a.hy + (pad || 0);
    }
    /** Вход в загон: середина передней стороны, чуть снаружи. */
    gate() {
        const a = this.area, f = Math.max(a.hx, a.hy);
        const hx = Math.cos(a.rot), hy = Math.sin(a.rot);
        return { x: a.x + hx * (a.hx + 160), y: a.y + hy * (a.hx + 160), inner: { x: a.x + hx * (a.hx * 0.5), y: a.y + hy * (a.hx * 0.5) }, f };
    }

    /** Турник уровня tier (-1 — нет: «купить деревянный»). */
    async setBar(tier) {
        if (tier === this.barTier || !this.bar) return;
        this.barTier = tier;
        const view = this.world.app.location.view;
        const id = GAME_DATA.BARS[Math.max(0, tier)].id;
        const mesh = await GameModels.build(GameAssets.path('bar', id), view, 'bar' + this.index, 'prop');
        if (this.barTier !== tier) { if (mesh) Model3D.dispose(view, mesh); return; }
        if (this.barMesh) Model3D.dispose(view, this.barMesh);
        this.barMesh = mesh;
        if (!mesh) return;
        mesh.position.set(this.bar.x, this.bar.h || 0, this.bar.y);
        mesh.rotation.y = -this.bar.heading;
        // турника ещё нет — полупрозрачный «призрак» (как кнопка покупки)
        const ghost = tier < 0;
        for (const m of [mesh].concat(mesh.getChildMeshes(false))) m.visibility = ghost ? 0.45 : 1;
    }

    async buildStatic() {
        const view = this.world.app.location.view;
        if (this.pad) {
            this.padMesh = await GameModels.build(GameAssets.path('prop', 'pad_upgrade'), view, 'pad' + this.index, 'prop');
            if (this.padMesh) { this.padMesh.position.set(this.pad.x, this.pad.h || 0, this.pad.y); this.padMesh.rotation.y = -this.pad.heading; }
        }
        if (this.cap) {
            this.signMesh = await GameModels.build(GameAssets.path('prop', 'sign_capacity'), view, 'sign' + this.index, 'prop');
            if (this.signMesh) { this.signMesh.position.set(this.cap.x, this.cap.h || 0, this.cap.y); this.signMesh.rotation.y = -this.cap.heading; }
            const S = /** @type {any} */ (GAME_PROPS).sign || { w: 220, h: 130, centerZ: 150, front: 6 };
            this.sign = this.world.signPlane('cap' + this.index, this.cap.x, this.cap.y, (this.cap.h || 0) + S.centerZ, this.cap.heading, S.front + 1, S.w, S.h, 256, 152);
        }
        if (this.bar) this.world.decal('bar' + this.index, this.bar.x, this.bar.y, 170, '#ffffff');
    }

    /** Показать животных участка: список { uid, id, muts }, не больше max видимых. */
    syncAnimals(list, max) {
        const view = this.world.app.location.view, labels = this.world.labels;
        const show = list.slice(0, max);
        const keep = new Set(show.map(a => a.uid));
        for (const [uid, act] of this.actors) if (!keep.has(uid)) { act.dispose(); this.actors.delete(uid); }
        show.forEach((a, i) => {
            if (this.actors.has(a.uid)) return;
            const act = new AnimalActor(view, a, labels);
            const p = this.point((Math.random() * 2 - 1) * 0.7, (Math.random() * 2 - 1) * 0.7);
            act.place(p.x, p.y, Math.random() * Math.PI * 2);
            act.wanderIn(this.area);
            this.actors.set(a.uid, act);
            void i;
        });
    }

    /** Текст таблички вместимости: big — крупная строка, small — нижняя; paw — значок лапы у строки 'big' | 'small'. */
    setSign(big, small, smallColor, paw) {
        if (!this.sign) return;
        const key = big + '|' + small + '|' + paw + '|' + (GameWorld.paw && GameWorld.paw.complete ? 1 : 0);
        if (this._signKey === key) return;
        this._signKey = key;
        this._signArgs = [big, small, smallColor, paw];
        GameWorld.signs.add(this);
        this.world.paintSign(this.sign, (ctx, W, H) => {
            GameWorld.iconText(ctx, big, W / 2, H * 0.4, W - 24, 58, '#3a2410', '#fff6dc', paw === 'big');
            if (small) GameWorld.iconText(ctx, small, W / 2, H * 0.78, W - 24, 36, '#1b3a12', smallColor || '#8dff6a', paw === 'small');
        }, 'wood');
    }

    update(dt, camPos) { for (const a of this.actors.values()) a.update(dt, camPos); }
}

// ------------------------------------------------------------------------------------------------
// GameWorld — трасса, участки, лавки, табло, разметка, стрелки
// ------------------------------------------------------------------------------------------------
/** @satisfies {Record<string, any>} */
const GameWorld = {
    /** @type {any} */ app: null,
    /** @type {any} */ labels: null,
    /** @type {Plot[]} */ plots: [],
    lane: { x: 0, y: 0, fx: 0, fy: -1, heading: -Math.PI / 2, width: 2400, starts: /** @type {number[]} */ ([]), pts: /** @type {any[]} */ ([]), end: 0, throwX: 0, throwY: 0, throwH: 0 },
    /** @type {any} */ spawn: null,
    /** @type {any} */ shopFood: null,
    /** @type {any} */ shopSell: null,
    /** @type {Record<string, any>} */ boards: {},
    /** @type {Record<string, any>} */ _decals: {},
    /** @type {any[]} */ npcs: [],
    /** @type {any[]} */ arrows: [],
    /** @type {any} */ bigArrow: null,
    guideTarget: /** @type {{x:number,y:number}|null} */ (null),
    _guideT: 0,

    async init(app, labels) {
        this.app = app; this.labels = labels;
        const loc = app.location;
        this.spawn = markerInfo(loc.marker('spawn')) || { x: loc.map.width / 2, y: loc.map.height - 1500, heading: -Math.PI / 2, h: 0 };
        this._lane();
        this.shopFood = markerInfo(loc.marker('shop-food'));
        this.shopSell = markerInfo(loc.marker('shop-sell'));
        this.plots = [];
        for (let i = 1; i <= 6; i++) this.plots.push(new Plot(i, this));
        const view = loc.view;
        // полоса броска
        const tl = this.lane;
        const pad = await GameModels.build(GameAssets.path('prop', 'pad_throw'), view, 'throwpad', 'prop');
        if (pad) {
            pad.position.set(tl.throwX, tl.throwH + 1, tl.throwY);
            pad.rotation.y = -tl.heading;
            pad.scaling.z = Math.max(0.3, tl.width / 1000);
        }
        await Promise.all(this.plots.map(p => p.buildStatic()));
        if (this.shopSell) this.decal('sell', this.shopSell.x, this.shopSell.y, this.shopSell.sx, '#ff3b3b');
        if (this.shopFood) this.decal('food', this.shopFood.x, this.shopFood.y, this.shopFood.sx, '#3bb7ff');
        this._boards();
        this._guideMeshes();
        this.labelProps();
        this.spawnNpcs();
        // подписи лавок
        const sf = loc.marker('npc-food') || loc.marker('shop-food'), ss = loc.marker('npc-sell') || loc.marker('shop-sell');
        if (ss) { labels.set('lbl-sell', Lang.t('ui.sellBig'), 'big3d sell', 9000); labels.pos('lbl-sell', ss.x, ss.y, 560); }
        if (sf) { labels.set('lbl-food', Lang.t('ui.foodShop'), 'big3d food', 9000); labels.pos('lbl-food', sf.x, sf.y, 560); }
    },

    _lane() {
        const loc = this.app.location, L = this.lane;
        const tl = markerInfo(loc.marker('throw-line'));
        const starts = loc.markers('lane').filter(m => /^lane-\d+$/.test(m.name)).sort((a, b) => markerNum(a.name) - markerNum(b.name));
        const end = loc.markers('lane').find(m => m.name === 'lane-end');
        if (tl) { L.throwX = tl.x; L.throwY = tl.y; L.throwH = tl.h || 0; L.heading = tl.heading; L.width = tl.sx * 2; }
        else { L.throwX = loc.map.width / 2; L.throwY = loc.map.height - 8000; L.heading = -Math.PI / 2; }
        L.fx = Math.cos(L.heading); L.fy = Math.sin(L.heading);
        const p0 = starts[0] ? { x: starts[0].x, y: starts[0].y } : { x: L.throwX + L.fx * 200, y: L.throwY + L.fy * 200 };
        L.x = p0.x; L.y = p0.y;
        const n = Econ.zoneCount(), proj = (m) => (m.x - p0.x) * L.fx + (m.y - p0.y) * L.fy;
        L.starts = []; L.pts = [];
        for (let k = 0; k < n; k++) {
            const m = starts[k];
            L.starts.push(m ? proj(m) : k * 2400);
            L.pts.push(m ? { x: m.x, y: m.y } : { x: p0.x + L.fx * k * 2400, y: p0.y + L.fy * k * 2400 });
        }
        L.end = end ? proj(end) : L.starts[n - 1] + 2400;
    },

    zoneLen(z) { const L = this.lane; return (z + 1 < L.starts.length ? L.starts[z + 1] : L.end) - L.starts[z]; },
    /** Непрерывная дальность в зонах -> расстояние вдоль трассы от lane-1. */
    reachToDist(u) {
        const L = this.lane, z = Math.max(0, Math.min(L.starts.length - 1, Math.floor(u)));
        return L.starts[z] + (u - z) * this.zoneLen(z);
    },
    distToReach(d) {
        const L = this.lane;
        for (let z = L.starts.length - 1; z >= 0; z--) if (d >= L.starts[z]) return z + Math.min(0.999, (d - L.starts[z]) / Math.max(1, this.zoneLen(z)));
        return 0;
    },
    /** Точка трассы на расстоянии d от lane-1, сдвиг side вбок (px, вправо от направления). */
    lanePoint(d, side) {
        const L = this.lane;
        return { x: L.x + L.fx * d - L.fy * (side || 0), y: L.y + L.fy * d + L.fx * (side || 0) };
    },
    /** Стоит ли точка на полосе броска (зона запуска). */
    onThrowLine(x, y) {
        const L = this.lane, dx = x - L.throwX, dy = y - L.throwY;
        const along = dx * L.fx + dy * L.fy, side = -dx * L.fy + dy * L.fx;
        return along > -120 && along < 140 && Math.abs(side) < L.width / 2 - 40;
    },

    // --- Таблички: текст на лицевой грани модели ---------------------------------------------------
    /** Плоскость с холстом перед гранью: (x, y) — точка модели на карте, h — высота центра, heading — куда смотрит
     *  грань, front — отступ грани от точки, w × hpx — размер в мире, TW × TH — размер холста. */
    signPlane(id, x, y, h, heading, front, w, hpx, TW, TH) {
        const s = this.app.location.view.scene;
        const tex = new BABYLON.DynamicTexture('sign-' + id, { width: TW, height: TH }, s, true);
        tex.uScale = -1; tex.uOffset = 1;   // сцена правосторонняя: иначе текст зеркальный
        const mat = new BABYLON.StandardMaterial('sign-m-' + id, s);
        mat.diffuseTexture = tex; mat.emissiveColor = new BABYLON.Color3(0.82, 0.82, 0.82); mat.disableLighting = true; mat.metadata = { toon: false };
        const plane = BABYLON.MeshBuilder.CreatePlane('sign-' + id, { width: w, height: hpx }, s);
        plane.material = mat; plane.isPickable = false;
        plane.position.set(x + Math.cos(heading) * front, h, y + Math.sin(heading) * front);
        plane.rotation.y = -heading - Math.PI / 2;
        return { tex, plane, W: TW, H: TH };
    },
    /** Нарисовать табличку: фон (wood | banner | dark) и draw(ctx, W, H). */
    paintSign(sign, draw, bg) {
        if (!sign) return;
        const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (sign.tex.getContext()));
        const W = sign.W, H = sign.H;
        ctx.clearRect(0, 0, W, H);
        if (bg === 'banner') {
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffd23f'); g.addColorStop(1, '#ff8a1a');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let x = -H; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 30, H); ctx.lineTo(x + 30 + H, 0); ctx.lineTo(x + H, 0); ctx.fill(); }
            ctx.strokeStyle = '#5a2a00'; ctx.lineWidth = Math.max(8, H * 0.06); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
        } else {
            const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d9a866'); g.addColorStop(1, '#b07a3c');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(90,50,20,.35)'; ctx.lineWidth = 2;
            for (let y = H / 4; y < H; y += H / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
            ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = Math.max(6, H * 0.06); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
        }
        draw(ctx, W, H);
        sign.tex.update();
    },
    /** @type {HTMLImageElement | null} */ paw: null,
    /** @type {Set<any>} */ signs: new Set(),
    /** Текст с картинкой лапы слева (значок игры вместо эмодзи). Картинка грузится один раз, таблички перерисовываются. */
    iconText(ctx, text, x, y, maxW, size, stroke, fill, withIcon) {
        if (!withIcon) { this.fitText(ctx, text, x, y, maxW, size, stroke, fill); return; }
        if (!this.paw && typeof Image !== 'undefined') {
            const img = new Image();
            img.onload = () => { for (const p of this.signs) { p._signKey = ''; p.setSign(...p._signArgs); } };
            img.src = GameAssets.img('icon', 'animals');
            this.paw = img;
        }
        const ic = size * 1.05, w = this.fitText(ctx, text, x + ic * 0.55, y, maxW - ic - 6, size, stroke, fill);
        if (this.paw && this.paw.complete && this.paw.naturalWidth) ctx.drawImage(this.paw, x + ic * 0.55 - w / 2 - ic - 4, y - ic / 2, ic, ic);
    },
    /** Жирный текст с обводкой, ужатый по ширине; возвращает ширину надписи. */
    fitText(ctx, text, x, y, maxW, size, stroke, fill) {
        let s = size;
        ctx.font = '1000 ' + s + 'px Nunito, system-ui, sans-serif';
        while (s > 10 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = '1000 ' + s + 'px Nunito, system-ui, sans-serif'; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(4, s * 0.2); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
        ctx.fillStyle = fill; ctx.fillText(text, x, y);
        return ctx.measureText(text).width;
    },
    /** Надписи на арке над трассой и на указателях — по объектам карты. */
    labelProps() {
        const loc = this.app.location;
        const P = /** @type {any} */ (GAME_PROPS), gate = P.gate || { w: 1000, h: 220, centerZ: 500, front: 47 };
        loc.objects.forEach((rec, i) => {
            const d = rec.def, model = d.model || '';
            const heading = ((d.rot && d.rot[1]) || 0) * DEG, sc = (d.scale && d.scale[0]) || 1;
            if (/arch_gate.glb$/.test(model)) {
                const front = this.signPlane('arch' + i, d.x, d.y, (d.h || 0) + gate.centerZ, heading, gate.front + 2, gate.w * sc, gate.h * sc, 1024, 226);
                this.paintSign(front, (ctx, W, H) => {
                    this.fitText(ctx, Lang.t('ui.arch.front'), W / 2, H * 0.42, W - 60, 120, '#5a2a00', '#ffffff');
                    this.fitText(ctx, Lang.t('ui.arch.sub'), W / 2, H * 0.8, W - 120, 40, '#5a2a00', '#fff3a8');
                }, 'banner');
                const back = this.signPlane('archb' + i, d.x, d.y, (d.h || 0) + gate.centerZ, heading + Math.PI, gate.front + 2, gate.w * sc, gate.h * sc, 1024, 226);
                this.paintSign(back, (ctx, W, H) => this.fitText(ctx, Lang.t('ui.arch.back'), W / 2, H * 0.5, W - 60, 120, '#5a2a00', '#ffffff'), 'banner');
            } else if (/sign_arrow.glb$/.test(model)) {
                for (const side of [1, -1]) {
                    const sg = this.signPlane('arrow' + i + side, d.x, d.y, (d.h || 0) + 162 * sc, heading + side * Math.PI / 2, 27, 112 * sc, 34 * sc, 256, 78);
                    this.paintSign(sg, (ctx, W, H) => this.fitText(ctx, Lang.t('ui.arrowSign'), W / 2, H / 2, W - 20, 44, '#3a2410', '#fff6dc'), 'wood');
                }
            }
        });
    },
    /** Продавцы в киосках (маркеры npc-food, npc-sell). */
    spawnNpcs() {
        const loc = this.app.location, view = loc.view;
        const pick = (ids) => ids.find(id => SKIN_ITEMS.some(s => s.id === id)) || 'outfit_classic';
        const defs = [
            { m: markerInfo(loc.marker('npc-food')), look: { skin: pick(['outfit_farmhand', 'outfit_explorer', 'outfit_classic']), hat: pick(['hat_chef', '']) }, name: 'ui.npcFood' },
            { m: markerInfo(loc.marker('npc-sell')), look: { skin: pick(['outfit_hoard', 'outfit_royal', 'outfit_classic']), hat: pick(['hat_top_hat', '']) }, name: 'ui.npcSell' },
        ];
        for (const d of defs) {
            if (!d.m) continue;
            const av = new Avatar(view, d.look);
            av.place(d.m.x, d.m.y, d.m.h || 0, d.m.heading);
            av.play('idle');
            this.npcs.push({ av, m: d.m, t: Math.random() * 6, name: d.name });
            this.labels.set('npc-' + d.name, '<div class="nm" style="color:#ffe14a">' + Lang.t(d.name) + '</div>', 'player', 3000);
            this.labels.pos('npc-' + d.name, d.m.x, d.m.y, (d.m.h || 0) + 235);
        }
    },
    /** Продавцы иногда машут (клип cheer), остальное время стоят. */
    updateNpcs(dt) {
        for (const n of this.npcs) {
            n.t -= dt;
            if (n.t <= 0) { n.t = 6 + Math.random() * 8; n.av.play('cheer', { restart: true }); n.wave = 1.6; }
            if (n.wave > 0) { n.wave -= dt; if (n.wave <= 0) n.av.play('idle'); }
        }
    },

    // --- Разметка: пунктирный круг на земле -------------------------------------------------------
    decal(id, x, y, r, color) {
        const s = this.app.location.view.scene;
        const key = 'dash|' + color;
        let mat = this._decals[key];
        if (!mat) {
            const tex = new BABYLON.DynamicTexture('decal-' + color, 256, s, true);
            const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (tex.getContext()));
            ctx.clearRect(0, 0, 256, 256);
            ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.setLineDash([26, 20]); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.stroke();
            tex.hasAlpha = true; tex.update();
            mat = new BABYLON.StandardMaterial('decal-m-' + color, s);
            mat.diffuseTexture = tex; mat.emissiveColor = new BABYLON.Color3(1, 1, 1); mat.disableLighting = true;
            mat.useAlphaFromDiffuseTexture = true; mat.backFaceCulling = false;
            mat.metadata = { toon: false };
            this._decals[key] = mat;
        }
        const g = BABYLON.MeshBuilder.CreateGround('decal-' + id, { width: r * 2, height: r * 2 }, s);
        g.material = mat; g.isPickable = false;
        g.position.set(x, (typeof Nav !== 'undefined' && Nav.ready ? Nav.height(x, y) : 0) + 3, y);
        return g;
    },

    // --- Табло лидеров ---------------------------------------------------------------------------
    _boards() {
        const loc = this.app.location, s = loc.view.scene;
        for (const kind of ['power', 'money', 'luck']) {
            const m = markerInfo(loc.marker('board-' + kind));
            if (!m) continue;
            const P = /** @type {any} */ (GAME_PROPS), w = (P.board && P.board.w) || 360, h = (P.board && P.board.h) || 460;
            const tex = new BABYLON.DynamicTexture('board-' + kind, { width: 512, height: 660 }, s, true);
            tex.uScale = -1; tex.uOffset = 1;   // сцена правосторонняя: без отражения текст читался бы зеркально
            const mat = new BABYLON.StandardMaterial('board-m-' + kind, s);
            mat.diffuseTexture = tex; mat.emissiveColor = new BABYLON.Color3(1, 1, 1); mat.disableLighting = true; mat.metadata = { toon: false };
            const plane = BABYLON.MeshBuilder.CreatePlane('board-' + kind, { width: w, height: h }, s);
            plane.material = mat; plane.isPickable = false;
            // плоскость смотрит в −Z локально; экран табло — в сторону курса маркера
            plane.position.set(m.x + Math.cos(m.heading) * 8, (m.h || 300), m.y + Math.sin(m.heading) * 8);
            plane.rotation.y = -m.heading - Math.PI / 2;   // нормаль плоскости (−Z) — в сторону курса маркера
            this.boards[kind] = { tex, plane, m };
        }
    },

    /** rows: [{ name, value, me }] — нарисовать табло kind. */
    drawBoard(kind, title, rows, color) {
        const b = this.boards[kind];
        if (!b) return;
        const ctx = /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (b.tex.getContext()));
        const W = 512, H = 660;
        ctx.fillStyle = '#141826'; ctx.fillRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, color); g.addColorStop(1, '#ffffff');
        ctx.fillStyle = color; ctx.fillRect(0, 0, W, 92);
        ctx.font = '900 44px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeText(title, W / 2, 48);
        ctx.fillStyle = '#fff'; ctx.fillText(title, W / 2, 48);
        ctx.font = '800 30px Nunito, system-ui, sans-serif';
        rows.slice(0, 10).forEach((r, i) => {
            const y = 128 + i * 52;
            ctx.fillStyle = r.me ? 'rgba(255,214,64,.28)' : (i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)');
            ctx.fillRect(14, y - 23, W - 28, 46);
            ctx.textAlign = 'left'; ctx.fillStyle = i < 3 ? ['#ffd23f', '#d6dde8', '#e09a5a'][i] : '#aab3c5';
            ctx.fillText('#' + (i + 1), 24, y);
            ctx.fillStyle = r.me ? '#ffe680' : '#ffffff';
            const nm = r.name.length > 13 ? r.name.slice(0, 12) + '…' : r.name;
            ctx.fillText(nm, 92, y);
            ctx.textAlign = 'right'; ctx.fillStyle = '#7dff6a';
            ctx.fillText(r.value, W - 24, y);
        });
        b.tex.update();
    },

    // --- Жёлтые стрелки к цели -------------------------------------------------------------------
    _guideMeshes() {
        const s = this.app.location.view.scene;
        const mat = new BABYLON.StandardMaterial('guide-m', s);
        mat.diffuseColor = new BABYLON.Color3(1, 0.86, 0.1); mat.emissiveColor = new BABYLON.Color3(0.9, 0.72, 0.05);
        mat.disableLighting = true; mat.metadata = { toon: false };
        for (let i = 0; i < 14; i++) {
            const t = BABYLON.MeshBuilder.CreateCylinder('guide' + i, { diameterTop: 0, diameterBottom: 70, height: 12, tessellation: 3 }, s);
            t.material = mat; t.isPickable = false; t.setEnabled(false);
            this.arrows.push(t);
        }
        // большая стрелка над целью
        const big = BABYLON.MeshBuilder.CreateCylinder('guide-big', { diameterTop: 0, diameterBottom: 110, height: 90, tessellation: 4 }, s);
        big.material = mat; big.isPickable = false; big.rotation.x = Math.PI; big.setEnabled(false);
        this.bigArrow = big;
    },

    /** Цель подсказки (точка карты) или null. */
    guide(target) { this.guideTarget = target; },

    updateGuide(dt, from) {
        this._guideT += dt;
        const t = this.guideTarget;
        if (!t || !from) { for (const a of this.arrows) a.setEnabled(false); if (this.bigArrow) this.bigArrow.setEnabled(false); return; }
        const dx = t.x - from.x, dy = t.y - from.y, d = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx), step = 150, off = (this._guideT * 260) % step;
        for (let i = 0; i < this.arrows.length; i++) {
            const a = this.arrows[i], s = 110 + i * step + off;
            if (s > d - 120) { a.setEnabled(false); continue; }
            const x = from.x + dx / d * s, y = from.y + dy / d * s;
            a.setEnabled(true);
            a.position.set(x, (Nav.ready ? Nav.height(x, y) : 0) + 8, y);
            a.rotation.set(0, -ang + Math.PI / 2, 0);
            const fade = Math.min(1, (d - 120 - s) / 200);
            a.scaling.setAll(0.6 + 0.4 * fade);
        }
        const b = this.bigArrow;
        if (b) {
            b.setEnabled(true);
            b.position.set(t.x, (t.h || 0) + 330 + Math.sin(this._guideT * 5) * 30, t.y);
            b.rotation.y = this._guideT * 2;
        }
    },
};
