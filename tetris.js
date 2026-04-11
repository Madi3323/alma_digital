// =============================================================================
// tetris.js — Классический Тетрис на Canvas
// Встроен в страницу как «Зона отдыха для клиентов»
// Управление: ← → (движение), ↑ (поворот), ↓ (ускорение), Пробел (hard drop)
// =============================================================================

// ─────────────────────────────────────────────
// КОНСТАНТЫ
// ─────────────────────────────────────────────

const T_COLS  = 10;      // Ширина игрового поля (в клетках)
const T_ROWS  = 20;      // Высота поля
const T_BLOCK = 28;      // Размер одной клетки (px)
const T_NEXT_BLOCK = 22; // Размер клетки в превью

// Описание всех 7 тетромино: форма (матрица) + цвет
const T_PIECES = {
  I: { color: '#00d4ff', shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { color: '#ffd700', shape: [[1,1],[1,1]] },
  T: { color: '#b44fff', shape: [[0,1,0],[1,1,1],[0,0,0]] },
  S: { color: '#2ecc71', shape: [[0,1,1],[1,1,0],[0,0,0]] },
  Z: { color: '#e74c3c', shape: [[1,1,0],[0,1,1],[0,0,0]] },
  J: { color: '#3498db', shape: [[1,0,0],[1,1,1],[0,0,0]] },
  L: { color: '#f0a500', shape: [[0,0,1],[1,1,1],[0,0,0]] },
};

const T_KEYS = Object.keys(T_PIECES);

// Таблица очков за N одновременно очищенных линий (умножается на уровень)
const T_SCORE = { 1: 100, 2: 300, 3: 500, 4: 800 };

// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ CANVAS
// ─────────────────────────────────────────────

const tCanvas = document.getElementById('tetrisCanvas');
const tCtx    = tCanvas ? tCanvas.getContext('2d') : null;

const nCanvas = document.getElementById('nextCanvas');
const nCtx    = nCanvas ? nCanvas.getContext('2d') : null;

if (tCanvas) {
  tCanvas.width  = T_COLS  * T_BLOCK;
  tCanvas.height = T_ROWS  * T_BLOCK;
}
if (nCanvas) {
  nCanvas.width  = 4 * T_NEXT_BLOCK;
  nCanvas.height = 4 * T_NEXT_BLOCK;
}

// ─────────────────────────────────────────────
// СОСТОЯНИЕ ИГРЫ
// ─────────────────────────────────────────────

let tBoard;        // 2D-массив зафиксированных блоков: null | цвет
let tCurrent;      // Текущая падающая фигура
let tNext;         // Следующая фигура
let tScore;
let tLines;
let tLevel;
let tRunning;      // true — игра идёт, false — пауза/конец
let tRafId;        // ID requestAnimationFrame
let tLastDrop;     // Метка времени последнего автопадения

// ─────────────────────────────────────────────
// ФАБРИКИ
// ─────────────────────────────────────────────

/** Создаёт пустое игровое поле */
function tCreateBoard() {
  return Array.from({ length: T_ROWS }, () => Array(T_COLS).fill(null));
}

/**
 * Создаёт объект фигуры.
 * @param {string|null} key — ключ из T_PIECES или null (случайный)
 */
function tCreatePiece(key) {
  key = key || T_KEYS[Math.floor(Math.random() * T_KEYS.length)];
  return {
    key,
    color: T_PIECES[key].color,
    shape: T_PIECES[key].shape.map(r => [...r]),  // глубокая копия
    x: Math.floor((T_COLS - T_PIECES[key].shape[0].length) / 2),
    y: 0,
  };
}

// ─────────────────────────────────────────────
// ГЕОМЕТРИЯ
// ─────────────────────────────────────────────

/**
 * Поворачивает матрицу на 90° по часовой стрелке.
 * @param {number[][]} m
 * @returns {number[][]}
 */
function tRotate(m) {
  const rows = m.length, cols = m[0].length;
  const result = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = m[r][c];
  return result;
}

/**
 * Проверяет, не выходит ли фигура за границы и не пересекается ли с полем.
 * @param {object} piece  — фигура с .shape, .x, .y
 * @param {number} dx     — смещение X
 * @param {number} dy     — смещение Y
 * @param {number[][]|null} shape — альтернативная форма (для проверки поворота)
 * @returns {boolean}
 */
function tValid(piece, dx = 0, dy = 0, shape = null) {
  const s = shape || piece.shape;
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      const nx = piece.x + c + dx;
      const ny = piece.y + r + dy;
      if (nx < 0 || nx >= T_COLS) return false;  // левая/правая граница
      if (ny >= T_ROWS)           return false;  // нижняя граница
      if (ny >= 0 && tBoard[ny][nx]) return false; // столкновение с блоком
    }
  }
  return true;
}

// ─────────────────────────────────────────────
// ПОВОРОТ С WALL KICK
// ─────────────────────────────────────────────

/**
 * Пытается повернуть текущую фигуру, применяя wall kick при необходимости.
 * Wall kick — сдвиг фигуры по X, если после поворота она выходит за стену.
 */
function tRotatePiece() {
  const rotated = tRotate(tCurrent.shape);
  const kicks   = [0, -1, 1, -2, 2];  // Порядок попыток сдвига
  for (const dx of kicks) {
    if (tValid(tCurrent, dx, 0, rotated)) {
      tCurrent.shape = rotated;
      tCurrent.x    += dx;
      return;
    }
  }
  // Если ни один kick не сработал — поворот отменяется
}

// ─────────────────────────────────────────────
// ПАДЕНИЕ И ФИКСАЦИЯ
// ─────────────────────────────────────────────

/** Сдвигает фигуру вниз. Если невозможно — фиксирует на поле. */
function tMoveDown() {
  if (tValid(tCurrent, 0, 1)) {
    tCurrent.y++;
  } else {
    tLock();
  }
}

/**
 * Приклеивает текущую фигуру к полю, затем:
 * 1. Проверяет и очищает полные линии.
 * 2. Спавнит следующую фигуру.
 * 3. Проверяет условие окончания игры.
 */
function tLock() {
  for (let r = 0; r < tCurrent.shape.length; r++) {
    for (let c = 0; c < tCurrent.shape[r].length; c++) {
      if (!tCurrent.shape[r][c]) continue;
      const fy = tCurrent.y + r;
      const fx = tCurrent.x + c;
      // Если фигура вышла за верхний край — конец игры
      if (fy < 0) { tEndGame(); return; }
      tBoard[fy][fx] = tCurrent.color;
    }
  }
  tClearLines();
  tSpawn();
}

/**
 * Находит и удаляет заполненные строки, начисляет очки.
 */
function tClearLines() {
  let cleared = 0;
  for (let r = T_ROWS - 1; r >= 0; r--) {
    if (tBoard[r].every(cell => cell !== null)) {
      tBoard.splice(r, 1);
      tBoard.unshift(Array(T_COLS).fill(null));
      cleared++;
      r++;  // Смещаем индекс, т.к. массив сдвинулся
    }
  }
  if (cleared > 0) {
    tScore += (T_SCORE[cleared] || 0) * tLevel;
    tLines += cleared;
    tLevel  = Math.floor(tLines / 10) + 1;
    tUpdateHUD();
  }
}

/**
 * Вычисляет скорость падения (мс) в зависимости от уровня.
 * Чем выше уровень, тем быстрее.
 */
function tDropSpeed() {
  return Math.max(80, 550 - (tLevel - 1) * 48);
}

// ─────────────────────────────────────────────
// СПАВН СЛЕДУЮЩЕЙ ФИГУРЫ
// ─────────────────────────────────────────────

function tSpawn() {
  tCurrent = tNext;
  tNext    = tCreatePiece();
  tDrawNext();
  // Если новая фигура сразу в коллизии — игра окончена
  if (!tValid(tCurrent)) tEndGame();
}

// ─────────────────────────────────────────────
// ИГРОВОЙ ЦИКЛ
// ─────────────────────────────────────────────

/**
 * Главный цикл игры через requestAnimationFrame.
 * Управляет автопадением по таймеру.
 * @param {DOMHighResTimeStamp} ts
 */
function tLoop(ts) {
  if (!tRunning) return;

  if (!tLastDrop) tLastDrop = ts;
  if (ts - tLastDrop >= tDropSpeed()) {
    tMoveDown();
    tLastDrop = ts;
  }

  tDraw();
  tRafId = requestAnimationFrame(tLoop);
}

// ─────────────────────────────────────────────
// ОТРИСОВКА
// ─────────────────────────────────────────────

/**
 * Рисует один блок с простым визуальным эффектом.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x    — позиция в клетках
 * @param {number} y
 * @param {string} color — CSS-цвет
 * @param {number} size  — размер блока
 */
function tDrawBlock(ctx, x, y, color, size) {
  const g = 1;  // зазор между блоками
  ctx.fillStyle = color;
  ctx.fillRect(x * size + g, y * size + g, size - g * 2, size - g * 2);

  // Светлая грань сверху и слева (имитация объёма)
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x * size + g, y * size + g, size - g * 2, 3);
  ctx.fillRect(x * size + g, y * size + g, 3, size - g * 2);

  // Тёмная грань снизу и справа
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x * size + g, y * size + size - g - 3, size - g * 2, 3);
  ctx.fillRect(x * size + size - g - 3, y * size + g, 3, size - g * 2);
}

/**
 * Рисует «тень» (ghost piece) — проекцию текущей фигуры на дно.
 * Помогает игроку точнее рассчитать посадку.
 */
function tDrawGhost() {
  let ghostY = tCurrent.y;
  while (tValid(tCurrent, 0, ghostY - tCurrent.y + 1)) ghostY++;
  if (ghostY === tCurrent.y) return;

  tCtx.globalAlpha = 0.15;
  for (let r = 0; r < tCurrent.shape.length; r++)
    for (let c = 0; c < tCurrent.shape[r].length; c++)
      if (tCurrent.shape[r][c])
        tDrawBlock(tCtx, tCurrent.x + c, ghostY + r, tCurrent.color, T_BLOCK);
  tCtx.globalAlpha = 1;
}

/**
 * Полная перерисовка игрового поля: фон → сетка → блоки → тень → фигура.
 */
function tDraw() {
  if (!tCtx) return;

  // Фон
  tCtx.fillStyle = '#05050d';
  tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);

  // Тонкая сетка
  tCtx.strokeStyle = 'rgba(40,40,70,0.8)';
  tCtx.lineWidth = 0.5;
  for (let r = 0; r < T_ROWS; r++)
    for (let c = 0; c < T_COLS; c++)
      tCtx.strokeRect(c * T_BLOCK, r * T_BLOCK, T_BLOCK, T_BLOCK);

  // Зафиксированные блоки
  for (let r = 0; r < T_ROWS; r++)
    for (let c = 0; c < T_COLS; c++)
      if (tBoard[r][c])
        tDrawBlock(tCtx, c, r, tBoard[r][c], T_BLOCK);

  // Тень текущей фигуры
  if (tCurrent) tDrawGhost();

  // Текущая фигура
  if (tCurrent)
    for (let r = 0; r < tCurrent.shape.length; r++)
      for (let c = 0; c < tCurrent.shape[r].length; c++)
        if (tCurrent.shape[r][c])
          tDrawBlock(tCtx, tCurrent.x + c, tCurrent.y + r, tCurrent.color, T_BLOCK);
}

/**
 * Отрисовка следующей фигуры в маленьком канвасе превью.
 */
function tDrawNext() {
  if (!nCtx || !tNext) return;

  nCtx.fillStyle = '#05050d';
  nCtx.fillRect(0, 0, nCanvas.width, nCanvas.height);

  const s  = tNext.shape;
  const ox = Math.floor((4 - s[0].length) / 2);
  const oy = Math.floor((4 - s.length) / 2);

  for (let r = 0; r < s.length; r++)
    for (let c = 0; c < s[r].length; c++)
      if (s[r][c])
        tDrawBlock(nCtx, ox + c, oy + r, tNext.color, T_NEXT_BLOCK);
}

// ─────────────────────────────────────────────
// HUD (счёт, уровень, линии)
// ─────────────────────────────────────────────

function tUpdateHUD() {
  const el = (id) => document.getElementById(id);
  if (el('tScore')) el('tScore').textContent = tScore.toLocaleString('ru-RU');
  if (el('tLevel')) el('tLevel').textContent = tLevel;
  if (el('tLines')) el('tLines').textContent = tLines;
}

// ─────────────────────────────────────────────
// УПРАВЛЕНИЕ ИГРОЙ
// ─────────────────────────────────────────────

/**
 * Запускает новую игру.
 * Вызывается по кнопке «СТАРТ» или перезапуску.
 */
function tetrisStart() {
  cancelAnimationFrame(tRafId);

  tBoard   = tCreateBoard();
  tScore   = 0;
  tLines   = 0;
  tLevel   = 1;
  tRunning = true;
  tLastDrop = null;

  tUpdateHUD();
  const startBtn = document.getElementById('tStartBtn');
  if (startBtn) startBtn.textContent = 'РЕСТАРТ';

  tCurrent = tCreatePiece();
  tNext    = tCreatePiece();
  tDrawNext();
  tDraw();

  tRafId = requestAnimationFrame(tLoop);
}

/**
 * Ставит игру на паузу (вызывается при закрытии модалки).
 * Экспортируется в глобальную область видимости.
 */
function tetrisPause() {
  tRunning = false;
  cancelAnimationFrame(tRafId);
}

/**
 * Завершает игру и показывает оверлей с финальным счётом.
 */
function tEndGame() {
  tRunning = false;
  cancelAnimationFrame(tRafId);

  if (!tCtx) return;

  // Полупрозрачный оверлей
  tCtx.fillStyle = 'rgba(5,5,13,0.78)';
  tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);

  // Заголовок
  tCtx.font = 'bold 17px Unbounded, sans-serif';
  tCtx.fillStyle = '#e74c3c';
  tCtx.textAlign = 'center';
  tCtx.fillText('GAME OVER', tCanvas.width / 2, tCanvas.height / 2 - 20);

  // Финальный счёт
  tCtx.font = '13px "Golos Text", sans-serif';
  tCtx.fillStyle = '#f0a500';
  tCtx.fillText('Счёт: ' + tScore.toLocaleString('ru-RU'), tCanvas.width / 2, tCanvas.height / 2 + 10);

  // Подсказка
  tCtx.font = '11px "Golos Text", sans-serif';
  tCtx.fillStyle = '#55556a';
  tCtx.fillText('Нажмите РЕСТАРТ', tCanvas.width / 2, tCanvas.height / 2 + 34);
  tCtx.textAlign = 'left';
}

// ─────────────────────────────────────────────
// ОБРАБОТЧИК КЛАВИШ
// ─────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // Реагируем только когда модалка открыта и игра запущена
  const modal = document.getElementById('tetrisModal');
  if (!modal || !modal.classList.contains('open')) return;
  if (!tRunning) return;

  switch (e.key) {
    case 'ArrowLeft':
      if (tValid(tCurrent, -1, 0)) tCurrent.x--;
      break;
    case 'ArrowRight':
      if (tValid(tCurrent, 1, 0)) tCurrent.x++;
      break;
    case 'ArrowDown':
      tMoveDown();
      tLastDrop = performance.now();  // Сбрасываем таймер
      break;
    case 'ArrowUp':
      tRotatePiece();
      break;
    case ' ':
      // Hard drop — мгновенный сброс вниз
      while (tValid(tCurrent, 0, 1)) {
        tCurrent.y++;
        tScore += 2;  // Небольшой бонус за hard drop
      }
      tUpdateHUD();
      tLock();
      tLastDrop = performance.now();
      break;
    default:
      return;  // Не блокируем другие клавиши
  }

  e.preventDefault();
  tDraw();
});

// ─────────────────────────────────────────────
// ПЕРВОНАЧАЛЬНАЯ ОТРИСОВКА (пустое поле)
// ─────────────────────────────────────────────

(function tInit() {
  if (!tCtx) return;

  tBoard = tCreateBoard();
  tDraw();

  // Приглашение начать игру
  tCtx.font = '11px "Golos Text", sans-serif';
  tCtx.fillStyle = '#55556a';
  tCtx.textAlign = 'center';
  tCtx.fillText('Нажмите СТАРТ', tCanvas.width / 2, tCanvas.height / 2);
  tCtx.textAlign = 'left';
})();
