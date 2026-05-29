# Antigravity - Backend & Frontend Setup Guide

## 📋 Project Structure

```
antigravity-backend/          # Node.js + Express + MongoDB backend
├── src/
│   ├── config/             # MongoDB & env configuration
│   ├── models/           # Mongoose models (User, Topic, ScrapedData, etc.)
│   ├── middleware/       # Auth middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── index.ts        # Entry point
├── .env.example        # Environment template
├── package.json
└── tsconfig.json

scrapeflow-frontend/       # React + Tailwind frontend
├── src/
│   ├── components/       # Reusable components
│   ├── context/       # Auth context
│   ├── pages/         # Page components
│   ├── App.jsx        # Main app with routing
│   └── index.css     # Tailwind styles
├── .env.example
└── package.json
```

---

## 🚀 Quick Setup

### 1. MongoDB Database (Required)

**Option A: MongoDB Atlas (Recommended - Free)**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create free account
3. Create free cluster (AWS/Azure/GCP)
4. Create database user (username/password)
5. Network Access → Add IP "0.0.0.0/0" (allows all IPs)
6. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/antigravity?retryWrites=true&w=majority
   ```

**Option B: Local MongoDB**
1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Start: `mongod`
3. URI: `mongodb://localhost:27017/antigravity`

### 2. Backend Setup

```bash
cd antigravity-backend
cp .env.example .env
# Edit .env with your MONGODB_URI and other values
```

**Required `.env` values:**
```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=generate-with-openssl-rand-base64-32
ADMIN_APPROVAL_TOKEN_1=generate-random-token
```

### 3. Start Backend

```bash
cd antigravity-backend
npm install
npm run dev
```

Server runs at: `http://localhost:3000`

### 4. Start Frontend

```bash
cd scrapeflow-frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## 🔌 API Endpoints

### Auth Routes (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login user | No |
| GET | `/me` | Get current user | Yes |
| GET | `/admin/users` | List all users | Admin |
| GET | `/admin/pending` | List pending users | Admin |
| POST | `/admin/approve/:token` | Approve user | No |
| POST | `/admin/reject/:token` | Reject user | No |

### Content Routes (`/api/content`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/topics` | List all topics | Yes |
| POST | `/topics` | Create topic | Yes |
| POST | `/topics/:id/subscribe` | Subscribe to topic | Yes |
| POST | `/topics/:id/unsubscribe` | Unsubscribe | Yes |
| GET | `/search?q=query` | Search content | Yes |
| GET | `/topic/:id/data` | Get scraped data | Yes |

### Admin Routes (`/api/admin`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/analytics` | Platform analytics | Admin |
| GET | `/api-keys` | List API keys | Admin |
| POST | `/api-keys` | Add API key | Admin |
| PATCH | `/api-keys/:id` | Update API key | Admin |
| GET | `/activity` | Activity logs | Admin |

---

## 🔐 Approval Flow

1. **User registers** → Stored with `status: "pending"`
2. **Admin gets email** with approve/reject links (if SMTP configured)
3. **Admin visits** `/api/auth/admin/approve/:token`
4. **User can login** → Status changed to `"approved"`

---

## 🗄️ MongoDB Collections

| Collection | Description |
|------------|-------------|
| `users` | User accounts with role/status |
| `topics` | Scrapable topics |
| `scraped_data` | Scraped content entries |
| `api_keys` | External API keys |
| `activity_logs` | User activity tracking |
| `subscriptions` | User topic subscriptions |
| `bookmarks` | User bookmarks |

---

## 🐳 Deploy

### Frontend → Vercel

1. Push code to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Set root directory: `scrapeflow-frontend`
4. Add environment variable:
   - `VITE_API_URL` → `https://your-backend.onrender.com/api`
5. Deploy — Vercel auto-detects Vite and uses `vercel.json`

### Backend → Render

1. Push code to GitHub
2. At [dashboard.render.com](https://dashboard.render.com), create **New Web Service**
3. Connect your repo, set root directory: `antigravity-backend`
4. Set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Health Check Path:** `/health`
   - **Plan:** Free
5. Add all environment variables from `.env.example` (especially `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL` pointing to your Vercel URL)
6. Deploy

> **Playwright on Render:** The Kwai scraper uses Playwright which requires system dependencies. If you get browser launch errors, either:
> - Use the Render Docker runtime instead of Node
> - Or add a `render.Dockerfile` (see Render docs)

### MongoDB Atlas
- Free tier cluster works fine
- Whitelist `0.0.0.0/0` in Network Access
- Use the connection string as `MONGODB_URI`

---

## 📝 Environment Variables

### Backend (.env)

```env
# Database
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Admin
ADMIN_APPROVAL_TOKEN_1=your-token

# Server
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

### Frontend (.env)

```env
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB + Mongoose
- **Auth:** JWT + bcrypt
- **Queue:** BullMQ (optional)
- **Frontend:** React, React Router, Tailwind CSS v4

---

## ⚠️ Important Notes

1. **First user** - After registering, manually set `role: 'admin'` in MongoDB
2. **Rate limiting** - Add for production
3. **API keys** - Add external service keys for scraping
4. **Email** - Configure SMTP for production notifications

---

## 🔧 Troubleshooting

**MongoDB Connection Error:**
- Check IP whitelist in MongoDB Atlas
- Verify connection string format
- Check username/password

**JWT Error:**
- Generate new secret: `openssl rand -base64 32`

**Admin Access:**
```bash
# Connect to MongoDB and update
use antigravity
db.users.updateOne({ email: "your@email.com" }, { $set: { role: "admin" } })
```