# Alma Digital — Веб-приложение

Дипломный проект: фулстэк-прототип провайдера цифровых услуг.
**Стек:** FastAPI · SQLite · HTML5/CSS3 · Vanilla JS

---

## Структура проекта

```
alma_digital/
├── main.py              ← Бэкенд: FastAPI + SQLite
├── requirements.txt     ← Зависимости Python
├── alma_digital.db      ← База данных (создаётся автоматически)
└── static/
    ├── index.html       ← Главная страница
    ├── news.html        ← Страница новостей
    ├── style.css        ← Все стили
    ├── script.js        ← Логика фронтенда + AJAX
    └── tetris.js        ← Игра Тетрис
```

---

## Быстрый запуск

### 1. Установить зависимости

```bash
pip install -r requirements.txt
```

### 2. Запустить сервер

```bash
python main.py
```

или с авторестартом:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Открыть в браузере

```
http://localhost:8000          ← Главная страница
http://localhost:8000/news     ← Новости
http://localhost:8000/docs     ← Swagger UI (документация API)
```

---

## API Эндпоинты

| Метод  | URL                  | Описание                         |
|--------|----------------------|----------------------------------|
| GET    | /api/news            | Все новости                      |
| GET    | /api/news?cat=1      | Новости категории 1              |
| GET    | /api/news/{id}       | Одна новость по ID               |
| POST   | /api/news            | Добавить новость (имитация админ)|
| GET    | /api/categories      | Список категорий                 |
| POST   | /api/order           | Отправить заявку на подключение  |
| GET    | /api/orders          | Просмотр всех заявок (отладка)   |

### Пример: добавить новость через cURL
```bash
curl -X POST http://localhost:8000/api/news \
  -H "Content-Type: application/json" \
  -d '{"title":"Тест","text":"Текст новости","category_id":1}'
```

### Пример: отправить заявку
```bash
curl -X POST http://localhost:8000/api/order \
  -H "Content-Type: application/json" \
  -d '{"name":"Иван","phone":"+7 777 123 45 67","service":"Гига 1000 Мбит/с"}'
```

---

## Пасхалка — Тетрис

Три способа открыть игру:
1. Нажать на плашку **«Зона отдыха»** на главной странице
2. Набрать на клавиатуре **T → E → T**
3. Нажать кнопку **«Подключиться»** на любом тарифе → внизу страницы

---

## Технологии

- **FastAPI** — современный асинхронный веб-фреймворк Python
- **SQLite** — встроенная реляционная СУБД, файл `alma_digital.db`
- **Pydantic** — валидация данных
- **HTML5 Canvas** — рендеринг тетриса
- **Fetch API** — AJAX-запросы без библиотек
- **CSS Custom Properties** — дизайн-токены и тёмная тема
