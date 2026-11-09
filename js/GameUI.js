// GameUI.js — интерфейс «Master Food Throw for Animals» (DOM поверх холста), по референсу: слева кнопки Index и
// Shop, справа Animals, внизу слева сила броска (рука) и деньги (пачка), снизу хотбар рюкзака; подсказка сверху
// («Buy new food», «Throw again»), зелёные плашки «Upgraded to …», карточка действия «[E] Buy».
// Окна: Animal Index (по зонам, силуэты), Shop (скины/шапки/спина/бусты), Food Shop, My Animals, новые турники.
// Подтягивания: STOP и полоса уровня; бросок: шкала силы, PERFECT, удача и зона в полёте, имя по буквам.
// Раскладка — HudLayout (блоки gui-*), тексты — Lang (ui.*). Игровую логику не держит: зовёт обработчики Game.

const GAME_UI_CSS = `
:root { --game-font: 'Nunito'; --ui-k: var(--hl-k, 1); }
#gui { position: fixed; inset: 0; pointer-events: none; z-index: 30; font-family: var(--game-font), system-ui, sans-serif; color: #fff; }
#gui * { box-sizing: border-box; }
#gui .pe { pointer-events: auto; }
.gtxt { font-weight: 900; color: #fff; paint-order: stroke fill; -webkit-text-stroke: calc(5px * var(--ui-k)) #1b1f2e; letter-spacing: .3px; }
.gstat { display: flex; align-items: center; gap: calc(8px * var(--ui-k)); height: calc(54px * var(--ui-k)); }
.gstat img { width: calc(50px * var(--ui-k)); height: calc(50px * var(--ui-k)); filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }
.gstat .v { font-size: calc(36px * var(--ui-k)); font-weight: 1000; -webkit-text-stroke: calc(6px * var(--ui-k)) #1b1f2e; paint-order: stroke fill; }
.gstat.power .v { color: #7fd8ff; } .gstat.money .v { color: #8dff6a; }
#gui-stats { display: flex; flex-direction: column; justify-content: flex-end; }
.gbtn { pointer-events: auto; cursor: pointer; position: relative; width: calc(78px * var(--ui-k)); height: calc(78px * var(--ui-k)); border-radius: calc(16px * var(--ui-k));
  background: linear-gradient(#3b4258, #22273a); border: calc(4px * var(--ui-k)) solid #11131c; box-shadow: 0 calc(4px * var(--ui-k)) 0 #0b0d14;
  display: flex; align-items: center; justify-content: center; transition: transform .08s; }
.gbtn:active { transform: translateY(2px) scale(.96); }
.gbtn img { width: 86%; height: 86%; object-fit: contain; margin-top: -14%; }
.gbtn .lb { position: absolute; bottom: calc(-2px * var(--ui-k)); left: 50%; transform: translateX(-50%); font-size: calc(18px * var(--ui-k)); font-weight: 1000;
  -webkit-text-stroke: calc(4px * var(--ui-k)) #11131c; paint-order: stroke fill; white-space: nowrap; }
.gbtn .dot { position: absolute; top: calc(-6px * var(--ui-k)); right: calc(-6px * var(--ui-k)); min-width: calc(24px * var(--ui-k)); height: calc(24px * var(--ui-k)); border-radius: 99px;
  background: #ff3b3b; border: calc(3px * var(--ui-k)) solid #fff; font-size: calc(13px * var(--ui-k)); font-weight: 900; display: none; align-items: center; justify-content: center; padding: 0 4px; }
.gbtn .dot.on { display: flex; }
.gbtn.small { width: calc(50px * var(--ui-k)); height: calc(50px * var(--ui-k)); border-radius: calc(12px * var(--ui-k)); }
.gbtn.small img { margin: 0; width: 70%; height: 70%; }
#gui-left, #gui-right { display: flex; flex-direction: column; gap: calc(14px * var(--ui-k)); align-items: center; justify-content: center; }
#gui-top { display: flex; gap: calc(8px * var(--ui-k)); justify-content: flex-end; }
#gui-hint { text-align: center; font-size: calc(30px * var(--ui-k)); }
#gui-hint .gtxt { display: inline-block; animation: ghint 1.6s ease-in-out infinite; }
@keyframes ghint { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
#gui-toasts { position: fixed; left: 50%; top: calc(var(--hl-gui-hint-y, 10px) + var(--hl-gui-hint-h, 40px) + 8px); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.gtoast { padding: calc(6px * var(--ui-k)) calc(22px * var(--ui-k)); border-radius: 10px; background: linear-gradient(#3fe04a, #1fae2e); border: calc(3px * var(--ui-k)) solid #0d4d14;
  font-size: calc(22px * var(--ui-k)); font-weight: 1000; -webkit-text-stroke: calc(3px * var(--ui-k)) #0d3d12; paint-order: stroke fill; animation: gtoast .25s ease-out; white-space: nowrap; }
.gtoast.red { background: linear-gradient(#ff5a5a, #d42a2a); border-color: #5a0c0c; -webkit-text-stroke-color: #5a0c0c; }
.gtoast.blue { background: linear-gradient(#4fb8ff, #1f7fd6); border-color: #0c2f5a; -webkit-text-stroke-color: #0c2f5a; }
@keyframes gtoast { from { transform: translateY(-10px) scale(.8); opacity: 0; } }
#gui-hotbar { display: flex; gap: calc(6px * var(--ui-k)); justify-content: center; align-items: flex-end; }
.ghot { width: calc(58px * var(--ui-k)); height: calc(58px * var(--ui-k)); border-radius: 10px; background: rgba(20,24,38,.8); border: calc(3px * var(--ui-k)) solid #0b0d14; position: relative; }
.ghot img { width: 100%; height: 100%; object-fit: contain; }
.ghot .inc { position: absolute; top: -2px; left: 0; right: 0; text-align: center; font-size: calc(11px * var(--ui-k)); font-weight: 900; color: #fff; -webkit-text-stroke: 2px #111; paint-order: stroke fill; }
.ghot .n { position: absolute; bottom: 0; left: 3px; font-size: calc(12px * var(--ui-k)); font-weight: 900; }
#gui-prompt { position: fixed; left: 50%; bottom: calc(var(--hl-gui-hotbar-b, 10px) + var(--hl-gui-hotbar-h, 60px) + 70px); transform: translateX(-50%); display: none;
  align-items: center; gap: 10px; padding: 8px 16px 8px 10px; border-radius: 12px; background: rgba(28,32,48,.88); border: 3px solid #0b0d14; pointer-events: auto; cursor: pointer; }
#gui-prompt.on { display: flex; }
#gui-prompt .key { width: 38px; height: 38px; border-radius: 8px; background: #fff; color: #1b1f2e; font-weight: 1000; font-size: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 0 #9aa3b5; }
#gui-prompt .t1 { font-size: 13px; color: #c9d1e6; font-weight: 800; line-height: 1; }
#gui-prompt .t2 { font-size: 20px; font-weight: 1000; line-height: 1.1; }
.hl-touch #gui-prompt .key { display: none; }
/* подтягивания */
#gui-pull { position: fixed; left: 50%; bottom: calc(var(--hl-gui-hotbar-b, 10px) + 8px); transform: translateX(-50%); display: none; flex-direction: column; align-items: center; gap: 10px; }
#gui-pull.on { display: flex; }
.gstop { pointer-events: auto; cursor: pointer; padding: 8px 40px; border-radius: 12px; background: linear-gradient(#ff5050, #d81f1f); border: 4px solid #4a0808; box-shadow: 0 4px 0 #4a0808;
  font-size: 28px; font-weight: 1000; -webkit-text-stroke: 4px #4a0808; paint-order: stroke fill; }
.glevel { width: min(460px, 86vw); height: 40px; border-radius: 10px; background: #1d2333; border: 4px solid #0b0d14; position: relative; overflow: hidden; }
.glevel .fill { position: absolute; inset: 0; width: 0; background: linear-gradient(#5fb6ff, #2a74d8); transition: width .2s; }
.glevel .tx { position: absolute; inset: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 12px; font-size: 22px; font-weight: 1000; -webkit-text-stroke: 4px #0b1530; paint-order: stroke fill; }
#gui-levelup { position: fixed; left: 50%; top: 14%; transform: translateX(-50%); text-align: center; pointer-events: none; }
#gui-levelup .l1 { font-size: calc(54px * var(--ui-k)); color: #ffe23a; -webkit-text-stroke: 7px #6b3d00; paint-order: stroke fill; font-weight: 1000; }
#gui-levelup .l2 { font-size: calc(26px * var(--ui-k)); color: #7fd8ff; -webkit-text-stroke: 5px #0b2a4a; paint-order: stroke fill; font-weight: 1000; }
.gpop { animation: gpop 1.6s ease-out forwards; }
@keyframes gpop { 0% { transform: scale(.4); opacity: 0; } 12% { transform: scale(1.12); opacity: 1; } 22% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-30px); } }
/* шкала броска */
#gui-meter { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none; pointer-events: auto; width: 100%; height: 100%; }
#gui-meter.on { display: block; cursor: pointer; }
#gui-meter .bar { position: absolute; left: calc(50% + 20px); top: 18%; width: 64px; height: 56%; border-radius: 32px; border: 6px solid #10131d;
  background: linear-gradient(#5fe36a 0%, #9be05c 30%, #f2d84a 55%, #f2954a 78%, #e24a3a 100%); box-shadow: 0 0 0 4px #fff, 0 6px 0 4px rgba(0,0,0,.3); }
#gui-meter .bar::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10%; border-bottom: 3px dashed rgba(255,255,255,.9); border-radius: 26px 26px 0 0; background: rgba(255,255,255,.2); }
#gui-meter .pin { position: absolute; left: -12px; right: -12px; height: 16px; border-radius: 8px; background: #fff; border: 4px solid #10131d; transform: translateY(-50%); }
#gui-meter .plus { position: absolute; left: calc(50% + 100px); font-size: 40px; font-weight: 1000; -webkit-text-stroke: 6px #10131d; paint-order: stroke fill; transform: translateY(-50%); }
#gui-meter .tap { position: absolute; left: 3vw; right: 3vw; bottom: 12%; text-align: center; font-size: min(calc(44px * var(--ui-k)), 7.2vw); line-height: 1.05; font-weight: 1000; -webkit-text-stroke: min(7px, 1.2vw) #10131d; paint-order: stroke fill; white-space: normal; animation: ghint 1s infinite; pointer-events: none; }
#gui-meterres { position: fixed; left: 50%; bottom: 14%; transform: translateX(-50%); text-align: center; pointer-events: none; }
#gui-meterres .p1 { font-size: calc(54px * var(--ui-k)); color: #8dff6a; -webkit-text-stroke: 7px #0d3d12; paint-order: stroke fill; font-weight: 1000; }
#gui-meterres .p2 { font-size: calc(34px * var(--ui-k)); color: #8dff6a; -webkit-text-stroke: 6px #0d3d12; paint-order: stroke fill; font-weight: 1000; }
/* полёт */
#gui-flight { position: fixed; left: 50%; top: 2%; transform: translateX(-50%); text-align: center; display: none; }
#gui-flight.on { display: block; }
#gui-flight .luck { font-size: calc(56px * var(--ui-k)); color: #ffe23a; -webkit-text-stroke: 7px #5a3500; paint-order: stroke fill; font-weight: 1000; line-height: 1; }
#gui-flight .lk { font-size: calc(18px * var(--ui-k)); font-weight: 1000; -webkit-text-stroke: 4px #1b1f2e; paint-order: stroke fill; }
#gui-flight .zone { margin-top: 8px; display: inline-block; padding: 4px 60px; background: linear-gradient(90deg, transparent, rgba(0,0,0,.45), transparent); font-size: calc(32px * var(--ui-k)); font-weight: 1000; -webkit-text-stroke: 5px #1b1f2e; paint-order: stroke fill; }
/* раскрытие */
#gui-tapcatch { position: fixed; inset: 0; display: none; pointer-events: auto; cursor: pointer; }
#gui-tapcatch.on { display: block; }
#gui-reveal { position: fixed; left: 50%; bottom: 7%; transform: translateX(-50%); text-align: center; display: none; pointer-events: auto; cursor: pointer; width: 96vw; }
#gui-reveal.on { display: block; }
#gui-reveal .mut { font-size: calc(24px * var(--ui-k)); font-weight: 1000; color: #ffe14a; -webkit-text-stroke: 5px #3d2a00; paint-order: stroke fill; }
#gui-reveal .nm { font-size: calc(60px * var(--ui-k)); font-weight: 1000; letter-spacing: 4px; -webkit-text-stroke: 8px #1b1f2e; paint-order: stroke fill; line-height: 1.05; }
#gui-reveal .inc { font-size: calc(30px * var(--ui-k)); font-weight: 1000; color: #fff; -webkit-text-stroke: 5px #1b1f2e; paint-order: stroke fill; }
#gui-reveal .rar { font-size: calc(20px * var(--ui-k)); font-weight: 1000; -webkit-text-stroke: 4px #1b1f2e; paint-order: stroke fill; }
#gui-reveal .cont { font-size: calc(16px * var(--ui-k)); font-weight: 900; color: #fff; -webkit-text-stroke: 3px #1b1f2e; paint-order: stroke fill; opacity: .9; margin-top: 4px; }
#gui-reveal .new { display: inline-block; position: relative; top: -20px; margin-left: 10px; padding: 2px 12px; border-radius: 10px; background: linear-gradient(#ffd23f, #ff9a1a); border: 4px solid #5a2a00; transform: rotate(-12deg);
  font-size: calc(30px * var(--ui-k)); font-weight: 1000; -webkit-text-stroke: 4px #5a2a00; paint-order: stroke fill; vertical-align: top; }
/* окна */
#gui-shade { position: fixed; inset: 0; background: rgba(10,14,28,.35); display: none; pointer-events: auto; }
#gui-shade.on { display: block; }
.gwin { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(820px, 94vw); max-height: 86vh; display: none; flex-direction: column;
  background: #1b1f2c; border: 6px solid #0b0d14; border-radius: 18px; box-shadow: 0 10px 0 rgba(0,0,0,.35); pointer-events: auto; overflow: hidden; }
.gwin.on { display: flex; animation: gwin .18s ease-out; }
@keyframes gwin { from { transform: translate(-50%, -46%) scale(.92); opacity: 0; } }
.gwin .hd { display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 18px; background: linear-gradient(90deg, #e43ac6, #b62ad8); border-bottom: 5px solid #0b0d14; }
.gwin.orange .hd { background: linear-gradient(90deg, #ffb52a, #ff8a1a); }
.gwin.green .hd { background: linear-gradient(90deg, #3fd04a, #1fa83a); }
.gwin .hd .tt { font-size: 34px; font-weight: 1000; -webkit-text-stroke: 5px #2a0b33; paint-order: stroke fill; flex: 1; white-space: nowrap; }
.gwin .hd .chip { display: flex; align-items: center; gap: 6px; padding: 2px 12px; border-radius: 10px; background: rgba(0,0,0,.25); font-size: 20px; font-weight: 1000; -webkit-text-stroke: 3px #1b1f2e; paint-order: stroke fill; }
.gwin .hd .chip img { width: 26px; height: 26px; }
.gclose { width: 50px; height: 50px; border-radius: 10px; background: linear-gradient(#ff4a4a, #d41f1f); border: 4px solid #3d0606; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 1000; flex: none; }
.gclose::before { content: '✕'; color: #fff; -webkit-text-stroke: 2px #3d0606; }
.gwin .bd { overflow-y: auto; padding: 12px; flex: 1; scrollbar-width: thin; }
.gwin .ft { padding: 10px 14px; background: #141826; border-top: 4px solid #0b0d14; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 24px; font-weight: 1000; }
.gtabs { display: flex; gap: 8px; padding: 8px 12px 0; background: #1b1f2c; flex-wrap: wrap; }
.gtab { padding: 6px 14px; border-radius: 10px 10px 0 0; background: #2b3146; border: 3px solid #0b0d14; border-bottom: 0; cursor: pointer; font-weight: 1000; font-size: 18px; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; }
.gtab.on { background: linear-gradient(#ffd23f, #ff9a1a); }
.gzone { display: flex; gap: 10px; margin-bottom: 12px; }
.gzone .zc { width: 120px; flex: none; border-radius: 12px; border: 4px solid #0b0d14; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; text-align: center; }
.gzone .zc .zn { font-size: 20px; font-weight: 1000; -webkit-text-stroke: 4px #11131c; paint-order: stroke fill; line-height: 1.05; }
.gzone .zc .zi { font-size: 13px; font-weight: 900; margin-top: 4px; -webkit-text-stroke: 2px #11131c; paint-order: stroke fill; }
.gzone .grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.gcell { border-radius: 10px; border: 4px solid #0b0d14; aspect-ratio: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.gcell img { width: 82%; height: 72%; object-fit: contain; }
.gcell.unk img { filter: brightness(0) opacity(.85); }
.gcell .q { position: absolute; top: 2px; left: 0; right: 0; text-align: center; font-weight: 1000; font-size: 15px; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; }
.gcell .cn { font-size: 13px; font-weight: 1000; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; line-height: 1; text-align: center; padding: 0 2px; }
.gzone .cnt { grid-column: 1 / -1; text-align: center; background: #12151f; border-radius: 10px; padding: 4px; font-size: 18px; font-weight: 1000; }
.gcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.gcard { border-radius: 12px; border: 4px solid #0b0d14; background: linear-gradient(#f3f5fa, #c9cfdc); color: #1b1f2e; display: flex; flex-direction: column; align-items: center; padding: 8px 6px 6px; position: relative; }
.gcard .cn { font-size: 20px; font-weight: 1000; color: #fff; -webkit-text-stroke: 4px #1b1f2e; paint-order: stroke fill; text-align: center; line-height: 1.05; }
.gcard .cr { font-size: 13px; font-weight: 900; color: #fff; -webkit-text-stroke: 3px #1b1f2e; paint-order: stroke fill; }
.gcard img { width: 100px; height: 100px; object-fit: contain; margin: 4px 0; }
.gcard .tier { width: 100%; text-align: center; background: #3a4052; color: #fff; border-radius: 8px; font-weight: 1000; font-size: 16px; padding: 2px; -webkit-text-stroke: 3px #1b1f2e; paint-order: stroke fill; }
.gcard .st { font-size: 13px; font-weight: 900; color: #2a3045; margin: 2px 0; display: flex; align-items: center; gap: 2px; }
.gcard .st img, img.ilk { width: 18px; height: 18px; vertical-align: middle; }
.gbuy { pointer-events: auto; cursor: pointer; width: 100%; margin-top: 6px; padding: 6px 4px; border-radius: 10px; border: 4px solid #5a2a00; background: linear-gradient(#ffd23f, #ff9a1a); text-align: center;
  font-size: 20px; font-weight: 1000; color: #fff; -webkit-text-stroke: 4px #5a2a00; paint-order: stroke fill; display: flex; align-items: center; justify-content: center; gap: 6px; }
.gbuy img { width: 22px; height: 22px; }
.gbuy.green { background: linear-gradient(#5fe36a, #22b13a); border-color: #0d4d14; -webkit-text-stroke-color: #0d4d14; }
.gbuy.blue { background: linear-gradient(#5fb8ff, #1f7fd6); border-color: #0c2f5a; -webkit-text-stroke-color: #0c2f5a; }
.gbuy.red { background: linear-gradient(#ff5a5a, #d42a2a); border-color: #5a0c0c; -webkit-text-stroke-color: #5a0c0c; }
.gbuy.gray, .gbuy.dis { background: linear-gradient(#8a90a2, #626879); border-color: #2a2e3a; -webkit-text-stroke-color: #2a2e3a; }
.gbuy.dis { opacity: .75; cursor: default; }
.grow { display: flex; align-items: center; gap: 10px; padding: 6px; margin-bottom: 8px; border-radius: 12px; background: #0f121b; border: 3px solid #2b3146; }
.grow img { width: 60px; height: 60px; border-radius: 10px; background: #2f8a3a; object-fit: contain; flex: none; }
.grow .info { flex: 1; min-width: 0; }
.grow .n1 { font-size: 20px; font-weight: 1000; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grow .n0 { font-size: 12px; font-weight: 1000; color: #ffe14a; }
.grow .n2 { font-size: 15px; font-weight: 900; color: #8dff6a; }
.grow .acts { display: flex; flex-direction: column; gap: 4px; width: 100px; flex: none; }
.grow .acts .gbuy { margin: 0; font-size: 16px; padding: 3px; }
.gsec { font-size: 20px; font-weight: 1000; margin: 4px 2px 8px; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; }
.gsec b { color: #ffe23a; }
.gempty { text-align: center; padding: 40px 10px; font-size: 20px; font-weight: 900; color: #cfd6e6; }
#gwin-animals { left: auto; right: calc(var(--hl-gui-right-r, 10px) + var(--hl-gui-right-w, 80px) + 14px); transform: translateY(-50%); width: min(420px, 92vw); }
@keyframes gwinr { from { transform: translate(20px, -50%); opacity: 0; } }
#gwin-animals.on { animation: gwinr .18s ease-out; }
.gbig { font-size: 30px !important; padding: 10px !important; }
.gboost { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 14px; border: 4px solid #0b0d14; margin-bottom: 10px; background: linear-gradient(#4fb8ff, #2a7fe0); }
.gboost.purple { background: linear-gradient(#b65cff, #7a2ad8); }
.gboost.green { background: linear-gradient(#5fe36a, #22b13a); }
.gboost img { width: 84px; height: 84px; object-fit: contain; flex: none; background: rgba(255,255,255,.25); border-radius: 50%; padding: 8px; }
.gboost .bt { flex: 1; font-size: 22px; font-weight: 1000; -webkit-text-stroke: 4px #11131c; paint-order: stroke fill; line-height: 1.1; }
.gboost .bs { font-size: 15px; font-weight: 900; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; }
.gboost .gbuy { width: 160px; flex: none; margin: 0; }
#gui-newbar { position: fixed; left: 50%; top: 6%; transform: translateX(-50%); width: min(460px, 92vw); display: none; pointer-events: auto; border-radius: 14px; background: #1b1f2c; border: 5px solid #0b0d14; overflow: hidden; }
#gui-newbar.on { display: block; animation: gwinr .2s ease-out; }
#gui-newbar .hd { background: linear-gradient(90deg, #2a8ae0, #2a5ad8); padding: 4px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 22px; font-weight: 1000; -webkit-text-stroke: 4px #0b1530; paint-order: stroke fill; }
#gui-newbar .gclose { width: 34px; height: 34px; font-size: 20px; }
#gui-newbar .bd { display: flex; gap: 10px; padding: 8px; align-items: center; }
#gui-newbar img { width: 76px; height: 76px; object-fit: contain; background: #2a5a8a; border-radius: 10px; }
#gui-newbar .t1 { font-size: 14px; font-weight: 900; color: #cfd6e6; }
#gui-newbar .t2 { font-size: 26px; font-weight: 1000; -webkit-text-stroke: 4px #11131c; paint-order: stroke fill; }
#gui-newbar .t3 { font-size: 15px; font-weight: 900; color: #8dff6a; }
#gui-newbar .gbuy { width: 130px; margin: 0; }
/* меню и настройки */
#gui-menu { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; pointer-events: auto; overflow: hidden;
  background: radial-gradient(ellipse at 50% 42%, rgba(255,214,90,.28), rgba(40,20,80,.15) 45%, rgba(8,12,30,.78) 100%); }
#gui-menu.on { display: flex; }
#gui.menu-on > :not(#gui-menu) { visibility: hidden; }
body.menu-on #glabels { visibility: hidden; }
#gui-menu .rays { position: absolute; left: 50%; top: 40%; width: 240vmax; height: 240vmax; transform: translate(-50%, -50%); pointer-events: none;
  background: repeating-conic-gradient(rgba(255,236,140,.20) 0deg 9deg, rgba(255,255,255,0) 9deg 18deg);
  -webkit-mask-image: radial-gradient(circle, #000 0, #000 9%, transparent 34%); mask-image: radial-gradient(circle, #000 0, #000 9%, transparent 34%); animation: grays 60s linear infinite; }

#gui-menu .box { position: relative; text-align: center; padding: 10px; }
#gui-menu .gbuy.play { width: min(340px, 78vw); margin: min(3.5vh, 26px) auto 0; font-size: min(40px, 8vh); padding: min(12px, 2vh); border-radius: 18px; animation: gplay 1.4s ease-in-out infinite;
  box-shadow: 0 6px 0 #0d4d14, 0 0 0 0 rgba(141,255,106,.6); }
@keyframes gplay { 0%, 100% { transform: scale(1); box-shadow: 0 6px 0 #0d4d14, 0 0 0 0 rgba(141,255,106,.55); } 50% { transform: scale(1.05); box-shadow: 0 6px 0 #0d4d14, 0 0 0 16px rgba(141,255,106,0); } }
.gset { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border-radius: 12px; background: #0f121b; margin-bottom: 8px; font-size: 22px; font-weight: 1000; }
.gset .opts { display: flex; gap: 6px; flex-wrap: wrap; }
.gset .opts .gbuy { width: auto; padding: 4px 12px; font-size: 16px; margin: 0; }
.hl-low .gwin { max-height: 94vh; }
.hl-low .gwin .hd .tt { font-size: 24px; }
.hl-tall #gui-meter .bar { left: calc(50% + 40px); }
/* реклама */
.adbtn { background: linear-gradient(#b86bff, #7a2ad8) !important; border-color: #2e0b55 !important; -webkit-text-stroke-color: #2e0b55 !important; flex-wrap: wrap; line-height: 1.05; }
.adbtn img { width: 34px !important; height: 34px !important; margin: -4px 0 !important; filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }
.adbtn .adt { width: 100%; font-size: .9em; }
.adbtn .adl { font-size: .72em; }
.adbtn.dis { filter: grayscale(.6); }
.gcard .adbtn, .grow .adbtn { font-size: 15px; }
#gui-boosts { display: flex; flex-wrap: wrap; gap: 6px; }
.gchip { display: flex; align-items: center; gap: 4px; padding: 2px 10px 2px 4px; border-radius: 99px; background: rgba(20,24,38,.85); border: 3px solid #0b0d14; font-size: calc(16px * var(--ui-k)); font-weight: 1000; }
.gchip img { width: calc(26px * var(--ui-k)); height: calc(26px * var(--ui-k)); }
#gui-offer { width: calc(170px * var(--ui-k)); border-radius: 14px; background: linear-gradient(#2b3150, #1b1f2c); border: 4px solid #0b0d14; padding: 8px 6px 6px; text-align: center; display: none; box-shadow: 0 5px 0 rgba(0,0,0,.35); }
#gui-offer.on { display: block; pointer-events: auto; animation: gwino .2s ease-out; }
@keyframes gwino { from { transform: translateY(14px); opacity: 0; } }
#gui-offer img.oi { width: calc(56px * var(--ui-k)); height: calc(56px * var(--ui-k)); }
#gui-offer .ot { font-size: calc(16px * var(--ui-k)); font-weight: 1000; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; line-height: 1.05; }
#gui-offer .gbuy { font-size: calc(14px * var(--ui-k)); padding: 4px; }
#gui-offer .x { position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; z-index: 1; border-radius: 50%; background: #d42a2a; border: 3px solid #3d0606; cursor: pointer; font-weight: 1000; font-size: 14px; display: flex; align-items: center; justify-content: center; }
.gadrow { display: flex; gap: 8px; justify-content: center; margin-top: 8px; flex-wrap: wrap; }
.gadrow .gbuy { width: auto; min-width: 190px; font-size: 18px; margin: 0; }
#gui-pull .gadrow .gbuy { min-width: 0; }
.gdays { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
.gday { border-radius: 12px; border: 4px solid #0b0d14; background: linear-gradient(#4a5168, #2b3146); padding: 6px; text-align: center; min-height: 130px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.gday.today { background: linear-gradient(#ffd23f, #ff9a1a); }
.gday.claimed { opacity: .55; }
.gday.d7 { background: linear-gradient(#ff5fb8, #b62ad8); grid-column: span 2; }
.gday .dn { font-weight: 1000; font-size: 18px; -webkit-text-stroke: 3px #11131c; paint-order: stroke fill; }
.gday img { width: 56px; height: 56px; object-fit: contain; }
.gday .dr { font-size: 13px; font-weight: 900; -webkit-text-stroke: 2px #11131c; paint-order: stroke fill; line-height: 1.1; }
.wh-wrap { position: relative; display: flex; flex-direction: column; align-items: center; padding: 4px 0 2px; overflow: hidden; }
.wh-rays { position: absolute; left: 50%; top: 45%; width: 900px; height: 900px; transform: translate(-50%, -50%); pointer-events: none;
  background: repeating-conic-gradient(rgba(255,220,90,.16) 0deg 10deg, rgba(255,255,255,0) 10deg 20deg); -webkit-mask-image: radial-gradient(circle, #000 0, transparent 60%); mask-image: radial-gradient(circle, #000 0, transparent 60%); animation: grays 40s linear infinite; }
.gwheel { position: relative; width: min(360px, 74vw, 50vh); aspect-ratio: 1; margin: 18px auto 10px; }
.gwheel .rim { position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(circle, #8a4a00 60%, #ffcf3a 63%, #ffe98a 66%, #e09a10 70%, #8a4a00 72%); box-shadow: 0 8px 0 rgba(0,0,0,.35), 0 0 30px rgba(255,200,60,.45); }
.gwheel .bulb { position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px; border-radius: 50%; background: #fff6c8; box-shadow: 0 0 8px #ffe23a, 0 0 2px #fff; animation: whbulb 1s steps(1) infinite; }
.gwheel .bulb:nth-child(2n) { animation-delay: .5s; }
.gwheel.spin .bulb { animation-duration: .25s; }
@keyframes whbulb { 0% { opacity: 1; } 50% { opacity: .25; } }
.gwheel .disk { position: absolute; inset: 0; border-radius: 50%; border: 6px solid #3a1d00; overflow: hidden; will-change: transform; }
.gwheel .disk::after { content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, rgba(255,255,255,.35) 0, rgba(255,255,255,0) 45%, rgba(0,0,0,.18) 100%); }
.gwheel .sep { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
.gwheel .lab { position: absolute; left: 50%; top: 50%; width: 50%; height: 48px; margin-top: -24px; transform-origin: 0 50%; display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding-right: 9%;
  font-size: 19px; font-weight: 1000; color: #fff; -webkit-text-stroke: 4px #2a1206; paint-order: stroke fill; }
.gwheel .lab img { width: 42px; height: 42px; object-fit: contain; filter: drop-shadow(0 2px 0 rgba(0,0,0,.35)); }
.gwheel .lab.win { animation: whwin .5s ease-in-out infinite alternate; }
@keyframes whwin { from { filter: brightness(1); } to { filter: brightness(1.6) drop-shadow(0 0 8px #fff); } }
.gwheel .ptr { position: absolute; left: 50%; top: -30px; width: 46px; height: 58px; transform: translateX(-50%); z-index: 3; transform-origin: 50% 20%;
  background: linear-gradient(#ff6a5a, #c8160c); clip-path: polygon(50% 100%, 0 30%, 15% 0, 85% 0, 100% 30%); filter: drop-shadow(0 4px 0 #3a0a06); }
.gwheel .ptr::after { content: ''; position: absolute; left: 50%; top: 14px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #ffe98a; }
.gwheel.tick .ptr { animation: whtick .09s ease-out; }
@keyframes whtick { 50% { transform: translateX(-50%) rotate(-12deg); } }
.gwheel .hub { position: absolute; left: 50%; top: 50%; width: 24%; height: 24%; transform: translate(-50%, -50%); border-radius: 50%; z-index: 2;
  background: radial-gradient(circle at 35% 30%, #fff6b0, #ffd23f 40%, #e08a00 100%); border: 6px solid #6b3a00; box-shadow: 0 4px 0 rgba(0,0,0,.35), inset 0 -6px 0 rgba(0,0,0,.15); display: flex; align-items: center; justify-content: center; }
.gwheel .hub img { width: 62%; height: 62%; object-fit: contain; }
.wh-prize { min-height: 52px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 26px; font-weight: 1000; color: #ffe23a; -webkit-text-stroke: 5px #2a1206; paint-order: stroke fill; text-align: center; }
.wh-prize img { width: 48px; height: 48px; object-fit: contain; }
.wh-prize.pop { animation: gpop2 .5s ease-out; }
@keyframes gpop2 { 0% { transform: scale(.3); opacity: 0; } 70% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
.wh-conf { position: absolute; left: 50%; top: 45%; width: 10px; height: 14px; pointer-events: none; border-radius: 2px; animation: whconf 1.4s ease-out forwards; }
@keyframes whconf { from { transform: translate(0, 0) rotate(0); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) rotate(720deg); opacity: 0; } }
.wh-wrap .gadrow .gbuy { min-width: 220px; font-size: 22px; padding: 10px 14px; }
.goffers .gboost .gbuy { width: 190px; }
`;

/** @satisfies {Record<string, any>} */
const GameUI = {
    /** @type {any} */ h: null,      // обработчики Game
    /** @type {any} */ game: null,
    open_: '',
    shopTab: 'boosts',
    _promptAct: null,

    init(game, handlers) {
        this.game = game; this.h = handlers;
        const st = document.createElement('style'); st.textContent = GAME_UI_CSS; document.head.appendChild(st);
        const root = document.createElement('div'); root.id = 'gui';
        const I = (n) => GameAssets.img('icon', n);
        root.innerHTML = `
<div id="gui-stats"><div class="gstat power"><img src="${I('power')}" alt=""><span class="v" id="g-power">18</span></div>
  <div class="gstat money"><img src="${I('cash')}" alt=""><span class="v" id="g-money">$0</span></div></div>
<div id="gui-left"><div class="gbtn" data-a="index"><img src="${I('index')}" alt=""><span class="lb" data-t="ui.index"></span><span class="dot" id="g-dot-index"></span></div>
  <div class="gbtn" data-a="shop"><img src="${I('shop')}" alt=""><span class="lb" data-t="ui.shop"></span><span class="dot" id="g-dot-shop"></span></div>
  <div class="gbtn" data-a="daily"><img src="${I('gift')}" alt=""><span class="lb" data-t="ui.gift"></span><span class="dot" id="g-dot-daily"></span></div></div>
<div id="gui-right"><div class="gbtn" data-a="animals"><img src="${I('animals')}" alt=""><span class="lb" data-t="ui.animals"></span><span class="dot" id="g-dot-animals"></span></div>
  <div class="gbtn" data-a="wheel"><img src="${I('wheel')}" alt=""><span class="lb" data-t="ui.wheel"></span><span class="dot" id="g-dot-wheel"></span></div>
  <div class="gbtn" data-a="offers"><img src="${I('watch_ad')}" alt=""><span class="lb" data-t="ui.offers"></span></div>
</div>
<div id="gui-offer"></div>
<div id="gui-boosts"></div>
<div id="gui-top"><div class="gbtn small" data-a="settings"><img src="${I('gear')}" alt=""></div></div>
<div id="gui-hint"><span class="gtxt" id="g-hint"></span></div>
<div id="gui-toasts"></div>
<div id="gui-hotbar"></div>
<div id="gui-prompt"><div class="key">E</div><div><div class="t1" id="g-pr1"></div><div class="t2" id="g-pr2"></div></div><div id="g-prad" style="width:200px"></div></div>
<div id="gui-pull"><div class="gadrow pe" id="g-pullad"></div><div class="gstop" data-a="stop" data-t="ui.stop"></div><div class="glevel"><div class="fill" id="g-lvfill"></div><div class="tx"><span id="g-lv"></span><span id="g-lvxp"></span></div></div></div>
<div id="gui-levelup"></div>
<div id="gui-meter" data-a="throwTap"><div class="bar"><div class="pin" id="g-pin"></div></div><div class="plus" id="g-plus">+0</div><div class="tap" data-t="ui.tapThrow"></div><div id="g-super" style="position:absolute;left:4%;top:40%;width:min(230px,40vw)"></div></div>
<div id="gui-meterres"></div>
<div id="gui-flight"><div class="luck" id="g-luck">1.00X</div><div class="lk" data-t="ui.luck"></div><div><span class="zone" id="g-zone"></span></div></div>
<div id="gui-tapcatch" data-a="continue"></div>
<div id="gui-reveal"></div>
<div id="gui-newbar"></div>
<div id="gui-shade"></div>
<div class="gwin" id="gwin-index"><div class="hd"><div class="tt" data-t="ui.animalIndex"></div><div class="gclose" data-a="close"></div></div><div class="bd" id="g-index"></div><div class="ft" id="g-indexft"></div></div>
<div class="gwin orange" id="gwin-shop"><div class="hd"><div class="tt" data-t="ui.shop"></div><div class="chip"><img src="${I('gems')}" alt=""><span id="g-gems">0</span></div><div class="gclose" data-a="close"></div></div><div class="gtabs" id="g-shoptabs"></div><div class="bd" id="g-shop"></div></div>
<div class="gwin" id="gwin-food"><div class="hd"><div class="tt" data-t="ui.foodShop"></div><div class="chip"><img src="${I('cash')}" alt=""><span id="g-fmoney">$0</span></div><div class="gclose" data-a="close"></div></div><div class="bd" id="g-food"></div></div>
<div class="gwin" id="gwin-animals"><div class="hd"><div class="tt" data-t="ui.myAnimals"></div><div class="chip"><img src="${I('animals')}" alt=""><span id="g-acount">0/10</span></div><div class="gclose" data-a="close"></div></div><div class="bd" id="g-animals"></div><div class="ft"><div class="gbuy gbig" data-a="equipBest" data-t="ui.equipBest"></div></div></div>
<div class="gwin" id="gwin-offers"><div class="hd"><div class="tt" data-t="ui.offersTitle"></div><div class="gclose" data-a="close"></div></div><div class="bd goffers" id="g-offers"></div></div>
<div class="gwin orange" id="gwin-daily"><div class="hd"><div class="tt" data-t="ui.dailyTitle"></div><div class="gclose" data-a="close"></div></div><div class="bd" id="g-daily"></div></div>
<div class="gwin" id="gwin-wheel"><div class="hd"><div class="tt" data-t="ui.wheelTitle"></div><div class="chip"><img src="${I('gems')}" alt=""><span id="g-gems2">0</span></div><div class="gclose" data-a="close"></div></div><div class="bd" id="g-wheel"></div></div>
<div class="gwin green" id="gwin-settings"><div class="hd"><div class="tt" data-t="ui.settings"></div><div class="gclose" data-a="close"></div></div><div class="bd" id="g-settings"></div></div>
<div id="gui-menu"><div class="rays"></div><div class="box">${this.logoHtml()}<div class="gbuy green play" data-a="play" data-t="ui.play"></div></div></div>`;
        document.body.appendChild(root);
        this.root = root;
        root.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
        root.addEventListener('click', (e) => this._click(e));
        this.applyLang();
        HudLayout.block('gui-stats', { dock: 'bl', w: 240, h: 116, el: '#gui-stats', order: 1 });
        HudLayout.block('gui-left', { dock: 'ml', w: 84, h: 280, el: '#gui-left' });
        HudLayout.block('gui-right', { dock: 'mr', w: 84, h: 280, el: '#gui-right' });
        HudLayout.block('gui-boosts', { dock: 'tl', w: 260, h: 36, el: '#gui-boosts' });
        HudLayout.block('gui-offer', { dock: 'br', w: 176, h: 'auto', el: '#gui-offer', order: 2 });
        HudLayout.block('gui-top', { dock: 'tr', w: 56, h: 56, el: '#gui-top' });
        HudLayout.block('gui-hint', { dock: 'tc', w: 520, h: 44, el: '#gui-hint', fill: true });
        HudLayout.block('gui-hotbar', { dock: 'bc', w: 380, h: 64, el: '#gui-hotbar' });
        HudLayout.refresh();
    },

    applyLang() { for (const el of this.root.querySelectorAll('[data-t]')) el.textContent = Lang.t(el.getAttribute('data-t')); },

    _click(e) {
        const t = /** @type {HTMLElement} */ (e.target).closest('[data-a]');
        if (!t) return;
        const a = t.getAttribute('data-a'), arg = t.getAttribute('data-id');
        if (t.classList.contains('dis')) { sfx('error', { volume: 0.4 }); return; }
        sfx('click', { volume: 0.5 });
        if (a === 'close') { this.close(); return; }
        if (a === 'tab') { this.shopTab = arg || 'boosts'; this.renderShop(); return; }
        if (this.h[a]) this.h[a](arg, t);
        if (this.h.uiClick) this.h.uiClick(a);
    },

    // --- HUD ---------------------------------------------------------------------------------------
    stats(power, money) {
        const p = document.getElementById('g-power'), m = document.getElementById('g-money');
        if (p) p.textContent = Econ.short(power);
        if (m) m.textContent = Econ.money(money);
        const fm = document.getElementById('g-fmoney'); if (fm) fm.textContent = Econ.money(money);
    },
    gems(n) { const g = document.getElementById('g-gems'); if (g) g.textContent = Econ.short(n); },
    dot(which, n) {
        const d = document.getElementById('g-dot-' + which);
        if (!d) return;
        d.textContent = n > 9 ? '9+' : String(n || '');
        d.classList.toggle('on', !!n);
    },
    hint(text) {
        const el = document.getElementById('g-hint');
        if (el && el.textContent !== text) el.textContent = text || '';
    },
    toast(text, color, ms) {
        const box = document.getElementById('gui-toasts');
        if (!box) return;
        const el = document.createElement('div');
        el.className = 'gtoast ' + (color || '');
        el.textContent = text;
        box.appendChild(el);
        while (box.children.length > 3) box.removeChild(box.firstChild);
        setTimeout(() => el.remove(), ms || 2200);
    },
    hotbar(list) {
        const el = document.getElementById('gui-hotbar');
        if (!el) return;
        const key = list.map(a => a.uid).join(',');
        if (el.dataset.k === key) return;
        el.dataset.k = key;
        el.innerHTML = list.slice(0, 8).map((a, i) => `<div class="ghot"><img src="${GameAssets.img('animalIcon', a.id)}" alt=""><div class="inc">${perSec(Econ.income(a.id, a.muts))}</div><div class="n">${i + 1}</div></div>`).join('');
        HudLayout.refresh();
    },
    prompt(t1, t2, act, adKey, adText) {
        const el = document.getElementById('gui-prompt');
        if (!el) return;
        const ad = document.getElementById('g-prad');
        if (ad) {
            const k = (adKey || '') + '|' + (adText || '');
            if (ad.dataset.k !== k) { ad.dataset.k = k; ad.innerHTML = adKey ? GameAds.button(adKey, '', adText || '') : ''; }
            ad.style.display = adKey && ad.innerHTML ? 'block' : 'none';
        }
        if (!t2) { el.classList.remove('on'); this._promptAct = null; return; }
        el.classList.add('on');
        const a = document.getElementById('g-pr1'), b = document.getElementById('g-pr2');
        if (a) a.textContent = t1 || '';
        if (b) b.textContent = t2;
        el.setAttribute('data-a', 'prompt');
        el.querySelectorAll('.key, .t1, .t2').forEach(x => x.setAttribute('data-a', 'prompt'));
        this._promptAct = act || null;
    },

    // --- подтягивания ---------------------------------------------------------------------------
    pull(on) {
        const el = document.getElementById('gui-pull'); if (el) el.classList.toggle('on', !!on);
        const ad = document.getElementById('g-pullad'); if (ad) ad.innerHTML = on ? GameAds.button('levels', '', Lang.t('ads.levels')) : '';
    },
    level(level, xp, need) {
        const f = document.getElementById('g-lvfill'), l = document.getElementById('g-lv'), x = document.getElementById('g-lvxp');
        if (f) f.style.width = (Math.min(1, xp / need) * 100).toFixed(1) + '%';
        if (l) l.textContent = Lang.t('ui.level', { n: level });
        if (x) x.textContent = Econ.short(xp) + '/' + Econ.short(need);
    },
    levelUp(ups, power) {
        const el = document.getElementById('gui-levelup');
        if (!el) return;
        el.innerHTML = `<div class="gpop"><div class="l1">${Lang.t('ui.levelUp')}</div><div class="l2">${Lang.t('ui.throwPower', { n: Econ.short(power) })}</div></div>`;
        void ups;
    },

    // --- бросок -----------------------------------------------------------------------------------
    meter(on) {
        const el = document.getElementById('gui-meter'); if (el) el.classList.toggle('on', !!on);
        if (on) { const r = document.getElementById('gui-meterres'); if (r) r.innerHTML = ''; }
        const sp = document.getElementById('g-super');
        if (sp) sp.innerHTML = !on ? '' : this.game.save.superThrow ? '<div class="gtoast" style="animation:none">' + Lang.t('ads.superOn') + '</div>' : GameAds.button('super_throw', '', Lang.t('ads.superThrow'));
    },
    meterValue(v, bonus) {
        const pin = document.getElementById('g-pin'), plus = document.getElementById('g-plus');
        const top = (1 - v) * 100;
        if (pin) pin.style.top = top.toFixed(2) + '%';
        if (plus) {
            plus.textContent = '+' + bonus;
            const bar = /** @type {HTMLElement} */ (document.querySelector('#gui-meter .bar'));
            if (bar) { const r = bar.getBoundingClientRect(); plus.style.top = (r.top + r.height * (1 - v)).toFixed(1) + 'px'; plus.style.left = (r.right + 16).toFixed(1) + 'px'; }
            plus.style.color = v >= (typeof METER_PERFECT !== 'undefined' ? METER_PERFECT : 0.9) ? '#8dff6a' : v > 0.5 ? '#ffe23a' : '#ff8a5a';
        }
    },
    meterResult(perfect, bonus) {
        const el = document.getElementById('gui-meterres');
        if (!el) return;
        el.innerHTML = `<div class="gpop">${perfect ? `<div class="p1">${Lang.t('ui.perfect')}</div>` : ''}<div class="p2">${Lang.t('ui.plusPower', { n: bonus })}</div></div>`;
    },
    flight(on) { const el = document.getElementById('gui-flight'); if (el) el.classList.toggle('on', !!on); },
    flightInfo(luck, zone) {
        const l = document.getElementById('g-luck'), z = document.getElementById('g-zone');
        if (l) l.textContent = luck.toFixed(2) + 'X';
        if (z) {
            const Z = GAME_DATA.ZONES[zone];
            z.textContent = Z ? (Lang.code === 'ru' ? Z.ru : Z.en) : '';
            z.style.color = Z ? Z.theme.ground[0] : '#fff';
            z.style.visibility = Z ? 'visible' : 'hidden';
        }
    },
    revealName(masked) {
        const el = document.getElementById('gui-reveal');
        if (!el) return;
        el.classList.add('on');
        el.removeAttribute('data-a');
        el.innerHTML = `<div class="nm" style="color:#fff">${masked}</div>`;
    },
    /** r = { id, muts, isNew, income, rarity, name } | null — убрать. */
    reveal(r) {
        const el = document.getElementById('gui-reveal');
        if (!el) return;
        const tc = document.getElementById('gui-tapcatch'); if (tc) tc.classList.toggle('on', !!r);
        if (!r) { el.classList.remove('on'); el.innerHTML = ''; return; }
        const R = Econ.rarity(r.rarity);
        const muts = (r.muts || []).map(m => { const d = Econ.mutation(m); return d ? (Lang.code === 'ru' ? d.ru : d.en) : ''; }).filter(Boolean).join(' ');
        el.setAttribute('data-a', 'continue');
        el.innerHTML = `${muts ? `<div class="mut">${muts}</div>` : ''}<div><span class="nm" style="color:${R.color}">${r.name}</span>${r.isNew ? `<span class="new">${Lang.t('ui.new')}</span>` : ''}</div>
<div class="rar" style="color:${R.color}">${Lang.code === 'ru' ? R.ru : R.en}</div><div class="inc">${perSec(r.income)}</div>
<div class="gadrow">${r.gold ? '' : GameAds.button('gold_catch', '', Lang.t('ads.gold'))}${r.double ? '' : GameAds.button('double_catch', '', Lang.t('ads.double'))}</div><div class="cont">${Lang.t('ui.tapContinue')}</div>`;
    },

    newBar(bar, price, xp) {
        const el = document.getElementById('gui-newbar');
        if (!el) return;
        if (!bar) { el.classList.remove('on'); return; }
        el.innerHTML = `<div class="hd"><span>${Lang.t('ui.newEquipment')}</span><div class="gclose" data-a="closeNewBar"></div></div>
<div class="bd"><img src="${GameAssets.img('barIcon', bar.id)}" alt=""><div style="flex:1"><div class="t1">${Lang.t('ui.canBuy')}</div><div class="t2">${Lang.code === 'ru' ? bar.ru : bar.en}</div><div class="t3">${Econ.money(price)} · ${Lang.t('ui.xpRep', { n: xp })}</div></div>
<div style="display:flex;flex-direction:column;gap:4px"><div class="gbuy green" data-a="buyBar">${Lang.t('ui.upgrade')}</div>${GameAds.button('bar:' + this.game.save.bar, '', '')}</div></div>`;
        el.classList.add('on');
    },

    // --- окна ---------------------------------------------------------------------------------------
    openWin(name) {
        this.close(true);
        this.open_ = name;
        const w = document.getElementById('gwin-' + name);
        if (w) w.classList.add('on');
        const shade = document.getElementById('gui-shade');
        if (shade && name !== 'animals') shade.classList.add('on');
        if (name === 'index') this.renderIndex();
        if (name === 'shop') this.renderShop();
        if (name === 'food') this.renderFood();
        if (name === 'animals') this.renderAnimals();
        if (name === 'settings') this.renderSettings();
        if (name === 'offers') this.renderOffers();
        if (name === 'daily') this.renderDaily();
        if (name === 'wheel') this.renderWheel();
        this.offerCard(null);
        sfx('open', { volume: 0.5 });
        if (this.h.onOpen) this.h.onOpen(name);
    },
    close(silent) {
        if (!this.open_) return;
        const w = document.getElementById('gwin-' + this.open_);
        if (w) w.classList.remove('on');
        const shade = document.getElementById('gui-shade'); if (shade) shade.classList.remove('on');
        const was = this.open_;
        this.open_ = '';
        if (!silent && this.h.onClose) this.h.onClose(was);
    },
    refresh() {
        if (this.open_ === 'offers') this.renderOffers();
        if (this.open_ === 'daily') this.renderDaily();
        if (this.open_ === 'shop') this.renderShop();
        if (this.open_ === 'food') this.renderFood();
        if (this.open_ === 'animals') this.renderAnimals();
    },

    renderIndex() {
        const s = this.game.save, box = document.getElementById('g-index');
        if (!box) return;
        let total = 0, got = 0, html = '';
        GAME_DATA.ZONES.forEach((Z, zi) => {
            const list = GAME_DATA.ANIMALS[zi];
            const n = list.filter(a => s.index[a[0]]).length;
            total += list.length; got += n;
            const locked = zi > (s.bestZone | 0) + 1;
            html += `<div class="gzone"><div class="zc" style="background:linear-gradient(${Z.theme.ground[0]},${Z.theme.wall[1]})"><div class="zn">${Lang.code === 'ru' ? Z.ru : Z.en}</div><div class="zi">${Lang.t('ui.zoneN', { n: zi + 1 })}${locked ? ' <img class="ilk" src="' + GameAssets.img('icon', 'lock') + '" alt="">' : ''}</div></div><div class="grid">`;
            for (const a of list) {
                const R = Econ.rarity(a[3]), known = !!s.index[a[0]];
                html += `<div class="gcell ${known ? '' : 'unk'}" style="background:linear-gradient(${R.color},${R.dark})" title="${known ? (Lang.code === 'ru' ? a[2] : a[1]) : '???'}">
<div class="q">${known ? '' : '???'}</div><img src="${GameAssets.img('animalIcon', a[0])}" alt="" loading="lazy"><div class="cn">${known ? (Lang.code === 'ru' ? a[2] : a[1]) : ''}</div></div>`;
            }
            html += `<div class="cnt">${n}/${list.length}</div></div></div>`;
        });
        box.innerHTML = html;
        const ft = document.getElementById('g-indexft');
        if (ft) ft.innerHTML = `<img src="${GameAssets.img('icon', 'index')}" alt="" style="width:40px;height:40px"> ${Lang.t('ui.unlocked', { n: got, m: total })}`;
    },

    renderShop() {
        const g = this.game, s = g.save, box = document.getElementById('g-shop'), tabs = document.getElementById('g-shoptabs');
        if (!box || !tabs) return;
        this.gems(s.gems);
        const T = [['boosts', 'ui.tabBoosts'], ['mythic', 'ui.tabMythic'], ['outfit', 'ui.tabSkins'], ['hat', 'ui.tabHats'], ['back', 'ui.tabBack']];
        tabs.innerHTML = T.map(([id, key]) => `<div class="gtab ${this.shopTab === id ? 'on' : ''}" data-a="tab" data-id="${id}">${Lang.t(key)}</div>`).join('');
        const gemImg = `<img src="${GameAssets.img('icon', 'gems')}" alt="">`;
        if (this.shopTab === 'boosts') {
            const B = g.boostDefs();
            let html = '';
            for (const b of B) {
                const own = !!s.boosts[b.id];
                const btn = own ? `<div class="gbuy gray dis">${Lang.t('ui.owned')}</div>` : `<div class="gbuy ${s.gems >= b.gems ? 'green' : 'dis'}" data-a="buyBoost" data-id="${b.id}">${gemImg}${Econ.short(b.gems)}</div>`;
                html += `<div class="gboost ${b.color}"><img src="${GameAssets.img('icon', b.icon)}" alt=""><div style="flex:1"><div class="bt">${Lang.t(b.title)}</div><div class="bs">${Lang.t(b.desc)}</div></div>${btn}</div>`;
            }
            html += this.offerRows(['boost_cash', 'boost_xp', 'boost_luck', 'boost_speed', 'free_gems', 'mystery']);
            const free = !s.freeAnimal;
            html += `<div class="gsec">${Lang.t('ui.freeItem')}</div><div class="gboost green"><img src="${GameAssets.img('animalIcon', 'hyena')}" alt=""><div style="flex:1"><div class="bt">${Lang.t('ui.freeAnimal')}</div><div class="bs">${Lang.t('ui.freeAnimalDesc')} · ${perSec(Econ.income('hyena', ['big']))}</div></div>
${free ? `<div class="gbuy green" data-a="claimFree">${Lang.t('ui.claim')}</div>` : `<div class="gbuy gray dis">${Lang.t('ui.claimed')}</div>`}</div>`;
            box.innerHTML = html;
            return;
        }
        const items = SKIN_ITEMS.filter(it => it.tab === this.shopTab && !DAILY_EXCLUSIVE.includes(it.id));
        if (!items.length) { box.innerHTML = `<div class="gempty">${Lang.t('ui.soon')}</div>`; return; }
        const RC = { common: '#9aa3b5', rare: '#3fa3ff', epic: '#b45cff', legendary: '#ffa630', mythic: '#ff5fb8' };
        let html = '<div class="gcards">';
        for (const it of items) {
            const slot = it.tab === 'mythic' ? 'outfit' : it.tab;
            const own = !!s.owned[it.id] || it.default;
            const on = s.equip[slot] === it.id || (!s.equip[slot] && it.default);
            let btn;
            if (on) btn = slot === 'outfit' ? `<div class="gbuy gray dis">${Lang.t('ui.equipped')}</div>` : `<div class="gbuy gray" data-a="unequip" data-id="${it.id}">${Lang.t('ui.unequip')}</div>`;
            else if (own) btn = `<div class="gbuy blue" data-a="equip" data-id="${it.id}">${Lang.t('ui.equip')}</div>`;
            else btn = (it.ads ? GameAds.button('skin:' + it.id, '', '') : '') + `<div class="gbuy ${s.gems >= it.gems ? '' : 'dis'}" data-a="buySkin" data-id="${it.id}">${gemImg}${Econ.short(it.gems)}</div>`;
            const col = RC[it.rarity] || '#9aa3b5';
            html += `<div class="gcard" style="background:linear-gradient(#f3f5fa, ${col})"><div class="cn">${Lang.code === 'ru' ? it.name.ru : it.name.en}</div><div class="cr" style="color:${col}">${Lang.t('rar.' + it.rarity)}</div>
<img src="${GameAssets.img('skinIcon', it.id)}" alt="" loading="lazy">${btn}</div>`;
        }
        box.innerHTML = html + '</div>';
    },

    renderFood() {
        const s = this.game.save, box = document.getElementById('g-food');
        if (!box) return;
        let html = '<div class="gcards">';
        GAME_DATA.FOODS.forEach((f, i) => {
            const R = Econ.rarity(f.rarity), own = !!s.foods[f.id], on = s.food === f.id;
            const prevOwned = i === 0 || !!s.foods[GAME_DATA.FOODS[i - 1].id];
            let btn;
            if (on) btn = `<div class="gbuy gray dis">${Lang.t('ui.equipped')}</div>`;
            else if (own) btn = `<div class="gbuy green" data-a="equipFood" data-id="${f.id}">${Lang.t('ui.equip')}</div>`;
            else if (!prevOwned) btn = `<div class="gbuy gray dis"><img src="${GameAssets.img('icon', 'lock')}" alt="">${Econ.money(f.price)}</div>`;
            else btn = `<div class="gbuy ${s.money >= f.price ? '' : 'dis'}" data-a="buyFood" data-id="${f.id}">${Econ.money(f.price)}</div>` + GameAds.button('food:' + f.id, '', '');
            html += `<div class="gcard" style="background:linear-gradient(#f3f5fa, ${R.color})"><div class="cn">${Lang.code === 'ru' ? f.ru : f.en}</div><div class="cr" style="color:${R.color}">${Lang.code === 'ru' ? R.ru : R.en}</div>
<img src="${GameAssets.img('foodIcon', f.id)}" alt="" loading="lazy"><div class="st"><img src="${GameAssets.img('icon', 'power')}" alt="">+${Econ.short(f.power)} <img src="${GameAssets.img('icon', 'luck')}" alt="">×${f.luck}</div><div class="tier">${Lang.t('ui.tier', { n: f.tier })}</div>${btn}</div>`;
        });
        box.innerHTML = html + '</div>';
        const fm = document.getElementById('g-fmoney'); if (fm) fm.textContent = Econ.money(s.money);
    },

    renderAnimals() {
        const g = this.game, s = g.save, box = document.getElementById('g-animals');
        if (!box) return;
        const cap = Econ.capacity(s.cap).slots;
        const c = document.getElementById('g-acount'); if (c) c.textContent = s.plot.length + '/' + cap;
        if (!s.plot.length && !s.backpack.length) { box.innerHTML = `<div class="gempty">${Lang.t('ui.noAnimals')}</div>`; return; }
        const row = (a, where) => {
            const info = Econ.animal(a.id), R = Econ.rarity(info ? info.rarity : 'common');
            const muts = (a.muts || []).map(m => { const d = Econ.mutation(m); return d ? (Lang.code === 'ru' ? d.ru : d.en) : ''; }).filter(Boolean).join(' ');
            const nm = info ? (Lang.code === 'ru' ? info.ru : info.en) : a.id;
            const act = where === 'plot' ? `<div class="gbuy blue" data-a="pickUp" data-id="${a.uid}">${Lang.t('ui.pickUp')}</div>` : `<div class="gbuy green" data-a="place" data-id="${a.uid}">${Lang.t('ui.equip')}</div>`;
            return `<div class="grow"><img src="${GameAssets.img('animalIcon', a.id)}" alt="" style="background:linear-gradient(${R.color},${R.dark})"><div class="info">${muts ? `<div class="n0">${muts}</div>` : ''}<div class="n1" style="color:${R.color}">${nm}</div><div class="n2">${perSec(Econ.income(a.id, a.muts))}</div></div>
<div class="acts">${act}<div class="gbuy red" data-a="sell" data-id="${a.uid}">${Lang.t('ui.sell')} ${Econ.money(Econ.sellPrice(a.id, a.muts))}</div></div></div>`;
        };
        let html = s.backpack.length ? `<div class="gadrow" style="margin:0 0 10px">${GameAds.button('sell_x2', '', Lang.t('ads.sellX2', { p: Econ.money(2 * s.backpack.reduce((v, x) => v + Econ.sellPrice(x.id, x.muts), 0)) }))}</div>` : '';
        html += `<div class="gsec">${Lang.t('ui.onPlot')} <b>${s.plot.length}/${cap}</b></div>` + s.plot.map(a => row(a, 'plot')).join('');
        html += `<div class="gsec">${Lang.t('ui.backpack')} <b>${s.backpack.length}</b></div>` + s.backpack.map(a => row(a, 'bag')).join('');
        box.innerHTML = html;
    },

    renderSettings() {
        const box = document.getElementById('g-settings');
        if (!box) return;
        const q = typeof Quality !== 'undefined' ? (Quality.choice || 'auto') : 'auto';
        const qb = (id) => `<div class="gbuy ${q === id ? 'green' : 'gray'}" data-a="quality" data-id="${id}">${Lang.t('ui.q.' + id)}</div>`;
        box.innerHTML = `<div class="gset"><span>${Lang.t('ui.sound')}</span><div class="opts"><div class="gbuy ${Sound.muted ? 'gray' : 'green'}" data-a="sound">${Sound.muted ? Lang.t('ui.off') : Lang.t('ui.on')}</div></div></div>
<div class="gset"><span>${Lang.t('ui.graphics')}</span><div class="opts">${qb('auto')}${qb('low')}${qb('medium')}${qb('high')}</div></div>
<div class="gset"><span>${Lang.t('tut.howto')}</span><div class="opts"><div class="gbuy blue" data-a="howto">▶</div></div></div>`;
    },

    // --- реклама: предложения, подарок дня, колесо ---------------------------------------------------
    OFFER_INFO: {
        boost_cash: ['ads.o.cash.t', 'ads.o.cash.d'], boost_xp: ['ads.o.xp.t', 'ads.o.xp.d'], boost_luck: ['ads.o.luck.t', 'ads.o.luck.d'],
        boost_speed: ['ads.o.speed.t', 'ads.o.speed.d'], free_cash: ['ads.o.freecash.t', 'ads.o.freecash.d'], free_gems: ['ads.o.gems.t', 'ads.o.gems.d'],
        mystery: ['ads.o.mystery.t', 'ads.o.mystery.d'], super_throw: ['ads.o.super.t', 'ads.o.super.d'], levels: ['ads.o.levels.t', 'ads.o.levels.d'],
    },
    offerVars() {
        const g = this.game;
        return {
            m: typeof ADS_BOOST_MIN !== 'undefined' ? ADS_BOOST_MIN : 5, cash: Econ.money(g.cashGift(typeof ADS_CASH_MIN !== 'undefined' ? ADS_CASH_MIN : 5)),
            gems: typeof ADS_GEMS !== 'undefined' ? ADS_GEMS : 40, left: GameAds.gemsLeft(), zone: g.zoneName(Math.min(Econ.zoneCount() - 1, (g.save.bestZone | 0) + 1)),
        };
    },
    offerRows(keys) {
        if (!GameAds.available()) return '';
        const v = this.offerVars();
        return keys.map((k) => {
            const o = GameAds.OFFERS[k], inf = this.OFFER_INFO[k], bk = GameAds.BOOST_KEYS[k];
            const left = bk ? GameAds.boostLeft(bk) : 0;
            const sub = left > 0 ? Lang.t('ads.active', { t: this.time(left) }) : Lang.t(inf[1], v);
            return `<div class="gboost ${o.color}"><img src="${GameAssets.img('icon', o.icon)}" alt=""><div style="flex:1"><div class="bt">${Lang.t(inf[0], v)}</div><div class="bs">${sub}</div></div>${GameAds.button(k, '', '')}</div>`;
        }).join('');
    },
    renderOffers() {
        const box = document.getElementById('g-offers');
        if (!box) return;
        box.innerHTML = GameAds.available() ? this.offerRows(['free_cash', 'boost_cash', 'boost_xp', 'boost_luck', 'boost_speed', 'super_throw', 'levels', 'mystery', 'free_gems'])
            : `<div class="gempty">${Lang.t('ads.none')}</div>`;
    },
    time(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); },
    /** Карточка-предложение у правой колонки (key или null). */
    offerCard(key) {
        const el = document.getElementById('gui-offer');
        if (!el) return;
        if (!key || !GameAds.available()) { el.classList.remove('on'); el.dataset.k = ''; HudLayout.refresh(); return; }
        const o = GameAds.OFFERS[key], inf = this.OFFER_INFO[key];
        el.innerHTML = `<div class="x" data-a="offerClose">✕</div><img class="oi" src="${GameAssets.img('icon', o.icon)}" alt=""><div class="ot">${Lang.t(inf[0], this.offerVars())}</div>${GameAds.button(key, '', '')}`;
        el.dataset.k = key;
        el.classList.add('on');
        HudLayout.refresh();
    },
    /** Значки активных бустов с таймером: [{ icon, text, left }]. */
    boosts(list) {
        const el = document.getElementById('gui-boosts');
        if (!el) return;
        const html = list.map(b => `<div class="gchip"><img src="${GameAssets.img('icon', b.icon)}" alt="">${b.text} ${this.time(b.left)}</div>`).join('');
        if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
    },
    /** Раз в секунду паузы rewarded: подписи «Через N с» и активность кнопок за рекламу. */
    adTick() {
        if (!this.root) return;
        for (const b of this.root.querySelectorAll('.adbtn[data-id]')) {
            const key = b.getAttribute('data-id') || '';
            const l = b.querySelector('.adl');
            if (l) l.textContent = GameAds.label(key);
            else { const img = b.querySelector('img'); b.textContent = GameAds.label(key); if (img) b.prepend(img); }
            b.classList.toggle('dis', GameAds.cooldown() > 0 || GameAds.busy || (key === 'free_gems' && GameAds.gemsLeft() <= 0));
        }
        if (this.open_ === 'daily') this.renderDaily();
        if (this.open_ === 'wheel' && !this._spinning) this.renderWheel();
    },
    specialIcon(id) { return ({ cash5: 'money_bag', boost_xp: 'power', boost_cash: 'cash', boost_luck: 'luck', boost_speed: 'shoe', mystery: 'question' })[id] || ''; },
    renderDaily() {
        const box = document.getElementById('g-daily');
        if (!box || typeof DailyGift === 'undefined') return;
        const v = DailyGift.view();
        let html = '<div class="gdays">';
        (v.days || []).forEach((d, i) => {
            const r = d.reward || {}, ex = r.exclusive || '';
            const sp = r.item ? this.specialIcon(r.item) : '';
            const img = ex ? GameAssets.img('skinIcon', ex) : sp ? GameAssets.img('icon', sp) : r.item ? GameAssets.img('skinIcon', r.item) : r.randomItems ? GameAssets.img('icon', 'sparkles') : GameAssets.img('icon', 'gems');
            const lines = [];
            if (r.coins) lines.push('<img class="ilk" src="' + GameAssets.img('icon', 'gems') + '" alt="">' + r.coins);
            if (r.item) lines.push(GameAds.rewardName(r.item));
            if (r.randomItems) lines.push(Lang.t('reward.randomItem'));
            if (ex) lines.push(GameAds.rewardName(ex));
            html += `<div class="gday ${d.state || ''} ${i === 6 ? 'd7' : ''}"><div class="dn">${Lang.t('daily.day', { n: i + 1 })}</div><img src="${img}" alt=""><div class="dr">${lines.join('<br>')}</div></div>`;
        });
        html += '</div><div class="gadrow">';
        if (v.canClaim) {
            html += `<div class="gbuy green" data-a="dailyClaim">${Lang.t('daily.claim')}</div>`;
            if (v.x2 && GameAds.available()) html += `<div class="gbuy adbtn ${v.x2.enabled ? '' : 'dis'}" data-a="dailyX2"><img src="${GameAssets.img('icon', 'watch_ad')}" alt="">${v.x2.label || Lang.t('daily.claimX2')}</div>`;
        } else html += `<div class="gbuy gray dis">${v.nextLabel || Lang.t('daily.claimed')}</div>`;
        box.innerHTML = html + '</div>';
    },
    _wheelAngle: 0,
    _spinning: false,
    _wheelPrize: '',
    /** Значок и подпись сектора колеса. */
    wheelPrizeView(sc) {
        const dd = sc.data || {}, item = dd.item || sc.itemId || '', sp = item ? this.specialIcon(item) : '';
        const img = sc.coins ? GameAssets.img('icon', 'gems') : dd.randomItem && !item ? GameAssets.img('icon', 'sparkles') : sp ? GameAssets.img('icon', sp) : item ? GameAssets.img('skinIcon', item) : GameAssets.img('icon', 'gift');
        const label = sc.coins ? '+' + sc.coins : item ? GameAds.rewardName(item) : Lang.t('reward.randomItem');
        return { img, label, short: sc.coins ? String(sc.coins) : '' };
    },
    renderWheel() {
        const box = document.getElementById('g-wheel');
        if (!box || typeof Wheel === 'undefined') return;
        const g2 = document.getElementById('g-gems2'); if (g2) g2.textContent = Econ.short(this.game.save.gems);
        const secs = Wheel.sectors(), n = secs.length, st = Wheel.status(), step = 360 / n;
        const cols = ['#ff4d6d', '#ff9f1c', '#ffd23f', '#3fd36b', '#2ec4d6', '#3a8bff', '#a35cff', '#ff5fb8'];
        const grad = 'from ' + (-step / 2).toFixed(3) + 'deg, ' + secs.map((_, i) => cols[i % cols.length] + ' ' + (i * step).toFixed(2) + 'deg ' + ((i + 1) * step).toFixed(2) + 'deg').join(',');
        const sep = 'repeating-conic-gradient(from ' + (-step / 2 - 0.6).toFixed(3) + 'deg, rgba(42,18,6,.9) 0deg 1.2deg, rgba(0,0,0,0) 1.2deg ' + step.toFixed(3) + 'deg)';
        const labs = secs.map((sc, i) => {
            const v = this.wheelPrizeView(sc), ang = i * step - 90;
            return '<div class="lab" data-i="' + i + '" style="transform:rotate(' + ang.toFixed(2) + 'deg)">' + v.short + '<img src="' + v.img + '" alt=""></div>';
        }).join('');
        let bulbs = '';
        for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; bulbs += '<i class="bulb" style="transform:translate(' + (Math.cos(t) * 50).toFixed(2) + '%,' + (Math.sin(t) * 50).toFixed(2) + '%) translate(calc(' + (Math.cos(t) * 100).toFixed(1) + '% * 0 + ' + (Math.cos(t)).toFixed(3) + ' * (min(360px, 74vw, 50vh) / 2 + 7px)), calc(' + (Math.sin(t)).toFixed(3) + ' * (min(360px, 74vw, 50vh) / 2 + 7px)))"></i>'; }
        let btns = '<div class="gbuy green ' + (st.canSpinFree && !this._spinning ? '' : 'dis') + '" data-a="wheelFree">' + (st.freeLabel || Lang.t('wheel.free')) + '</div>';
        if (GameAds.available()) btns += '<div class="gbuy adbtn ' + (st.canSpinAd && !this._spinning ? '' : 'dis') + '" data-a="wheelAd"><img src="' + GameAssets.img('icon', 'watch_ad') + '" alt="">' + (st.adLabel || '') + '</div>';
        const keepPrize = this._wheelPrize || '';
        box.innerHTML = '<div class="wh-wrap"><div class="wh-rays"></div><div class="gwheel" id="g-gwheel"><div class="rim"></div>' + bulbs +
            '<div class="disk" id="g-disk" style="transform:rotate(' + this._wheelAngle.toFixed(2) + 'deg)"><div class="sep" style="background:conic-gradient(' + grad + ')"></div><div class="sep" style="background:' + sep + '"></div>' + labs + '</div>' +
            '<div class="hub"><img src="' + GameAssets.img('icon', 'xp') + '" alt=""></div><div class="ptr"></div></div>' +
            '<div class="wh-prize" id="g-whprize">' + keepPrize + '</div><div class="gadrow" id="g-whbtns">' + btns + '</div></div>';
    },
    /** Крутить диск до angle (градусы по часовой) за ms (JS-анимация с щелчками по секторам), затем done(). */
    spinWheel(angle, ms, done) {
        this._spinning = true;
        this._wheelPrize = '';
        this.renderWheel();
        const disk = document.getElementById('g-disk'), wheel = document.getElementById('g-gwheel');
        if (wheel) wheel.classList.add('spin');
        const n = typeof Wheel !== 'undefined' ? Wheel.sectors().length : 8, step = 360 / n;
        const from = this._wheelAngle, to = angle, t0 = performance.now();
        let lastSector = Math.floor(from / step);
        const ease = (x) => 1 - Math.pow(1 - x, 4);
        const frame = (now) => {
            const k = Math.min(1, (now - t0) / ms), cur = from + (to - from) * ease(k);
            this._wheelAngle = cur;
            if (disk) disk.style.transform = 'rotate(' + cur.toFixed(2) + 'deg)';
            const sec = Math.floor(cur / step);
            if (sec !== lastSector) {
                lastSector = sec;
                sfx('tick', { volume: 0.35, rate: 0.9 + Math.random() * 0.2 });
                if (wheel) { wheel.classList.remove('tick'); void wheel.offsetWidth; wheel.classList.add('tick'); }
            }
            if (k < 1) requestAnimationFrame(frame);
            else {
                this._wheelAngle = to % 360;
                if (disk) disk.style.transform = 'rotate(' + this._wheelAngle.toFixed(2) + 'deg)';
                if (wheel) wheel.classList.remove('spin');
                this._spinning = false;
                done();
            }
        };
        requestAnimationFrame(frame);
    },
    /** Выигрыш: подсветить сектор, подпись приза, конфетти. */
    wheelWin(index) {
        const secs = typeof Wheel !== 'undefined' ? Wheel.sectors() : [];
        const sc = secs[index];
        if (sc) {
            const v = this.wheelPrizeView(sc);
            this._wheelPrize = '<img src="' + v.img + '" alt="">' + Lang.t('wheel.win') + ' ' + v.label;
        }
        this.renderWheel();
        const lab = document.querySelector('#g-disk .lab[data-i="' + index + '"]'); if (lab) lab.classList.add('win');
        const pz = document.getElementById('g-whprize'); if (pz) { pz.classList.remove('pop'); void pz.offsetWidth; pz.classList.add('pop'); }
        const wrap = document.querySelector('#g-wheel .wh-wrap');
        if (wrap) {
            const cols = ['#ff4d6d', '#ffd23f', '#3fd36b', '#3a8bff', '#a35cff', '#ff9f1c'];
            for (let i = 0; i < 36; i++) {
                const c = document.createElement('i');
                c.className = 'wh-conf';
                const ang = Math.random() * Math.PI * 2, d = 120 + Math.random() * 220;
                c.style.background = cols[i % cols.length];
                c.style.setProperty('--dx', (Math.cos(ang) * d).toFixed(0) + 'px');
                c.style.setProperty('--dy', (Math.sin(ang) * d - 60).toFixed(0) + 'px');
                c.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
                wrap.appendChild(c);
                setTimeout(() => c.remove(), 1700);
            }
        }
    },

    /** Логотип стартового экрана: объёмные буквы, лента, летающая еда и звери. */
    logoHtml() {
        const PK = String(GAME_PLATFORM) === 'pikabu';   // Пикабу: название только по-русски
        const word = (text, cls, fills, ol, tilt) => '<div class="w ' + cls + '">' + [...text].map((c, i) => {
            const f = fills[i % fills.length], r = tilt ? ((i % 2 ? 1 : -1) * tilt) + 'deg' : '0deg';
            return '<span class="ch" data-c="' + c + '" style="--fill:' + f + ';--ol:' + ol + ';--r:' + r + ';animation-delay:' + (i * 0.12).toFixed(2) + 's"><b>' + c + '</b></span>';
        }).join('') + '</div>';
        const gold = 'linear-gradient(#fff6b0 0%, #ffd93a 45%, #ff9f1a 100%)';
        const food = ['linear-gradient(#ffd27a 0%, #ff8a1a 48%, #e2520c 100%)', 'linear-gradient(#ff9a9a 0%, #ff3b3b 50%, #b81414 100%)',
            'linear-gradient(#fff7a8 0%, #ffe23a 50%, #e6a800 100%)', 'linear-gradient(#c8ff8a 0%, #5fe36a 48%, #1f9a2e 100%)'];
        const blue = ['linear-gradient(#e8fbff 0%, #7fd8ff 40%, #2a8ae0 100%)', 'linear-gradient(#f4eaff 0%, #c79bff 42%, #7a2ad8 100%)'];
        const I = (k, id) => GameAssets.img(k, id);
        const deco = (k, id, css, a, d) => '<img class="deco" src="' + I(k, id) + '" alt="" style="' + css + ';--a:' + a + 'deg;animation-delay:' + d + 's">';
        const spark = (css, d) => '<img class="spark" src="' + I('icon', 'sparkles') + '" alt="" style="' + css + ';animation-delay:' + d + 's">';
        return '<div class="glogo">' +
            deco('foodIcon', 'carrot', 'left:-14%;top:4%;width:min(15vw,17vh,130px)', -25, 0) +
            deco('foodIcon', 'apple', 'right:-12%;top:-2%;width:min(13vw,15vh,112px)', 15, 0.6) +
            deco('foodIcon', 'banana', 'right:-17%;top:40%;width:min(13vw,15vh,110px)', 20, 1.1) +
            deco('foodIcon', 'donut', 'left:-17%;top:46%;width:min(11vw,13vh,96px)', -10, 1.6) +
            deco('animalIcon', 'lion', 'left:-10%;bottom:-22%;width:min(17vw,20vh,150px)', -6, 0.3) +
            deco('animalIcon', 'fire_dragon', 'right:-12%;bottom:-24%;width:min(19vw,22vh,170px);--sx:-1', -6, 0.9) +
            spark('left:8%;top:-6%', 0) + spark('right:10%;top:22%', 0.7) + spark('left:44%;bottom:6%', 1.2) +
            '<div class="w w1"><span class="plate">' + word(PK ? 'БРОСЬ' : 'MASTER', '', [gold], '#2a1600', 0).replace('<div class="w ">', '').replace(/<\/div>$/, '') + '</span></div>' +
            word(PK ? 'ЕДУ' : 'FOOD', 'w2', food, '#2a1000', 4) +
            (PK ? '' : word('THROW', 'w3', blue, '#0b1c4a', 3)) +
            '<div><span class="ribbon"><img src="' + I('icon', 'animals') + '" alt="">' + (PK ? 'ловля зверей' : 'for Animals') + '<img src="' + I('icon', 'animals') + '" alt=""></span></div>' +
            '</div>';
    },

    menu(on) {
        const m = document.getElementById('gui-menu'); if (m) m.classList.toggle('on', !!on);
        if (this.root) this.root.classList.toggle('menu-on', !!on);
        document.body.classList.toggle('menu-on', !!on);
    },
};
