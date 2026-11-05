# Неделя 3 — выложить в облако (по пособию: Supabase + Atlas + Render)

Netlify в пособии не используется и не подойдёт: наш сервер — обычный `node src/server.js` с постоянным
пулом соединений к PostgreSQL, а Netlify умеет только статику и serverless-функции. Пособие требует
**Render** для сайта, **Supabase** для PostgreSQL, **MongoDB Atlas** для MongoDB.

Делай по порядку: сначала базы, потом сайт. Секреты — только в переменных окружения, никогда в код и не в Git.

---

## 1. Supabase (PostgreSQL) — 10 минут

1. <https://supabase.com> → *Start your project* → бесплатный аккаунт (можно через GitHub).
2. *New project* (Figure 3.2 в пособии): имя `savdoshop`, регион ближе к Ташкенту (Frankfurt / Mumbai),
   **пароль сгенерируй кнопкой *Generate a password* и сразу скопируй в блокнот** — показать его второй раз не смогут.
3. Дождись *Project is ready* (1–2 минуты).
4. *SQL Editor* → *New query* → вставь целиком содержимое `sql/01_schema.sql` → **RUN** (Figure 3.3).
   Затем так же `sql/02_seed.sql`, затем по одному блоки из `sql/03_practice_queries.sql` (Q1…Q13 — они меняют данные).
   `sql/04_big_data.sql` в облаке можно не прогонять (500 000 строк на бесплатном тарифе долгие; цифры у тебя уже есть в week1_results.pdf).
5. *Project Settings → Database* → скопируй строку **Connection string → URI** и обязательно выбери
   **Session pooler** (не *Direct connection*). Вид будет такой:
   `postgres://postgres.abhfgxyz:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`
   - Если в пароле есть `@ # / :` — закодируй: `@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`.
   - Хост с `pooler` и порт `6543` — нормально, это и есть нужное.

## 2. MongoDB Atlas — 10 минут

1. <https://cloud.mongodb.com> → *Build a database* → **M0 FREE** (Figure 3.4).
2. Создай пользователя базы данных (username + password) — это НЕ логин Atlas, а отдельный пользователь.
3. *Network Access → Add IP Address → Allow Access From Anywhere* (`0.0.0.0/0`). Без этого Render не подключится.
4. *Database → Connect → Drivers* → скопируй строку вида
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   и замени `PASSWORD` на свой (тоже URL-encode спецсимволы).
5. В Compass подключись по этой строке, создай базу `savdoshop` и выполни `mongo/01_setup.mongodb.js`
   (в Compass: вкладка *Aggregations → _MONGOSH* или расширение MongoDB для VS Code). Ожидаемый вывод: `reviews: 7  events: 50000`.
   Затем `sql`-часть не нужна, а `mongo/02_queries.mongodb.js` прогони по блокам — это твои 12+ запросов в облачной базе.

## 3. GitHub — уже сделано

Репозиторий: **<https://github.com/zor0-cell/savdoshop>** (публичный, ветка `main`, `server/.env` в Git не попал).
Все изменения, которые делаем дальше, отправляются двумя командами из папки `savdoshop`:

```bash
git add -A && git commit -m "что изменилось" && git push
```

Проверка после push: в поиске по репозиторию набери `password` — ничего не должно найтись (пособие: «search the repository for password»).

## 4. Залить свои данные в облако — одной командой

Чтобы не копировать SQL и Mongo-скрипты руками, в проекте есть `server/cloud/prepare.mjs`.

1. Двойной клик по **`Залить-в-облако.bat`** (в корне проекта). Первый запуск создаст `server/cloud/cloud.env` —
   файл для секретов, он в `.gitignore` и на GitHub не попадёт.
2. Открой `server/cloud/cloud.env` в блокноте и вставь туда ровно две строки:
   `DATABASE_URL=` — строка Supabase из шага 1.5 (Session pooler),
   `MONGODB_URI=` — строка Atlas из шага 2.4. Спецсимволы в пароле — URL-encode (`@`→`%40`, `#`→`%23`, `/`→`%2F`, `:`→`%3A`).
3. Запусти `Залить-в-облако.bat` ещё раз. Он сам:
   - выполнит `sql/01_schema.sql` + `sql/02_seed.sql` в Supabase и покажет `c: 5, p: 12, u: 10, o: 3, i: 5, y: 2`;
   - зальёт 7 отзывов и 50 000 событий в Atlas и создаст три индекса;
   - напечатает, какие четыре переменные вставить в Render (пароли в выводе скрыты).
4. Хочешь убедиться, что сайт против облачных баз живой, до Render — запусти
   `node cloud/prepare.mjs --serve` из папки `server` и открой <http://localhost:3200>.
   Это тот же код, что потом ляжет на Render, только порт 3200.

## 5. Render — 15 минут

1. <https://render.com> → *New* → **Web Service** → подключи репозиторий `savdoshop` (Figure 3.5).
2. Форма:
   - **Root Directory: `server`** ← без этого будет `Cannot find module '/opt/render/project/src/package.json'`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance: **Free**
   - Environment Variables (не в `.env`!):
     `DATABASE_URL` = строка Supabase (Session pooler)
     `PGSSL` = `true`
     `MONGODB_URI` = строка Atlas
     `MONGODB_DB` = `savdoshop`
3. *Create Web Service* → Log Stream: должна появиться строка `SavdoShop running on http://0.0.0.0:10000`.
4. Открой `https://savdoshop-xxxx.onrender.com/api/health` → `{"ok":true,...}`.
   Первый заход после простоя — до 50 секунд (бесплатный тариф засыпает), это нормально и есть в отчёте.

## 6. Временная ссылка с ноутбука (пока Render не готов)

```bash
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```
Ссылка вида `https://xxxx-try.cloudflarequicktunnel.com` живёт, пока открыт терминал, и меняется каждый раз —
только для демо, не как «постоянный» хостинг.

## 7. Чек-лист перед сдачей

- [ ] Публичный URL открывается с телефона и показывает 12 товаров
- [ ] Заказ с сайта появился в Supabase (*Table Editor → orders*) и событие в Atlas (*Browse Collections → events*)
- [ ] 409 при нехватке остатка работает и ничего не пишет в базы
- [ ] Ссылка на GitHub открывается, `.env` в репозитории отсутствует
- [ ] `report/report.pdf` (8–12 страниц) — впиши своё имя, группу и обе ссылки
- [ ] Слайды 8–10 и 3-минутное видео-страховка
- [ ] `submission.txt` заполнен (публичный URL, GitHub, отчёт, слайды, видео)
- [ ] Прогнаны T1–T10 из пособия, результаты уже вписаны в отчёт

## Частые облачные ошибки (стр. «Common problems this week»)

| Симптом | Причина | Что делать |
|---|---|---|
| `Cannot find module '/opt/render/project/src/package.json'` | Root Directory не указан | Settings → Root Directory = `server` |
| `Missing DATABASE_URL or MONGODB_URI` | Переменные не добавлены в Render или имя с опечаткой | Вкладка Environment |
| `ENETUNREACH` / IPv6 в логе | Взят *Direct connection* вместо пулера | Скопируй Session pooler строку, `PGSSL=true` |
| `password authentication failed for user "postgres.abcd"` | Неверный пароль Supabase | Project Settings → Database → Reset password, обнови везде |
| `self-signed certificate in certificate chain` | Прокси/антивирус перехватывает HTTPS | Проверь `rejectUnauthorized` в `db.js`, на Render это редкий случай |
| `MongoServerSelectionError ... timed out` | IP не разрешён в Atlas | Network Access → `0.0.0.0/0` |
| Сайт пустой | Данные в облачные базы не залиты | Прогони `01_schema.sql` + `02_seed.sql` и `01_setup.mongodb.js` там |
| Первый заход ~минуту | Free-тариф Render спит | Нормально; перед демо открой URL заранее |
