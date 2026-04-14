// =============================================================================
// script.js — Основная логика фронтенда Alma Digital
// Отвечает за: прогресс-бар, форму заявки, загрузку новостей, навигацию
// =============================================================================

// ─────────────────────────────────────────────
// КОНСТАНТЫ
// ─────────────────────────────────────────────

// Базовый URL API — при разработке совпадает с хостом страницы
const API_BASE = '';  // пустая строка = относительный путь к /api/...

// Эмодзи-иконки по категориям (category_id → иконка)
const CATEGORY_ICONS = {
  1: '🏢',  // Компания
  2: '📡',  // Продукты
  3: '🎁',  // Акции
  4: '⚙️',  // Технологии
};

// ─────────────────────────────────────────────
// ПРОГРЕСС-БАР ПРОКРУТКИ
// ─────────────────────────────────────────────

window.addEventListener('scroll', () => {
  const bar = document.getElementById('page-progress');
  if (!bar) return;
  const scrollTop = document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  bar.style.width = pct + '%';
});

// ─────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────

/**
 * Форматирует строку даты "YYYY-MM-DD" в "1 января 2025"
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const months = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
  ];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

/**
 * Показывает/скрывает спиннер на кнопке отправки формы
 * @param {boolean} loading
 */
function setFormLoading(loading) {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Отправляем...' : 'Отправить заявку';
}

// ─────────────────────────────────────────────
// ФОРМА ЗАЯВКИ
// ─────────────────────────────────────────────

/**
 * Открывает форму заявки и предзаполняет тариф (если передан).
 * Используется из кнопок карточек тарифов.
 * @param {string} serviceName — название тарифа
 */
function openOrder(serviceName) {
  const select = document.getElementById('clientService');
  if (select && serviceName) {
    select.value = serviceName;
  }
  // Плавная прокрутка к форме
  document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Плавная прокрутка к секции заявки (вызывается из шапки)
 */
function scrollToOrder() {
  document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Отправляет заявку через POST /api/order
 * Реализует базовую клиентскую валидацию перед отправкой.
 */
async function submitOrder() {
  // Читаем значения полей
  const name    = document.getElementById('clientName')?.value.trim();
  const phone   = document.getElementById('clientPhone')?.value.trim();
  const service = document.getElementById('clientService')?.value;
  const alertEl = document.getElementById('formAlert');

  // Сброс предыдущего алерта
  if (alertEl) {
    alertEl.className = 'form-alert';
    alertEl.textContent = '';
  }

  // Клиентская валидация
  if (!name || name.length < 2) {
    showFormAlert('Пожалуйста, введите ваше имя.', 'error');
    return;
  }
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    showFormAlert('Введите корректный номер телефона.', 'error');
    return;
  }
  if (!service) {
    showFormAlert('Выберите тариф из списка.', 'error');
    return;
  }

  setFormLoading(true);

  try {
    // POST-запрос к бэкенду
    const response = await fetch(`${API_BASE}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, service })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showFormAlert(data.message, 'success');
      // Очищаем поля после успешной отправки
      document.getElementById('clientName').value = '';
      document.getElementById('clientPhone').value = '';
      document.getElementById('clientService').value = '';
    } else {
      showFormAlert(data.detail || 'Произошла ошибка. Попробуйте позже.', 'error');
    }
  } catch (err) {
    // Ошибка сети или сервера
    console.error('Ошибка отправки заявки:', err);
    showFormAlert('Не удалось подключиться к серверу. Проверьте соединение.', 'error');
  } finally {
    setFormLoading(false);
  }
}

/**
 * Отображает алерт под формой
 * @param {string} text    — текст сообщения
 * @param {string} type    — 'success' | 'error'
 */
function showFormAlert(text, type) {
  const alertEl = document.getElementById('formAlert');
  if (!alertEl) return;
  alertEl.textContent = text;
  alertEl.className = `form-alert ${type}`;
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─────────────────────────────────────────────
// СТРАНИЦА НОВОСТЕЙ
// ─────────────────────────────────────────────

// Текущий активный фильтр категории (null = все)
let currentCat = null;

/**
 * Загружает категории из /api/categories и добавляет
 * кнопки-фильтры на страницу новостей.
 */
async function loadCategories() {
  const filtersEl = document.getElementById('newsFilters');
  if (!filtersEl) return;

  try {
    const res  = await fetch(`${API_BASE}/api/categories`);
    const data = await res.json();

    // Добавляем кнопку для каждой категории
    data.data.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.cat = cat.id;
      btn.textContent = cat.name;
      btn.onclick = () => filterNews(btn, cat.id);
      filtersEl.appendChild(btn);
    });
  } catch (err) {
    console.warn('Не удалось загрузить категории:', err);
  }
}

/**
 * Переключает фильтр и перезагружает список новостей.
 * @param {HTMLElement} btn — нажатая кнопка-фильтр
 * @param {number|string} catId — ID категории или '' для всех
 */
function filterNews(btn, catId) {
  // Убираем активный класс у всех фильтров
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  currentCat = catId === '' ? null : catId;
  loadNews(currentCat);
}

/**
 * Загружает новости с API и рендерит карточки.
 * @param {number|null} catId — фильтр категории или null
 */
async function loadNews(catId = null) {
  const grid    = document.getElementById('newsGrid');
  const emptyEl = document.getElementById('newsEmpty');
  if (!grid) return;

  // Показываем скелетон-загрузчики
  grid.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
  `;
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    // Формируем URL с параметром фильтра
    const url = catId
      ? `${API_BASE}/api/news?cat=${catId}`
      : `${API_BASE}/api/news`;

    const res  = await fetch(url);
    const data = await res.json();
    const news = data.data || [];

    grid.innerHTML = '';  // Очищаем скелетоны

    if (news.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    // Рендерим карточку для каждой новости
    news.forEach((item, index) => {
      const card = renderNewsCard(item, index);
      grid.appendChild(card);
    });

  } catch (err) {
    console.error('Ошибка загрузки новостей:', err);
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">
        Не удалось загрузить новости. Проверьте соединение с сервером.
      </div>
    `;
  }
}

/**
 * Создаёт DOM-элемент карточки новости.
 * @param {object} item  — объект новости из API
 * @param {number} index — индекс для анимации задержки
 * @returns {HTMLElement}
 */
function renderNewsCard(item, index) {
  const card = document.createElement('div');
  card.className = 'news-card fade-in';
  card.style.animationDelay = `${index * 0.07}s`;

  const icon = CATEGORY_ICONS[item.category_id] || '📰';
  const dateStr = item.date ? formatDate(item.date) : '';
  const catName = item.category_name || 'Новость';

  card.innerHTML = `
    <div class="news-card-img">${icon}</div>
    <div class="news-card-body">
      <div class="news-card-meta">
        <span class="news-cat-badge">${catName}</span>
        <span class="news-date">${dateStr}</span>
      </div>
      <h3 class="news-card-title">${escapeHtml(item.title)}</h3>
      <p class="news-card-text">${escapeHtml(item.text)}</p>
    </div>
  `;

  return card;
}

/**
 * Экранирует HTML-символы для безопасного вывода в разметку.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
// ТЕТРИС — ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
// ─────────────────────────────────────────────

/**
 * Открывает модальное окно с тетрисом.
 * Объявлена здесь; логика игры — в tetris.js.
 */
function openTetris() {
  const modal = document.getElementById('tetrisModal');
  if (modal) modal.classList.add('open');
  // Блокируем прокрутку фона
  document.body.style.overflow = 'hidden';
}

/** Закрывает модальное окно с тетрисом и останавливает игру. */
function closeTetris() {
  const modal = document.getElementById('tetrisModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  // Останавливаем анимационный цикл игры (функция из tetris.js)
  if (typeof tetrisPause === 'function') tetrisPause();
}

// Закрытие модалки по клику на затемнённый оверлей
document.getElementById('tetrisModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeTetris();
});

// ─────────────────────────────────────────────
// СЕКРЕТНАЯ КОМБИНАЦИЯ T+E+T → открыть Тетрис
// ─────────────────────────────────────────────
(function() {
  const combo = ['t', 'e', 't'];
  let buffer  = [];

  document.addEventListener('keydown', e => {
    buffer.push(e.key.toLowerCase());
    if (buffer.length > combo.length) buffer.shift();
    if (buffer.join('') === combo.join('')) {
      openTetris();
      buffer = [];
    }
  });
})();

// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Страница новостей: загружаем категории и первый пакет новостей
  if (document.getElementById('newsGrid')) {
    loadCategories();
    loadNews(null);  // GET /api/news — все новости
  }
});

// ─────────────────────────────────────────────
// БУРГЕР-МЕНЮ (мобильная навигация)
// ─────────────────────────────────────────────

/**
 * Открывает/закрывает мобильное меню
 */
function toggleMenu() {
  const burger = document.getElementById('burger');
  const nav    = document.getElementById('mobileNav');
  if (!burger || !nav) return;
  burger.classList.toggle('open');
  nav.classList.toggle('open');
  // Блокируем прокрутку фона когда меню открыто
  document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
}

// Закрываем меню при клике на ссылку
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mobile-nav a').forEach(link => {
    link.addEventListener('click', () => {
      const burger = document.getElementById('burger');
      const nav    = document.getElementById('mobileNav');
      if (burger) burger.classList.remove('open');
      if (nav) nav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
});
