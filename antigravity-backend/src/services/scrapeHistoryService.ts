import { ScrapeHistory } from '../models/index.js';
import mongoose from 'mongoose';

interface SaveScrapeParams {
  userId: string;
  userEmail: string;
  platform: string;
  url: string;
  status: 'success' | 'error';
  resultData?: any;
  errorMessage?: string;
}

export async function saveScrapeHistory(params: SaveScrapeParams) {
  try {
    await ScrapeHistory.create({
      userId: new mongoose.Types.ObjectId(params.userId),
      userEmail: params.userEmail,
      platform: params.platform,
      url: params.url,
      status: params.status,
      resultData: params.resultData,
      errorMessage: params.errorMessage
    });
  } catch (error) {
    console.error('[ScrapeHistory] Failed to save:', error);
  }
}

export async function getScrapeHistoryByUser(userId: string, limit = 50) {
  return ScrapeHistory.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit);
}

export async function getAllScrapeHistory(limit = 100, skip = 0) {
  return ScrapeHistory.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

export async function getScrapeStats() {
  const totalScrapes = await ScrapeHistory.countDocuments();
  const successCount = await ScrapeHistory.countDocuments({ status: 'success' });
  const errorCount = await ScrapeHistory.countDocuments({ status: 'error' });
  
  const platformStats = await ScrapeHistory.aggregate([
    { $group: { _id: '$platform', count: { $sum: 1 } } }
  ]);

  const dailyStats = await ScrapeHistory.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 7 }
  ]);

  return { totalScrapes, successCount, errorCount, platformStats, dailyStats };
}

export async function getUserStats(userId: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const userScrapes = await ScrapeHistory.find({ userId: userObjectId });
  
  const totalScrapes = userScrapes.length;
  const successCount = userScrapes.filter(s => s.status === 'success').length;
  const errorCount = userScrapes.filter(s => s.status === 'error').length;
  
  const platformUsage: Record<string, number> = {};
  userScrapes.forEach(s => {
    platformUsage[s.platform] = (platformUsage[s.platform] || 0) + 1;
  });

  const firstScrape = userScrapes.length > 0 
    ? userScrapes.reduce((oldest, curr) => 
        curr.createdAt < oldest.createdAt ? curr : oldest
      ).createdAt
    : null;
  
  const lastScrape = userScrapes.length > 0 
    ? userScrapes.reduce((newest, curr) => 
        curr.createdAt > newest.createdAt ? curr : newest
      ).createdAt
    : null;

  return {
    totalScrapes,
    successCount,
    errorCount,
    platformUsage,
    firstScrape,
    lastScrape,
    daysActive: firstScrape 
      ? Math.ceil((Date.now() - new Date(firstScrape).getTime()) / (1000 * 60 * 60 * 24)) 
      : 0
  };
}

export async function getAllUsersStats() {
  const users = await ScrapeHistory.aggregate([
    {
      $group: {
        _id: '$userId',
        userEmail: { $first: '$userEmail' },
        totalScrapes: { $sum: 1 },
        successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        errorCount: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
        firstScrape: { $min: '$createdAt' },
        lastScrape: { $max: '$createdAt' },
        platforms: { $addToSet: '$platform' }
      }
    },
    { $sort: { lastScrape: -1 } }
  ]);

  return users;
}