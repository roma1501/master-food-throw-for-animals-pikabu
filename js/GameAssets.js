// GameAssets.js — пути к моделям, иконкам и звукам игры по id. Таблицу литералов (GAME_ASSET_LIST) пишет
// tools/gen-asset-list.mjs в js/GameAssetList.js: сборщик берёт в архив только ассеты, упомянутые литералом.
// Нет записи в таблице (файл добавили, список не перегенерировали) — путь собирается из частей (работает
// в разработке, в архив такой файл не попадёт: после новых ассетов — node tools/gen-asset-list.mjs).

/** @satisfies {Record<string, any>} */
const GameAssets = {
    /** вид -> [папка, расширение] */
    KINDS: {
        animal: ['models/animals/', '.glb'],
        animalIcon: ['ui/animals/', '.webp'],
        clips: ['models/animals/clips_', '.glb'],
        food: ['models/food/', '.glb'],
        foodIcon: ['ui/food/', '.webp'],
        bar: ['models/props/bar_', '.glb'],
        barIcon: ['ui/bars/', '.webp'],
        prop: ['models/props/', '.glb'],
        skin: ['models/skins/', '.glb'],
        skinIcon: ['ui/skins/', '.webp'],
        hat: ['models/hats/', '.glb'],
        back: ['models/back/', '.glb'],
        icon: ['ui/icons/', '.webp'],
        fx: ['ui/fx/', '.webp'],
    },

    table() { return typeof GAME_ASSET_LIST !== 'undefined' ? GAME_ASSET_LIST : {}; },

    /** Путь ассета вида kind с id, либо null, если файла заведомо нет (таблица есть, а записи нет). */
    path(kind, id) {
        const t = this.table(), k = this.KINDS[kind];
        if (!k) return null;
        if (t[kind]) return t[kind][id] || null;
        return 'assets/' + k[0] + id + k[1];
    },

    /** <img src> для иконки: путь или прозрачная пустышка. */
    img(kind, id) { return this.path(kind, id) || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='; },

    sound(name) {
        const t = this.table();
        if (t.sound) return t.sound[name] || null;
        return 'assets/' + 'sounds/' + name + '.ogg';
    },
};

/** Звук игры по имени (или списку имён — случайный вариант без повтора). Нет файла — тишина. */
function sfx(name, opts) {
    const list = [].concat(name).map((n) => GameAssets.sound(n)).filter(Boolean);
    if (!list.length) return null;
    try { return Sound.play(list.length > 1 ? list : list[0], opts || {}); } catch (e) { return null; }
}

/** Доход в секунду на языке игрока: $12/с · $12/s. */
function perSec(v) { return Econ.money(v) + Lang.t('ui.perSec'); }
