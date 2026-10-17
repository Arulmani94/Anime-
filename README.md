# TamilCartoons — Firebase + Vercel

## Files in this project
- `index.html` — website UI and Firebase SDK loading
- `app.js` — catalog, Google Drive preview iframe, Firebase Auth and Firestore admin functions
- `firestore.rules` — Firestore access rules (replaces the old Supabase SQL schema)
- `vercel.json` — Vercel static-site configuration
- `README.md` — setup instructions

## GitHub / Vercel deploy
1. Download and extract this ZIP.
2. In the existing GitHub repository, replace `index.html` and `app.js` with these files.
3. Add `firestore.rules` and `README.md`. Keep `vercel.json` (or replace it with this copy).
4. Commit the changes. Vercel should deploy automatically from the connected GitHub repository.

## Firebase setup (one-time)
1. In Firebase Console, open project `tamilcartoons-a8d0e`.
2. Authentication → Sign-in method → enable **Email/Password**.
3. Authentication → Users → create the admin account. The signed-in account UID must be `XO7clbb4fsTxY0z4DZVrZuBnqFt1` for this build.
4. Firestore Database → create a database if not already created.
5. Open Firestore → Rules, replace the rules with the contents of `firestore.rules`, then Publish.

## Important
- This build uses Firebase, not Supabase. Do not run the old `supabase-schema.sql`.
- Poster and episode thumbnail fields take image URLs; this build does not upload image files.
- Episode video links currently use Google Drive's preview iframe. This is not a direct-stream custom HTML5 player.
- Do not make Firestore writes public. The rules restrict writes to the configured admin UID.
- Existing Supabase data is not automatically copied into Firebase. If your existing catalog is only in Supabase, export/import it separately before switching the live site.
