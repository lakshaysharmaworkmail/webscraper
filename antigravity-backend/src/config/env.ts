import dotenv from 'dotenv';

dotenv.config();

export const config = {
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/antigravity',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  adminTokens: [
    process.env.ADMIN_APPROVAL_TOKEN_1 || 'admin-approval-token-change-this',
  ],
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@antigravity.com',
  },
  apiKeys: {
    newsApi: process.env.NEWS_API_KEY || '',
    redditClientId: process.env.REDDIT_CLIENT_ID || '',
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET || '',
    youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
};