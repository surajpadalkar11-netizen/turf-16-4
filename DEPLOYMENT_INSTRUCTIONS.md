# 🚀 TurfBook Deployment Guide

This guide provides the exact settings and environment variables you need to configure when deploying your three applications.

## 1️⃣ Backend (Render)
Deploy your `backend` directory as a **Web Service** on Render.

**Settings:**
- **Build Command:** `npm install`
- **Start Command:** `npm start` (or `node server.js`)

**Environment Variables (Env Vars):**
You must add these in the Render dashboard:
- `CLIENT_URL`: `https://<your-frontend-vercel-url>.vercel.app` *(Required for CORS so frontend can talk to backend)*
- `ADMIN_URL`: `https://<your-admin-vercel-url>.vercel.app` *(Required for CORS so admin can talk to backend)*
- `API_URL`: `https://<your-backend-render-url>.onrender.com` *(Required for creating review links in emails)*
- `SUPABASE_URL`: Your Supabase Project URL
- `SUPABASE_KEY`: Your Supabase Anon Key
- `SUPABASE_SERVICE_KEY`: Your Supabase Service Role Key
- `JWT_SECRET`: A secure random string for signing JWT tokens
- `GMAIL_USER`: Your Gmail Address
- `GMAIL_PASS`: Your 16-character Gmail App Password

---

## 2️⃣ Frontend (Vercel)
Deploy your `frontend` directory as a new project on Vercel.

**Settings:**
- **Framework Preset:** Vite (Vercel should automatically detect this)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

**Environment Variables:**
You must add this in the Vercel project settings **before** deploying (so it gets built into the app):
- `VITE_API_URL`: `https://<your-backend-render-url>.onrender.com/api`

---

## 3️⃣ Admin (Vercel)
Deploy your `admin` directory as a new project on Vercel.

**Settings:**
- **Framework Preset:** Vite (Vercel should automatically detect this)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

**Environment Variables:**
You must add these in the Vercel project settings **before** deploying:
- `VITE_API_URL`: `https://<your-backend-render-url>.onrender.com/api`
- `VITE_FRONTEND_URL`: `https://<your-frontend-vercel-url>.vercel.app` *(Required so admin dashboard can link directly to frontend turf pages)*

---

### Important Notes:
* Since Vercel env vars are injected at build time, after you deploy the Backend to Render, you **must copy the Render URL**, paste it into `VITE_API_URL` in both Vercel projects, and **trigger a redeploy** for the frontend and admin.
* The codebase is now utilizing `import.meta.env.VITE_API_URL` as a fallback, so running `npm run dev` locally will continue to work perfectly on `localhost` without any changes.
* Image uploads are automatically handled via Supabase storage, which makes Render's free tier (ephemeral storage) fully compatible without issues.
