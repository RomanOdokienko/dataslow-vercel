# DataSlow Vercel

Это небольшой Next.js проект с двумя API-ендпоинтами и клиентским скриптом для сбора аналитики.

## API

### `/api/create-payment`
Создаёт платёж в YooKassa. Ожидает `POST` запрос с полем `amount`. Из заголовков запроса берутся дополнительные метаданные (session_id, UTM-метки и email), которые передаются в YooKassa. В ответ возвращается URL для подтверждения оплаты.

### `/api/yookassa-webhook`
Принимает вебхуки от YooKassa и сохраняет информацию о платеже в PostgreSQL (таблица `DataSlow payments`). Тело запроса читается без парсинга BodyParser, логируется и затем вставляется в базу.

## Клиентская аналитика

В файле [`public/analytics.js`](public/analytics.js) находится скрипт, который:
- сохраняет UTM-метки, `session_id` и email в `localStorage`;
- отправляет email пользователя на несуществующий эндпоинт `/api/track-email` при вводе email в форму;
- автоматически добавляет собранный контекст (session_id, UTM-метки и email) в заголовки всех запросов к `/api/create-payment`.

## Запуск

```bash
npm install
npm run dev
```

Проект рассчитан на деплой в Vercel и требует переменных окружения для доступа к YooKassa и базе данных.
