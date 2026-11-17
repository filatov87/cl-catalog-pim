# SmartLIS Catalog API — заметки для импорта/экспорта

Источники: тикет SLSD-6363 «Test catalog updating tool» (24.08–13.11.2026) и Swagger SmartComm (smartlis.dev.laboratorija.lv/smartcomm/api/docs, раздел Catalog), выгрузка от 16.11.2026.

## Статус
- Все эндпоинты ниже работают на PRE (smartlis.dev.laboratorija.lv).
- Выкатка в PROD запланирована на неделю, начинающуюся 22.11.2026.
- В PRE у тестов с active & order = TRUE проставлен catalog = TRUE; API по умолчанию фильтрует catalog = TRUE, catalog = FALSE можно запросить (`catalog=all`).
- Отдельно согласовано: фильтр catalog = TRUE для ex2/catalog/catalog_cl2/ version 2 (Catalog API для сайта/портала) — приоритет.

## Вход
- `POST /bef/api/v1/auth/login`, тело JSON `{"username": "…", "password": "…"}` (проверено на PRE 17.11).
- В ответ приходят cookie: сессионная (имя зависит от окружения, на PRE `smartlis_backend-pre43_…`) и `work_sess_wks`. Их нужно передавать со всеми запросами SmartComm. Срок жизни сессии и путь на PROD — уточнить.

## Эндпоинты (префикс /smartcomm/api/v1/catalog)
| Метод | Путь | Что делает |
|---|---|---|
| GET | /test/{code} | Один тест; `fields` (через запятую), `translations` (по умолчанию en-US,ru-RU,lv-LV) |
| GET | /tests | Все тесты постранично (`page`, `size`), `fields`, фильтр `catalog` (true / all) |
| POST | /test/{code} | Обновить тест: отправляются только изменяемые поля; code и id менять нельзя |
| PUT | /test/{code} | Создать тест (приложение не использует: тесты создаются только в SmartLIS) |
| POST | /tests/bulk_update | `{"tests":[{code,...},...]}` → ответ `responses, updated, failed, rets[]` с результатом по каждому тесту |
| GET/POST | /templates | Список / создание шаблонов |
| GET/PUT | /template/{template_code} | Шаблон |
| GET/POST | /template/{template_code}/params | Параметры шаблона (состав) |
| GET/POST | /template/{template_code}/param/{param_code} | Один параметр |
| POST | /templates/params/bulk_update | Массовое обновление параметров |

## Важно для приложения
- Схема Test ≈ 120 полей; любое из них можно запросить/обновить через `fields` без доработок SmartLIS. Неизвестное поле → 400 со списком разрешённых.
- Имена полей API отличаются от cat_test: `test_type` (testtype), `section` (sectionid), `section_order` (sectiono), `sample` (sampleid). По запросу добавлены и старые имена: testtype, sectionid, sectiono, template, sampleid, template_name — проверить, какие принимает запись.
- Связанные сущности (section, sample, container, test type) при обновлении передаются по **коду**, а не по числовому ID. Справочники приложения должны хранить код SmartLIS.
- Фильтра по `active` в API нет: запрос идёт с `catalog=all`, `active = TRUE` фильтрует приложение.
- Каждое обновление проходит полную валидацию и аудит SmartLIS.
- Есть переводы (en/ru/lv) — пригодятся для сайта.
- В `bulk_update` изменение считается отправленным только при успешном `ret` для этого кода.

## Открытые вопросы к SmartLIS
- Технический пользователь с правами только на каталог, без доступа к заказам (обычная учётка с правом чтения видит персональные данные пациентов по своим группам).
- Срок жизни сессии, код ответа при истёкшей сессии, путь входа на PROD.
- Источник справочников с кодами (секции, группы секций, материалы, типы тестов) через API.
- Ограничения bulk_update: максимальный размер пакета, частота запросов, частичное применение.
- Можно ли передать имя инициатора правки для аудита SmartLIS.
- Обновление параметров шаблона: 23.10 был 404 «template not found», 30.10 сообщили, что исправлено — перепроверить.
