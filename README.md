# Slick City Local Pack Rankings (Admate)

Weekly Google Search local pack rankings (positions 1 to 20 in Google's Places list; 1 to 3 is the map pack) for every Slick City park and keyword, via DataForSEO's Google Local Finder API.

## Environment variables (Vercel > Project > Settings > Environment Variables)
- `DATAFORSEO_AUTH`: base64 of `login:password` (shown on DataForSEO's API Access page as "Base64 format").
- `APP_PASSWORD`: team password for the login page (defaults to `admate`).
- `CRON_SECRET`: any random string; Vercel sends it to the cron routes.
- `BLOB_READ_WRITE_TOKEN`: added automatically when you connect a Vercel Blob store.

## Schedule (vercel.json)
- Monday 04:45 UTC: `/api/cron/post` queues all searches.
- Daily 05:45 UTC: `/api/cron/collect` collects finished results.

## Data
- `lib/parks.json`: parks, coordinates and keywords (edit to add parks or keywords).
- Blob `data/log.json`: every check. Starts from `lib/seed-log.json` (3-park test).
