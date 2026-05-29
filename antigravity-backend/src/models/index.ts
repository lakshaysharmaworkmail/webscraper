import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  displayName: { type: String },
  approvalToken: { type: String, unique: true, sparse: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  tokenVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);

const topicSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastScrapedAt: { type: Date },
  scrapeInterval: { type: Number, default: 3600000 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const Topic = mongoose.models.Topic || mongoose.model('Topic', topicSchema);

const scrapedDataSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  topicName: String,
  content: String,
  title: String,
  url: String,
  source: String,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
});

export const ScrapedData = mongoose.models.ScrapedData || mongoose.model('ScrapedData', scrapedDataSchema);

const apiKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  service: { type: String, required: true },
  usageCount: { type: Number, default: 0 },
  dailyLimit: { type: Number, default: 1000 },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  lastUsedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema);

const activityLogSchema = new mongoose.Schema({
  userId: { type: String },
  action: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
});

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);

const scrapeHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String, required: true },
  platform: { type: String, required: true },
  url: { type: String, required: true },
  status: { type: String, enum: ['success', 'error'], default: 'success' },
  resultData: { type: mongoose.Schema.Types.Mixed },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
});

scrapeHistorySchema.index({ userId: 1, createdAt: -1 });
scrapeHistorySchema.index({ platform: 1, createdAt: -1 });

export const ScrapeHistory = mongoose.models.ScrapeHistory || mongoose.model('ScrapeHistory', scrapeHistorySchema);