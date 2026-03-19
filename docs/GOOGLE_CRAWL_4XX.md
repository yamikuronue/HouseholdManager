# Google Search Console: "Blocked due to other 4xx issue"

## What it means

**"Page fetch error: Failed: Blocked due to other 4xx issue"** means Googlebot received an HTTP 4xx status when requesting your URL. Crawl is allowed (robots.txt isn’t blocking), but the server responded with a client error, so indexing is not possible.

Common 4xx codes that trigger this:

| Code | Meaning | Typical cause |
|------|--------|----------------|
| **403** | Forbidden | Firewall/WAF, security rules, or server blocking the request |
| **404** | Not Found | Wrong URL or your app returning 404 for that path |
| **401** | Unauthorized | Page requires login (crawlers don’t send cookies) |
| **429** | Too Many Requests | Rate limiting (e.g. on auth or API) |
| **405** | Method Not Allowed | Crawler used a method your server doesn’t allow for that URL |

## How to fix it

### 1. See which URL and code Google got

In Search Console:

- **URL Inspection** → enter the exact URL that fails (e.g. `https://lionfish.cloud/`).
- Check **"Page fetch"** / **"Live URL"** to see the real response.

If you can, reproduce the same request (see step 3) and note the **exact HTTP status code** (403, 404, etc.). That tells you what to fix.

### 2. Ensure the root URL returns 200

- **Root:** `https://lionfish.cloud/` should return **200** and your app’s HTML (or API message if no frontend).
- **robots.txt:** `https://lionfish.cloud/robots.txt` should return **200** and plain text (the app serves this route so crawlers are not blocked by a missing or wrong robots.txt).

If the **root** returns 404/403, fix routing or hosting so the homepage is reachable without auth.

### 3. Reproduce the crawl (including “smartphone” user agent)

Google often crawls as a **smartphone** user agent. Test the same URL yourself:

```bash
# Root
curl -I -A "Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36" https://lionfish.cloud/

# robots.txt
curl -I https://lionfish.cloud/robots.txt
```

Check the first line for the status (e.g. `HTTP/2 200` or `HTTP/2 403`). If you get 4xx here, fix that in your app or hosting (see below).

### 4. **www vs non-www / http vs https** (e.g. `http://www.lionfish.cloud/`)

If Google tried to crawl **`http://www.lionfish.cloud/`** but your app is only set up for **`https://lionfish.cloud`** (no `www`), the request can hit a host that doesn’t serve your app and return 4xx (e.g. 404).

**Fix:** Redirect `www` and `http` to your canonical URL.

1. **DigitalOcean App Platform**
   - Open your app → **Settings** → **App-level** or **Component** → **Domains**.
   - Add **`www.lionfish.cloud`** as a domain (if not already).
   - Ensure **`lionfish.cloud`** is the primary/canonical domain.
   - Use DO’s **Redirect** option so that:
     - `http://www.lionfish.cloud` → `https://lionfish.cloud`
     - `https://www.lionfish.cloud` → `https://lionfish.cloud`
     - `http://lionfish.cloud` → `https://lionfish.cloud`
   - Save and wait for DNS/SSL to propagate.

2. **DNS (if you manage it elsewhere)**
   - Add a CNAME for `www` to the same target as `lionfish.cloud` (e.g. your DO app URL), **or**
   - Use your DNS/hosting “redirect” or “forwarding” to send `www` and `http` to `https://lionfish.cloud`.

3. **In Google Search Console**
   - Add the **property** for `https://lionfish.cloud` (canonical) if you haven’t.
   - Submit **`https://lionfish.cloud/`** for indexing (not the www or http URL).
   - After redirects work, `http://www.lionfish.cloud/` will 301 to `https://lionfish.cloud/` and Google can index the canonical URL.

### 5. Other typical causes for this app

- **Wrong URL:** If the inspected URL is something like `https://lionfish.cloud/api` or `/api/...`, the app intentionally returns **404** for API paths (so they aren’t indexed). That’s expected. Submit and test the **canonical page URL** (e.g. `https://lionfish.cloud/`) in URL Inspection.
- **No static build in production:** If the frontend static build isn’t present, some paths might 404. The Dockerfile copies the frontend into `/app/static`; confirm the image and deploy include that.
- **Firewall / WAF / bot protection:** If Digital Ocean or a CDN in front blocks or rate-limits Googlebot, you’ll see 403/429. In the DO / CDN dashboard, allow Googlebot (and optionally other well-known crawlers) or relax rules for the homepage and `/robots.txt`.
- **Rate limiting:** The app only rate-limits `/api/auth`. Normal GETs to `/` or `/robots.txt` are not limited. If something else (e.g. a proxy) rate-limits by IP, crawlers can get 429.

### 6. After fixing

1. Fix the server so the **exact URL** you care about returns **200** (and correct content).
2. In Search Console, use **URL Inspection → Request indexing** for that URL.
3. Wait for the next crawl; the “Blocked due to other 4xx issue” should clear once the server returns 2xx.

## Summary

- **4xx** = server is telling the client “this request is not allowed / not found / etc.”, so Google doesn’t index.
- Find the **exact URL** and **status code** (via Search Console and curl).
- Ensure **root** and **/robots.txt** return **200** and that nothing (app, WAF, rate limit) returns 4xx for the canonical page URL.
- The app serves **/robots.txt** and allows `Allow: /` while disallowing `/api/`, `/docs`, etc., so crawlers can index the site without hitting API/auth paths.
