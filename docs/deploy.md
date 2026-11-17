# Deploying TheWairuaHeritage to production (with a CDN)

> **Status 2026-11-17: deployed at http://localhost:8086/**
> Apache vhost already in `apache/conf/extra/httpd-vhosts.conf` (port 8086).
> `dist/` is the complete document root — **no aliases**; everything the app
> needs is bundled inside it. Wired to the production DB `wayrusc1_familytree`
> (user `wayrusc1_familytree`, host localhost:3308 — MariaDB on this machine).
> `app_public_url` = `http://localhost:8086` so email links, unsubscribe links
> and the .ics feed point at the deployed app. Change it in **Settings -> SMTP ->
> Public URL** when you move to a domain/SSL.
> **Note:** dev on :3000 and the deployment on :8086 share this one database
> (single-box localhost deployment). The pre-deployment database `familytree`
> is untouched and kept as a fallback.

## dist/ is the single deployable artifact

```
dist/
  index.html, assets/...   (SPA, hashed by content)
  api/**                   (PHP endpoints + shared libraries + config.local.php)
  data/photos/*.jpg        (732 photos, ~2.5 MB)
  .htaccess                (cache headers, compression, security headers, API secrets guard)
```

## Build + bundle in one step

```powershell
cd C:\xampp\htdocs\familytree
npm run deploy          # = npm run build && node deploy.mjs
```

`deploy.mjs` copies `api/**` (excluding dev junk, maps, test folders, and crucially `api/config.local.php` — production secrets stay off the artifact). Production on the host reads `api/config.php` defaults, which already match the host (`localhost:3306`, db/user `wayrusc1_familytree`, pass `Familytree@26`). Local development keeps working through the git-ignored `api/config.local.php` (XAMPP on 3308).

## What dist/.htaccess does

| Path | Behavior |
| --- | --- |
| `index.html` | `no-cache, must-revalidate` |
| `/assets/*` (content-hashed) | `public, max-age=31536000, immutable` |
| `/data/photos/*` | `public, max-age=604800` |
| `/api/*` (except `/api/photo.php`) | `no-store` |
| `/api/config.local.php`, `schema.sql`, `*.local.php` | **403** |
| `/api/*.sql/md/txt/log/ini/env/json/lock/bak` | **403** |
| `/api/.htaccess` | **403** |

Plus gzip compression and `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options` headers.

## The Apache vhost (current, port 8086)

```apache
Listen 8086
<VirtualHost *:8086>
    ServerName localhost            # set your real domain here later
    DocumentRoot "C:/xampp/htdocs/familytree/dist"
    <Directory "C:/xampp/htdocs/familytree/dist">
        Options -Indexes +FollowSymLinks
        AllowOverride All           # required for dist/.htaccess
        Require all granted
    </Directory>
    ErrorLog "logs/familytree-dist-error.log"
    CustomLog "logs/familytree-dist-access.log" common
</VirtualHost>
```

Restart Apache after changing it (XAMPP control panel, or `httpd.exe -k restart`).

## Uploading to a host

`npm run deploy`, then copy the contents of `dist/` into the host's document
root (SFTP). Keep `api/config.local.php` unreadable by the web (the bundled
`.htaccess` already does this on Apache; on other servers use their equivalent
or file permissions).

## 3. Point the app at the real URL

In **Settings → SMTP → Public URL**, set the final public base URL, e.g.
`https://family.example.com` (no trailing slash). Every email link uses it:
password resets, approvals, message notifications, one-click unsubscribe
(RFC 8058) and the Google Calendar (.ics) feed.
Then send a test email and click the link from a real device.

## 0. One-time: create the DB on the host

The app needs a MySQL database and user with the same name as configured in
`api/config.php` defaults (`wayrusc1_familytree` / `wayrusc1_familytree` /
`Familytree@26`). On cPanel/CI host this is the only manual step; there is no
way around it — the web host owns its MySQL.

1. cPanel → **MySQL Databases** → Create database `wayrusc1_familytree`
2. cPanel → **MySQL Databases** → Create user `wayrusc1_familytree`,
   password `Familytree@26`
3. cPanel → **MySQL Databases** → Add user `wayrusc1_familytree` to database
   `wayrusc1_familytree` with **ALL PRIVILEGES**
4. cPanel → **phpMyAdmin** → select `wayrusc1_familytree` → **Import** →
   choose the bundled dump
   `C:\Users\USER\AppData\Local\Temp\opencode\familytree-wayru-deploy.sql`
   (784 KB, contains 1761 people, 478 families, all settings — all data you
   now have locally, taken straight from the local `wayrusc1_familytree` DB).

After that, re-upload the entire `dist/` folder. Login should work.
To regenerate the dump later: `mysqldump -P 3308 -u root wayrusc1_familytree > dump.sql`.

## 4. Put Cloudflare in front (optional but recommended)

1. Add your domain to Cloudflare, point NS at them, keep an **A record** to the
   host (orange cloud = proxied).
2. SSL/TLS mode: **Full (strict)** — install a Cloudflare Origin Certificate
   on Apache (or Full + their edge cert if the box is LAN-only).
3. Cache rules (Caching → Cache Rules), first match wins:
   - If URI path starts with `/api/` → **Bypass cache** (API is per-member).
   - If URI path starts with `/assets/` → **Eligible for cache**, edge TTL
     1 year (responses are immutable + content-hashed).
   - If URI path starts with `/data/photos/` → **Eligible for cache**, edge
     TTL 30 days.
4. Speed → Optimization: **Auto Minify** (JS/CSS/HTML) and **Brotli**.
5. Leave **Bot Fight Mode** off (it breaks iCal fetches); consider the free
   WAF managed ruleset.

The Google Calendar feed remains publicly fetchable (secret-token URL) —
that's by design; don't put Basic Auth in front of `/api/calendar.php`.

## 5. What NOT to do

- Don't serve the repo root as DocumentRoot — `api/config.local.php` would leak.
- Don't run `npm run dev` publicly; it's dev-only.
- Don't cache `/api/*` at the edge.
- Don't commit `dist/` — it carries production secrets in `api/config.local.php`.

## 6. Verifying the deployment

```powershell
Invoke-WebRequest https://your-host/ | Select-Object StatusCode
(Invoke-WebRequest -Head http://your-host/assets/index-XXXX.js).Headers['Cache-Control']
(Invoke-WebRequest -Head http://your-host/api/auth.php?action=me).Headers['Cache-Control']
Invoke-WebRequest "https://your-host/api/calendar.php?token=<from Family Events page>" | Select-Object StatusCode
```
