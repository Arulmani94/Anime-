# TamilCartoons App — GitHub + Vercel + Supabase

This is the next-stage source project based on the TamilCartoons dark/blue design. It includes a Supabase-backed public catalogue, email/password admin sign-in, title CRUD, poster upload, season/episode CRUD, episode thumbnail upload, Google Drive preview links, episode-specific player pages, and ad placeholders.

## 1. Create the database (free tier is enough to test)
1. Create a Supabase project.
2. Open **SQL Editor** and run all of `supabase-schema.sql`.
3. In Supabase **Project Settings → API**, copy the Project URL and the `anon` / publishable public key.
4. Open `app.js`; replace `PASTE_SUPABASE_PROJECT_URL_HERE` and `PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE` with those values. Never put a `service_role` or secret key in frontend code.

## 2. Create your first admin account
1. In Supabase **Authentication → Users**, add/create a user with your email and password (or use the app Admin button to sign up only if you add a sign-up UI; this project intentionally uses admin-created accounts).
2. Copy that user's UUID from Authentication → Users.
3. Run this SQL in Supabase SQL Editor, replacing the UUID:

```sql
insert into public.admin_users (user_id)
values ('PASTE-AUTH-USER-UUID-HERE')
on conflict (user_id) do nothing;
```

Only UUIDs manually inserted into `admin_users` are administrators. Do not make this table publicly writable.

## 3. Upload to GitHub and deploy on Vercel
1. Upload `index.html`, `app.js`, `supabase-schema.sql`, `README.md`, and `vercel.json` into the root of a new GitHub repository.
2. In Vercel, import that repository and deploy as a static site (no build command; output/root directory `.`).
3. Use the deployed URL, press **Admin**, and sign in with the admin user created above.

## 4. Add titles and episodes
- Fill title, type, language, release year, status, genre, studio, rating, poster URL or upload a poster, and storyline. Choose Published to show it publicly.
- Click **Save Anime**. The Season & Episode Manager appears.
- For each episode, enter season number, episode number, Drive URL, and optionally a thumbnail URL or upload a thumbnail image. Choose Published.
- Episode thumbnails show as a visual list. Clicking an episode shows the demo interstitial/continue screen, then opens its saved Drive preview link.
- To make an episode image appear, provide a thumbnail URL/upload. If omitted, the anime poster is used as fallback.

## Important notes
- This frontend uses Supabase Auth + database + Storage. The database persists after redeploying Vercel.
- Google Drive playback requires the Drive file to be viewable by the intended audience and embeddable by Google. This does not bypass Drive restrictions; some videos may not play in a frame.
- The website's ad boxes and Continue interstitial are placeholders, not real paid ads. Use a compliant web ad provider for web ads. AdMob is for supported native/mobile app placements; do not fake interstitials or force ad clicks.
- Do not put copyrighted video files in the `media` image bucket. Store only images there; `drive_url` stores the video link.
- Supabase free-tier limits and terms can change. Keep database backups and never share the admin password.
- For production, add rate limiting, stronger admin audit logging, and a proper consent/privacy notice as needed.
