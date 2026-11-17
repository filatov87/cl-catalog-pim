# Исправленные Office Scripts для Laboratorija_Pricelist_SSoT

Версия от 16.11.2026. Проверены на копии файла с применённым патчем и выгрузкой SmartLIS от 16.11.

## Как установить

В Excel: Automate → All scripts → открыть скрипт → выделить весь код → вставить новый → Save.
Кнопки на листе Actions привязаны к скриптам, поэтому лучше заменять код в существующих скриптах, а не создавать новые.

| Файл | Какой скрипт заменяет | Кнопка |
|---|---|---|
| 00_fixChangeLog_once.ts | новый, одноразовый | без кнопки |
| syncFromDBImport.ts | SyncFromDBImport | Run SyncFromDBImport |
| prepareExport.ts | PrepareExport | Run PrepareExport |
| generateSmartlisDelta.ts | Generate_Smartlis_delta_export (тот, что сейчас читает ChangeLog) | Run Generate_Smartlis_delta_export |
| generateWebJson.ts | Generate_Web_JSON | Run Generate_Web_JSON |
| generateCatalogV2.ts | generateCatalogV2 | без кнопки |

Старый `generate_smartlis_delta_export` (полная выгрузка всех тестов) оставить как есть, но переименовать в `Generate_Smartlis_full_export`.

## Порядок первого запуска

1. Создать новый скрипт, вставить `00_fixChangeLog_once.ts`, запустить один раз. Он добавит в ChangeLog колонки Exported/BatchId, вернёт нормальное время в строки 2–850 и пометит всю старую историю как отправленную. После запуска скрипт можно удалить.
2. Заменить код остальных скриптов.
3. В Schema поменять у `catalog` source с DB на MANUAL (фаза 1).
4. Решить дубли в Dictionary (Krēpas 14/43, Iztriepe no vagīnas 58/62, SPERMA 22 / Sperma 67). Пока они есть, Prepare Export остановится на 18 тестах с этими материалами и выведет их список.

## Рабочий цикл

**Отправка правок в SmartLIS:**
1. Свежая выборка из SmartLIS → DB_Import (CSV в UTF-8, колонку govcode — как текст). Sync НЕ запускать.
2. Prepare Export.
3. Generate SmartLIS delta → JSON на листе Export_SmartLIS (только поля, где каталог отличается от SmartLIS).
4. Загрузить JSON в SmartLIS.

**Получение изменений из SmartLIS:**
5. Свежая выборка → DB_Import → Sync.

Если запустить Sync до шага 3, он перезапишет правки в DB-полях значениями из SmartLIS.

## Защиты, которые теперь есть

| Скрипт | Останавливается, если |
|---|---|
| Sync | дубли code в DB_Import; govcode склеен в число; какое-то поле очищается у больше чем 5% тестов (мин. 30) |
| Prepare Export | название из справочника не найдено или встречается в Dictionary с разными ID |
| SmartLIS delta | Export старше 15 минут; в ChangeLog нет Exported/BatchId; какое-то поле расходится у больше чем 200 тестов (обычно сломанная выгрузка; при осознанном массовом изменении поставить ALLOW_MASS_CHANGES = true) |

Во всех случаях лист, который скрипт должен изменить, остаётся нетронутым, а причина выводится в ошибке.

## Что изменилось в результатах

- **Sync:** "NULL" и пустая ячейка считаются одинаковыми, лишних записей в ChangeLog нет. Записываются только изменённые колонки, а не весь лист.
- **SmartLIS delta:** пустые значения уходят как null, флаги как true/false, govcode как строка. Каждая отправленная правка пишется в ChangeLog с типом EXPORT и BatchId.
- **Web JSON:** обычные тесты получают только fin_price2. AKC (publish = AKC) собираются в отдельный массив promotions с fin_price2 и fin_cost1, но пока INCLUDE_AKC = false, в JSON их нет. "NULL" заменяется на "".
- **CatalogV2:** колонки заполняются; в последней колонке перечислено, какого веб-контента не хватает опубликованному тесту.

## Результаты прогона на копии (16.11)

- Sync: обновлено 82 теста (в основном catalog у 76 тестов: пусто → false), добавлено 439 новых, 12 изменений цен. Массовой очистки полей нет.
- Delta сразу после Sync: 0 тестов. После правки материала ACE и catalog у ACP: ровно эти два поля.
- Web JSON: 727 тестов, из цен только fin_price2.
- CatalogV2: 698 опубликованных тестов без полного веб-контента.
