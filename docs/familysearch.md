# FamilySearch integration

The **Research** page can optionally search the FamilySearch family tree for
your members — using each member's own FamilySearch account (OAuth 2.0 + PKCE,
read-only). Nothing is stored except a per-member access token (table
`fs_tokens`, server-side only); tokens can be unlinked at any time from the
Research page.

> **Status: code complete, disabled until you add an app key.**
> Everything below takes about 10 minutes once FamilySearch enables your key
> (the Beta key is automatic; Production requires their Compatible Solution review).

## 1. Request an app key

1. Create a developer account at https://www.familysearch.org/developers/ and
   sign the app agreement ("App Approval Considerations").
2. Register an application. Note the **app key** shown on the Application
   Details page.
3. Register the **redirect URI** — must exactly match your public URL:
   ```
   http://localhost:3000/api/familysearch.php?action=callback      (dev)
   https://your-domain.example/api/familysearch.php?action=callback (prod)
   ```
4. Beta / Production: apps start with Beta access (old snapshot of production,
   fine for development). Production needs the Compatible Solution Program —
   see https://developers.familysearch.org/main/docs/get-started (App Approval).

## 2. Configure

Add to `api/config.local.php` (git-ignored, never committed):

```php
'familysearch_key' => 'ABCD-EF12-3456-7890-...',
'familysearch_env' => 'beta',            // 'beta' (default) or 'production'
```

Without a key the Research page shows "Not enabled on this site yet" and the
`connect`/`search` endpoints return 503 with a clear message.

## 3. How it works

- Research page → **Connect FamilySearch** → OAuth round trip to FamilySearch
  (`identbeta.familysearch.org` for beta) → returns to `/?view=research&fs=connected`.
- Member's access token stored in `fs_tokens` (24 h expiry; expires on 404/401
  from FamilySearch and the member re-links with one click).
- Searching with the **FamilySearch** tab calls `api/familysearch.php?action=search`,
  which proxies `GET /platform/tree/search` with the member's token
  (`q.givenName`, `q.surname`, `q.birthLikeDate`, `q.birthLikePlace`).
- Results link to the FamilySearch record via the person's ARK identifier.

## 4. Notes & limits

- **Beta vs Production**: beta is fine for trying the integration; in beta the
  data is a snapshot and some records may be missing.
- **Per-member consent**: each member links their own account. The site never
  sees passwords. There is no shared service account.
- **Tokens**: FS tokens expire after 24 h (or 60 idle minutes). We store the
  expiry and delete on failure; reconnecting is one click.
- **No writes**: the integration is read-only. No cut contacts with
  `update match status` or `create person` endpoints.
- **Records**: the public FamilySearch API exposes tree-person search and
  match/hint endpoints. Kenya BMD record **image browsing** remains a
  FamilySearch-site activity (your members just open the ark link).
- Until a key is configured the local tree search + Groq AI assistant work
  exactly as before.
