// GameProps.js — фигуры коллизий (Nav.register) и размеры реквизита базы (assets/models/props/).
// Модели собирает tools/blender/build_props.py (Blender, фоном), числа ниже совпадают с константами
// tools/blender/props_models.py; пересборка и таблица размеров — tools/blender/README-props.md.
//
// Единицы — px модели (1 м = 100 px), оси модели: x — вперёд (+X Blender, сторона игрока/покупателя),
// y — минус Y Blender (как в Nav: «вправо» модели), z (в полях …Z / h) — высота от земли.
// Все модели смотрят в +x; начало — на земле в центре основания. Фигуры ниже симметричны по y,
// кроме тех, где y указан явно.

/** @satisfies {Record<string, any>} */
const GAME_PROPS = {
    // Турники bar_<id>: игрок стоит в начале координат лицом в +x, руки на перекладине.
    // barHeight — ВЕРХ перекладины (ладони), barHalfWidth — стойки при y = ±135, толщина перекладины 12.
    grip: { barHeight: 270, barHalfWidth: 135, barThickness: 12, postTop: 284 },
    // leaderboard: тёмный экран w × h, центр на высоте centerZ, поверхность экрана при x = front
    // (передняя грань рамки — x = 0). Таблицу рисовать плоскостью чуть впереди: x = front + 1.
    board: { w: 360, h: 460, centerZ: 300, front: 5 },
    // sign_capacity: доска (вместе с тёмной каймой) w × h, лицевая грань при x = front; светлое поле без
    // каймы — inner. Кайма в одной плоскости с полем: текст можно класть плоскостью на всю доску.
    sign: { w: 220, h: 130, centerZ: 150, front: 6, inner: { w: 202, h: 112 } },
    // arch_gate: доска над въездом на дорожку (так же: кайма в плоскости поля), стойки при y = ±1200,
    // clearance — самая низкая точка над дорожкой (кончики флажков; низ доски — 390, низ балки — 430).
    gate: { w: 1000, h: 220, centerZ: 500, front: 47, inner: { w: 968, h: 188 }, halfWidth: 1200, clearance: 378 },
    // pad_upgrade — жёлтый диск с шипами; pad_throw — оранжевая полоса броска: w вдоль y (игра тянет её
    // по y под ширину дорожки), d вдоль x, светлая кромка шириной edge — на стороне +x.
    padUpgrade: { r: 70, h: 12 },
    padThrow: { w: 1000, d: 120, h: 6, edge: 14 },
    // fence_wood / fence_metal: пролёт len вдоль y, столбы при y = ±len/2 (общие с соседями: следующий пролёт
    // ставить через 400); fence_post — угловой столб post × post.
    fence: { len: 400, h: 110, post: 25 },
    // stall_food / stall_sell: прилавок со стороны +x (верх прилавка counterH, его передний край counterFront),
    // покупатель стоит при x ≈ 230…260; навес до x = 237, высота до h.
    stall: { w: 500, d: 443, h: 455, counterH: 122, counterFront: 190 },
    // Еда assets/models/food/<id>.glb: самая длинная сторона size, начало — в центре модели.
    food: { size: 50 },
};

(function registerPropShapes() {
    // Турник: стойка с лапами (лапы низкие, но выше шага NAV_STEP_PX) — коробка у каждой стойки.
    const bar = [
        { t: 'box', x: 0, y: -135, w: 120, d: 50, los: false },
        { t: 'box', x: 0, y: 135, w: 120, d: 50, los: false },
    ];
    const fence = [{ t: 'box', x: 0, y: 0, w: 25, d: 429, los: false }];
    Nav.register({
        'assets/models/props/bar_wood.glb': bar,
        'assets/models/props/bar_steel.glb': bar,
        'assets/models/props/bar_gold.glb': bar,
        'assets/models/props/bar_cyan.glb': bar,
        'assets/models/props/bar_ruby.glb': bar,
        'assets/models/props/bar_emerald.glb': bar,
        'assets/models/props/bar_diamond.glb': bar,
        'assets/models/props/bar_obsidian.glb': bar,
        'assets/models/props/bar_rainbow.glb': bar,
        'assets/models/props/bar_cosmic.glb': bar,
        // Площадки — поверхности: на них встают (диск — вписанный квадрат с запасом).
        'assets/models/props/pad_upgrade.glb': [{ t: 'walk', x: 0, y: 0, w: 110, d: 110, h: 12 }],
        'assets/models/props/pad_throw.glb': [{ t: 'walk', x: 0, y: 0, w: 120, d: 1000, h: 6 }],
        // Табличка: доска на одной стойке (низ доски на 85 — под ней не пройти).
        'assets/models/props/sign_capacity.glb': [{ t: 'box', x: -5, y: 0, w: 32, d: 232, los: false },
            { t: 'box', x: -16, y: 0, w: 90, d: 70, los: false }],
        // Ларьки: корпус (прилавок, стенки, стойки навеса) + ящик / мешки у правого переднего угла.
        'assets/models/props/stall_food.glb': [{ t: 'box', x: 2, y: 0, w: 378, d: 478 },
            { t: 'box', x: 205, y: -200, w: 56, d: 56, los: false }],
        'assets/models/props/stall_sell.glb': [{ t: 'box', x: 2, y: 0, w: 378, d: 478 },
            { t: 'box', x: 206, y: -182, w: 54, d: 89, los: false }],
        // Лидерборд: рамка с экраном + две лапы.
        'assets/models/props/leaderboard.glb': [{ t: 'box', x: -8, y: 0, w: 26, d: 434 },
            { t: 'box', x: -10, y: -145, w: 100, d: 36, los: false },
            { t: 'box', x: -10, y: 145, w: 100, d: 36, los: false }],
        // Заборы — тонкие коробки вдоль пролёта (низкие: видимость не закрывают).
        'assets/models/props/fence_wood.glb': fence,
        'assets/models/props/fence_metal.glb': fence,
        'assets/models/props/fence_post.glb': [{ t: 'box', x: 0, y: 0, w: 29, d: 29, los: false }],
        // Декор базы.
        'assets/models/props/bench.glb': [{ t: 'box', x: 0, y: 0, w: 62, d: 200, los: false }],
        'assets/models/props/lamp_post.glb': [{ t: 'circle', x: 0, y: 0, r: 28, los: false }],
        'assets/models/props/crate.glb': [{ t: 'box', x: 0, y: 0, w: 98, d: 92, los: false }],
        'assets/models/props/barrel.glb': [{ t: 'circle', x: 0, y: 0, r: 43, los: false }],
        'assets/models/props/flower_box.glb': [{ t: 'box', x: 0, y: 0, w: 68, d: 168, los: false }],
        'assets/models/props/trash_bin.glb': [{ t: 'box', x: 0, y: 0, w: 50, d: 50, los: false }],
        'assets/models/props/sign_arrow.glb': [{ t: 'box', x: 0, y: 0, w: 50, d: 50, los: false },
            { t: 'box', x: 5, y: 0, w: 134, d: 10, los: false }],
        // Арка въезда: только две стойки — дорожка между ними открыта.
        'assets/models/props/arch_gate.glb': [{ t: 'box', x: 0, y: -1200, w: 160, d: 160 },
            { t: 'box', x: 0, y: 1200, w: 160, d: 160 }],
    });
})();
