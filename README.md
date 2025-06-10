# DataSlow Vercel

Это небольшой Next.js проект с двумя API-ендпоинтами и клиентским скриптом для сбора аналитики.

## API

### `/api/create-payment`
Создаёт платёж в YooKassa. Ожидает `POST` запрос с полем `amount`.
Дополнительные метаданные передаются через заголовки:

```
X-DS-Session-Id
X-DS-Utm-Source
X-DS-Utm-Medium
X-DS-Utm-Campaign
X-DS-Email
```

Полученные значения добавляются в поле `metadata` и отправляются в YooKassa.
В ответ возвращается URL для подтверждения оплаты.

### `/api/yookassa-webhook`
Принимает вебхуки от YooKassa и сохраняет информацию о платеже в PostgreSQL (таблица `DataSlow payments`). Тело запроса читается без парсинга BodyParser, логируется и затем вставляется в базу.

> **Примечание.** YooKassa подписывает уведомления заголовком `Signature`. Тело запроса читается без парсинга и проверяется при помощи алгоритма ECDSA‑SHA384 и публичного ключа из документации.

### `/api/ecdsa-webhook`
Пример обработчика подписанных уведомлений. Ожидает заголовок `Signature` в формате `v1 <timestamp> <serial> <signature>` и проверяет подпись ECDSA‑SHA384 с использованием ключа из `SIGNATURE_PUBLIC_KEY`.

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

## Настройка

1. Скопируйте файл `.env.example` в `.env` и заполните значения.
2. Переменная `YOOKASSA_PUBLIC_KEY` должна содержать публичный ключ из кабинета YooKassa.
   Обработчик `/api/yookassa-webhook` проверяет подпись каждого вебхука с его помощью.
