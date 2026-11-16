# Deploying TheWairuaHeritage to production (with a CDN)

The app is a Vite/React SPA + PHP API. In XAMPP the same pattern as the
`consult/dist` vhost works well: Apache serves `dist/` directly and proxies
`/api` + `/data` to the repo. A free-tier CDN (Cloudflare) can sit in front
of Apache for SSL + edge caching — no code changes required.

## 1. Build

```powershell
cd C:\xampp\htdocs\familytree
npm run build
```

Produces `dist/` (hashed bundles under `dist/assets/`) and copies the bundled
Apache config `dist/.htaccess` (from `public/.htaccess`):

| Path | Cache-Control |
| --- | --- |
| `index.html` | `no-cache, must-revalidate` |
| `/assets/*` (content-hashed) | `public, max-age=31536000, immutable` |
| `/data/photos/*` | `public, max-age=604800` |
| `/api/*` (except `/api/photo.php`) | `no-store` |

Also enables Brotli/gzip compression and `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options` headers.

## 2. Apache vhost (XAMPP)

Add to `apache/conf/extra/httpd-vhosts.conf` (after the existing examples):

```apache
Listen 8086
<VirtualHost *:8086>
    ServerName wairua.local            # or your real domain
    DocumentRoot "C:/xampp/htdocs/familytree/dist"

    <Directory "C:/xampp/htdocs/familytree/dist">
        Options -Indexes +FollowSymLinks
        AllowOverride All              # required for dist/.htaccess
        Require all granted
    </Directory>

    # PHP API (served from the repo, not dist/)
    Alias /api "C:/xampp/htdocs/familytree/api"
    <Directory "C:/xampp/htdocs/familytree/api">
        Options -Indexes
        AllowOverride All
        Require all granted
        <FilesMatch "^(config\.local\.php|_testmail|schema\.sql)$">
            Require all denied
        </FilesMatch>
    </Directory>

    # Photo files (referenced as /data/photos/...)
    Alias /data "C:/xampp/htdocs/familytree/data"
    <Directory "C:/xampp/htdocs/familytree/data">
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    ErrorLog "logs/wairua-error.log"
    CustomLog "logs/wairua-access.log" common
</VirtualHost>
```

Then restart Apache (`httpd.exe`, or XAMPP control panel). The SPA is then at
`http://<host>:8086/` and the API at `http://<host>:8086/api/...`.

Notes:
- `config.local.php` is denied above — never serve it.
- `.htaccess` in `api/` additionally protects against direct downloads.
- Port 8086 is an example; use whatever is free (8083 and 8085 are already
  used by `dist-test` and `consult/dist`).

## 3. Point the app at the real URL

In **Settings → SMTP → Public URL**, set the final public base URL, e.g.
`https://family.example.com` (no trailing slash). Every email link uses it:

- password reset, account approval, message notifications
- one-click unsubscribe (RFC 8058) links
- the Google Calendar (.ics) feed `https://.../api/calendar.php?token=...`

Then send a test email (**Settings → Send test**) and click the link from a
real device.

## 4. Put Cloudflare in front (optional but recommended)

This is the "CDN" part that a shared XAMPP box cannot provide:

1. Add your domain to Cloudflare, point NS at them, keep an **A record** to
   the XAMPP box (grey/orange cloud = orange = proxied).
2. SSL/TLS mode: **Full (strict)** — install a Cloudflare Origin Certificate
   on Apache (or use HTTP only internally + Full if the box is LAN-only).
3. Cache rules (Caching → Cache Rules), first match wins:
   - If URI path starts with `/api/` → **Bypass cache** (API is per-member).
   - If URI path starts with `/assets/` → **Eligible for cache**, edge TTL
     1 year (responses are immutable + content-hashed).
   - If URI path starts with `/data/photos/` → **Eligible for cache**, edge
     TTL 30 days.
4. Speed → Optimization: enable **Auto Minify** (JS/CSS/HTML) and **Brotli**.
5. Security → Settings: leave **Bot Fight Mode** off (it breaks
   unauthenticated iCal fetches), consider **WAF managed ruleset** free tier.

The Google Calendar feed remains publicly fetchable — that's by design
(secret-token URL); don't add Basic Auth in front of `/api/calendar.php`.

## 5. What NOT to do

- Don't serve the repo root as DocumentRoot — `api/config.local.php` would leak.
- Don't run `npm run dev` publicly; it's dev-only.
- Don't cache `/api/*` at the edge — member-specific responses must not be
  shared between users.
- Don't bypass `/api/photo.php` into the "cache everything" rule without
  keeping its ETag support — profile photos are re-synced in place.

## 6. Verifying the deployment

```powershell
# SPA loads
Invoke-WebRequest https://your-host/ | Select-Object StatusCode
# Fingerprinted asset is cacheable
(Invoke-WebRequest -Head http://your-host/assets/index-XXXX.js).Headers['Cache-Control']
# API is never cached
(Invoke-WebRequest -Head http://your-host/api/auth.php?action=me).Headers['Cache-Control']
# Calendar feed
Invoke-WebRequest "https://your-host/api/calendar.php?token=<from Family Events page>" | Select-Object StatusCode
```
