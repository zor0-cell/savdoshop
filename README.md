# SavdoShop — проект курса Big Data

Полный референсный сайт из пособия «Build Your Own Database + Website in 3 Weeks»:
PostgreSQL (деньги и остатки) + MongoDB (отзывы и клики) + Node.js/Express между ними.

Репозиторий: <https://github.com/zor0-cell/savdoshop>

```
savdoshop/
├─ sql/     01_schema.sql  02_seed.sql  03_practice_queries.sql  04_big_data.sql
├─ mongo/   01_setup.mongodb.js  02_queries.mongodb.js
├─ server/  package.json  .env.example  src/db.js  src/server.js  public/*
├─ week1/   то же, но именами из чек-листа + er_diagram.png + week1_results.pdf
├─ report/  report.pdf (12 стр.) + demo-script.md (7 мин) + savdoshop-slides.pptx (9 слайдов) + backup-video.mp4 (3 мин)
├─ screenshots/  5 снимков сайта, сделанных реальными кликами
├─ DEPLOY.md     неделя 3: Supabase + Atlas + Render + cloudflared по шагам
└─ submission.txt шаблон того, что сдаёшь
```

## Неделя 1 — база данных (30 баллов)

1. pgAdmin → правой кнопкой по *Databases* → **Create → Database** → имя `savdoshop`.
2. Правой кнопкой по `savdoshop` → **Query Tool** → *Open File* → `sql/01_schema.sql` → `F5`.
3. Тем же способом выполнить `sql/02_seed.sql` (5 категорий, 10 клиентов, 12 товаров, 3 заказа, 5 позиций, 2 платежа).
4. `sql/03_practice_queries.sql` — выделяй по одному запросу (Q1…Q13) и жми `F5`. Порядок важен: Q4 удаляет строку из Q1, Q3 делает скидку, которую видно в Q13.
5. `sql/04_big_data.sql` — шаги 0…6 по отдельности: 500 000 строк и замер `EXPLAIN ANALYZE` до и после индекса. Запиши оба времени в отчёт.
6. MongoDB: выполни `mongo/01_setup.mongodb.js` (VS Code + расширение MongoDB, или Compass `_MONGOSH`, или `mongosh --file`). Затем блоки M1…M14 из `mongo/02_queries.mongodb.js`.

## Неделя 2 — сайт и API (30 баллов)

```bash
cd server
npm install
copy .env.example .env       # и впиши свой пароль PostgreSQL в DATABASE_URL
npm run dev                  # сайт на http://localhost:3000
```

Проверка, что обе базы подключились: <http://localhost:3000/api/health> →
`{"ok":true,"postgresTime":"...","mongoReviews":7}`

Страницы: `index.html` (список + поиск + фильтр), `product.html` (данные из PostgreSQL +
отзывы из MongoDB), `cart.html` (корзина в localStorage + оформление заказа одной транзакцией),
`dashboard.html` (три статистики). API-маршрутов 10:

| Маршрут | Что делает | База |
|---|---|---|
| `GET /api/health` | проверка подключения | обе |
| `GET /api/categories` | категории | PostgreSQL |
| `GET /api/products?q=&category=&page=` | список с поиском и постраницей | PostgreSQL |
| `GET /api/products/:id` | товар + его отзывы, пишет событие «просмотр» | обе |
| `POST /api/products/:id/reviews` | добавить отзыв | MongoDB |
| `POST /api/orders` | заказ: проверка остатков, `order_items`, `payments` в `BEGIN…COMMIT` | обе |
| `GET /api/customers/:id/orders` | история заказов с `json_agg` | PostgreSQL |
| `GET /api/stats/sales-by-city` | выручка по городам | PostgreSQL |
| `GET /api/stats/top-viewed` | топ-5 просмотренных, имена из SQL | обе |
| `GET /api/stats/funnel` | view / add_to_cart / purchase | MongoDB |

## Неделя 3 — деплой (40 баллов)

`DATABASE_URL` от Supabase + `PGSSL=true`, `MONGODB_URI` от Atlas, деплой папки `server` на Render
(`npm start`), публичная ссылка через `cloudflared tunnel --url http://localhost:3000`.

## Свои пароли

Пароль PostgreSQL нигде не повторяется: он живёт только в `server/.env`, а `.env` не попадает на GitHub
(файл `.gitignore`).
