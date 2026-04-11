# =============================================================================
# main.py — Бэкенд веб-приложения Alma Digital (Flask версия)
# Совместим с Python 3.14+
# Запуск: python main.py
# =============================================================================

import sqlite3
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static')

DB_PATH = "alma_digital.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            text        TEXT NOT NULL,
            date        TEXT NOT NULL,
            category_id INTEGER
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT NOT NULL,
            phone   TEXT NOT NULL,
            service TEXT NOT NULL,
            status  TEXT DEFAULT 'новая',
            created TEXT NOT NULL
        )
    """)

    cur.execute("SELECT COUNT(*) FROM categories")
    if cur.fetchone()[0] == 0:
        cur.executemany("INSERT INTO categories (name) VALUES (?)",
            [("Компания",), ("Продукты",), ("Акции",), ("Технологии",)])

    cur.execute("SELECT COUNT(*) FROM news")
    if cur.fetchone()[0] == 0:
        demo_news = [
            ("Alma Digital запускает гигабитный интернет",
             "Мы рады сообщить о запуске тарифного плана Гига со скоростью до 1 Гбит/с в 12 городах Казахстана.",
             "2025-06-01", 2),
            ("Летняя акция: 2 месяца бесплатно",
             "С 1 июня по 31 августа новые абоненты получают 2 месяца интернета в подарок.",
             "2025-06-05", 3),
            ("Alma Digital открыла офис в Астане",
             "Новый клиентский центр на пр. Мангилик Ел, 55 принимает посетителей ежедневно с 9:00 до 20:00.",
             "2025-05-20", 1),
            ("Новый роутер Wi-Fi 6 в аренду",
             "Теперь абоненты могут арендовать современный роутер стандарта Wi-Fi 6 всего за 990 тенге в месяц.",
             "2025-05-15", 2),
            ("Технология GPON — как это работает",
             "GPON — технология оптоволоконной связи, которая обеспечивает стабильное соединение до 20 км.",
             "2025-05-10", 4),
            ("Скидка 30% на телевидение",
             "При подключении пакета Интернет + ТВ в июне действует скидка 30% на абонентскую плату.",
             "2025-06-08", 3),
        ]
        cur.executemany(
            "INSERT INTO news (title, text, date, category_id) VALUES (?, ?, ?, ?)",
            demo_news)

    conn.commit()
    conn.close()
    print("База данных инициализирована:", DB_PATH)


@app.route('/api/news', methods=['GET'])
def get_news():
    cat = request.args.get('cat')
    conn = get_db()
    cur = conn.cursor()
    if cat:
        cur.execute(
            "SELECT n.*, c.name AS category_name FROM news n "
            "LEFT JOIN categories c ON n.category_id = c.id "
            "WHERE n.category_id = ? ORDER BY n.date DESC", (cat,))
    else:
        cur.execute(
            "SELECT n.*, c.name AS category_name FROM news n "
            "LEFT JOIN categories c ON n.category_id = c.id "
            "ORDER BY n.date DESC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"success": True, "data": rows, "count": len(rows)})


@app.route('/api/news', methods=['POST'])
def create_news():
    body = request.get_json()
    if not body or not body.get('title') or not body.get('text'):
        return jsonify({"success": False, "message": "Заполните title и text"}), 400
    conn = get_db()
    cur = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")
    cur.execute(
        "INSERT INTO news (title, text, date, category_id) VALUES (?, ?, ?, ?)",
        (body['title'], body['text'], today, body.get('category_id')))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({"success": True, "message": "Новость добавлена", "id": new_id}), 201


@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM categories ORDER BY id")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"success": True, "data": rows})


@app.route('/api/order', methods=['POST'])
def create_order():
    body = request.get_json()
    if not body:
        return jsonify({"success": False, "message": "Нет данных"}), 400
    name    = (body.get('name') or '').strip()
    phone   = (body.get('phone') or '').strip()
    service = (body.get('service') or '').strip()
    if not name or not phone or not service:
        return jsonify({"success": False, "message": "Заполните все поля"}), 400
    phone_digits = ''.join(c for c in phone if c.isdigit())
    if len(phone_digits) < 10:
        return jsonify({"success": False, "message": "Некорректный номер телефона"}), 400
    conn = get_db()
    cur = conn.cursor()
    created = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        "INSERT INTO requests (name, phone, service, status, created) VALUES (?, ?, ?, ?, ?)",
        (name, phone, service, "новая", created))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({
        "success": True,
        "message": f"Заявка #{new_id} принята. Мы свяжемся с вами в ближайшее время.",
        "id": new_id
    }), 201


@app.route('/api/orders', methods=['GET'])
def get_orders():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM requests ORDER BY id DESC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"success": True, "data": rows, "count": len(rows)})


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/news')
def news_page():
    return send_from_directory('static', 'news.html')


@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)


if __name__ == '__main__':
    init_db()
    print("Сайт доступен по адресу: http://localhost:8000")
  import os
port = int(os.environ.get('PORT', 8000))
app.run(host='0.0.0.0', port=port, debug=False)
