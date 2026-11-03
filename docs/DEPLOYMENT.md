# Публикация на GitHub Pages

## Как это работает

- `vite.config.ts` берёт `base` из переменной `VITE_BASE_PATH` (по умолчанию `/`).
- Workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) при push в `main`:
  1. ставит зависимости (`npm ci`);
  2. собирает проект (`npm run build`) с `VITE_BASE_PATH=/<имя-репозитория>/` и значениями Supabase из Actions Variables;
  3. загружает папку `dist/` и публикует её через `actions/deploy-pages`.
- Секретных ключей в репозитории нет. `anon` ключ Supabase публичный по природе, поэтому хранится в **Variables**.

## Шаги

1. **Репозиторий.** Создайте репозиторий на GitHub и отправьте код:
   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<логин>/<репозиторий>.git
   git push -u origin main
   ```
   Убедитесь, что файл `.env` не попал в коммит (он в `.gitignore`).

2. **Pages.** Settings → Pages → Build and deployment → **Source: GitHub Actions**.

3. **Variables.** Settings → Secrets and variables → Actions → вкладка **Variables** → New repository variable:
   - `VITE_SUPABASE_URL` = `https://<проект>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = ключ `anon` / publishable

4. **Запуск.** Push в `main` запускает workflow автоматически. Вручную: вкладка Actions → Deploy to GitHub Pages → Run workflow.

5. **Адрес.** После успешного деплоя игра доступна по `https://<логин>.github.io/<репозиторий>/` (адрес также показан в шаге deploy).

## Проверка после публикации

- Страница открывается, стиль и скрипты загружаются (нет 404 в консоли).
- В лобби нет сообщения «Не настроен Supabase» (иначе переменные не заданы или добавлены как Secrets, а не Variables).
- Создание комнаты и вход со второго устройства работают.

После изменения Variables нужен новый деплой (пустой коммит или Run workflow), потому что значения вшиваются в сборку.

## Особые случаи

- **Свой домен или репозиторий `<логин>.github.io`.** Сайт отдаётся из корня, поэтому в workflow замените строку `VITE_BASE_PATH` на `/` (или добавьте её в Variables и читайте оттуда).
- **Локальная проверка сборки с base path.**
  ```bash
  # PowerShell
  $env:VITE_BASE_PATH="/coop-quest/"; npm run build; npm run preview
  ```
  Откройте адрес с суффиксом `/coop-quest/`.
- **Приватный репозиторий.** GitHub Pages для приватных репозиториев доступен только на платных тарифах.
- **Кэш.** Имена файлов содержат хеш, поэтому после деплоя пользователи получают новую версию при обновлении страницы.
