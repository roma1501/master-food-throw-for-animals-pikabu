// GameLabels.js — подписи над миром (DOM поверх холста): ники игроков, «Кукабарра BIG $17/s» над животными,
// всплывающие «+$12», «+4 XP», реплики ботов. Позиция — проекция точки карты (x, y, h) через View3D каждый кадр.
// Только вид: игровых решений по проекции не принимается.

const GAME_LABELS_CSS = `
#glabels { position: fixed; inset: 0; pointer-events: none; z-index: 20; overflow: hidden; }
.glb { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); white-space: nowrap; text-align: center;
  font-family: var(--game-font, system-ui), system-ui, sans-serif; font-weight: 800; color: #fff; will-change: transform;
  text-shadow: 0 2px 0 rgba(0,0,0,.55), 0 0 3px rgba(0,0,0,.7); line-height: 1.05; }
.glb.off { display: none; }
.glb .nm { font-size: 15px; }
.glb .sub { font-size: 12px; color: #7dff6a; }
.glb .mut { font-size: 11px; color: #ffe14a; letter-spacing: .5px; }
.glb.player .nm { font-size: 14px; color: #fff; }
.glb.player .sub { color: #9cff8a; }
.glb .bub { display: inline-block; max-width: 220px; white-space: normal; margin-bottom: 4px; padding: 5px 9px; border-radius: 12px;
  background: rgba(255,255,255,.95); color: #23263a; font-size: 13px; font-weight: 700; text-shadow: none; box-shadow: 0 3px 0 rgba(0,0,0,.25); }
.glb.float { font-size: 26px; transition: none; }
.glb.float.money { color: #ff3b3b; -webkit-text-stroke: 1px #fff; }
.glb.float.xp { color: #7fd8ff; font-size: 18px; }
.glb.big3d { font-size: 44px; letter-spacing: 1px; -webkit-text-stroke: 2px #fff; }
.glb.price { font-size: 22px; color: #ff4040; -webkit-text-stroke: 1.5px #fff; text-shadow: 0 3px 0 rgba(0,0,0,.35); }
.glb.price .sub { color: #2fc4ff; font-size: 13px; -webkit-text-stroke: 0; }
`;

class GameLabels {
    /** @param {any} view View3D */
    constructor(view) {
        this.view = view;
        /** @type {Map<string, { el: HTMLElement, x: number, y: number, h: number, maxDist: number, visible: boolean, html: string }>} */
        this.items = new Map();
        /** @type {Array<{ el: HTMLElement, x: number, y: number, h: number, t: number, life: number, rise: number }>} */
        this.floats = [];
        this.box = null;
        if (typeof document === 'undefined') return;
        if (!document.getElementById('glabels-css')) {
            const st = document.createElement('style'); st.id = 'glabels-css'; st.textContent = GAME_LABELS_CSS;
            document.head.appendChild(st);
        }
        this.box = document.getElementById('glabels');
        if (!this.box) { this.box = document.createElement('div'); this.box.id = 'glabels'; document.body.appendChild(this.box); }
    }

    /** Подпись id: html и класс. Повторный вызов меняет текст (без пересоздания, если не изменился). */
    set(id, html, cls, maxDist) {
        if (!this.box) return;
        let it = this.items.get(id);
        if (!it) {
            const el = document.createElement('div');
            el.className = 'glb off ' + (cls || '');
            this.box.appendChild(el);
            it = { el, x: 0, y: 0, h: 0, maxDist: maxDist || 4200, visible: true, html: '' };
            this.items.set(id, it);
        }
        if (cls != null && it.el.className.indexOf(cls) < 0) it.el.className = 'glb off ' + cls;
        if (maxDist) it.maxDist = maxDist;
        if (it.html !== html) { it.html = html; it.el.innerHTML = html; }
    }
    pos(id, x, y, h, visible) {
        const it = this.items.get(id);
        if (!it) return;
        it.x = x; it.y = y; it.h = h; it.visible = visible !== false;
    }
    remove(id) {
        const it = this.items.get(id);
        if (it) { it.el.remove(); this.items.delete(id); }
    }
    has(id) { return this.items.has(id); }

    /** Всплывающий текст в точке мира: поднимается и тает. */
    float(x, y, h, html, cls, life) {
        if (!this.box) return;
        const el = document.createElement('div');
        el.className = 'glb float ' + (cls || '');
        el.innerHTML = html;
        this.box.appendChild(el);
        this.floats.push({ el, x, y, h, t: 0, life: life || 1.1, rise: 120 });
        if (this.floats.length > 24) { const f = this.floats.shift(); if (f) f.el.remove(); }
    }

    update(dt) {
        if (!this.box || !this.view || !this.view.camera) return;
        const cam = this.view.camera.position;
        for (const it of this.items.values()) {
            if (!it.visible) { it.el.classList.add('off'); continue; }
            const d = Math.hypot(cam.x - it.x, cam.y - it.h, cam.z - it.y);
            const pr = d < it.maxDist ? this.view.projectToScreen(it.x, it.y, it.h) : null;
            if (!pr || !pr.visible || pr.behind) { it.el.classList.add('off'); continue; }
            it.el.classList.remove('off');
            const k = Math.max(0.55, Math.min(1.15, 1500 / Math.max(1, d)));
            it.el.style.transform = `translate(${pr.x.toFixed(1)}px, ${pr.y.toFixed(1)}px) translate(-50%, -100%) scale(${k.toFixed(3)})`;
        }
        for (let i = this.floats.length - 1; i >= 0; i--) {
            const f = this.floats[i];
            f.t += dt;
            const a = f.t / f.life;
            if (a >= 1) { f.el.remove(); this.floats.splice(i, 1); continue; }
            const pr = this.view.projectToScreen(f.x, f.y, f.h + f.rise * a);
            if (!pr || !pr.visible || pr.behind) { f.el.style.opacity = '0'; continue; }
            f.el.style.opacity = String(a < 0.7 ? 1 : 1 - (a - 0.7) / 0.3);
            const s = a < 0.12 ? 0.6 + a / 0.12 * 0.5 : 1.1 - Math.min(0.1, (a - 0.12));
            f.el.style.transform = `translate(${pr.x.toFixed(1)}px, ${pr.y.toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
        }
    }

    clear() {
        for (const it of this.items.values()) it.el.remove();
        this.items.clear();
        for (const f of this.floats) f.el.remove();
        this.floats = [];
    }
}
