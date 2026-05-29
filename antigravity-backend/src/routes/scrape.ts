import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { saveScrapeHistory } from '../services/scrapeHistoryService.js';
import { chromium, Browser } from 'playwright';

export let pwBrowser: Browser | null = null;

const router = Router();

async function getPlaywrightBrowser(): Promise<Browser> {
  if (!pwBrowser || !pwBrowser.isConnected()) {
    pwBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  }
  return pwBrowser;
}

async function fetchKwaiHtmlPlaywright(url: string): Promise<string | null> {
  const browser = await getPlaywrightBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const html = await page.content();
    return html.length > 5000 ? html : null;
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

let lastRequestTime = 0;
const MIN_INTERVAL = 1100;

async function rateLimitedFetch(promiseFn: () => Promise<unknown>): Promise<unknown> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
  return promiseFn();
}

function formatNumberWithCommas(n: number): string {
  if (!n && n !== 0) return '';
  return Number(n).toLocaleString('en-US');
}

function formatTikTokDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
}

function formatTikTokDate(timestamp: number): string {
  try {
    const ts = timestamp > 1e11 ? timestamp : timestamp * 1000;
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch { return '-'; }
}

router.post('/scrape', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { platform, url } = req.body;
    if (!platform || !url) { res.status(400).json({ error: 'Platform and URL are required' }); return; }
    const data = await scrapePlatform(platform, url);
    await saveScrapeHistory({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      platform,
      url,
      status: data && (data as any).error ? 'error' : 'success',
      resultData: data,
      errorMessage: data && (data as any).error ? (data as any).error : undefined
    });
    const singleHeaders: Record<string, string[]> = {
      tiktok: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Profile URL', 'Display Name', 'Subscribers'],
      facebook: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      dailymotion: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Name', 'Channel Username', 'Followers', 'Channel URL'],
      archive: ['URL', 'Title', 'Upload Date', 'Views', 'File Duration', 'Username', 'Followers / Subscribers', 'Profile URL', 'Status'],
      twitter: ['Video URL', 'Video Title / Tweet Text', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      youtube: ['Video URL', 'Video Title', 'Video ID', 'Views', 'Duration', 'Channel ID', 'Channel Name', 'Username', 'Channel URL', 'Subscribers', 'Likes', 'Upload Date', 'Live Status', 'Live Viewers'],
      okru: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      telegram: ['Input URL', 'Channel Username', 'Channel Name', 'Description', 'Subscribers', 'Post Views', 'Post Date & Time (IST)', 'Post Text', 'Channel URL', 'Status'],
      kwai: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      snackvideo: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status']
    };
    res.json({ headers: singleHeaders[platform] || [], data: [data] });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Scraping failed' }); }
});

router.post('/scrape/bulk', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { platform, urls } = req.body;
    if (!platform || !urls || !Array.isArray(urls)) { res.status(400).json({ error: 'Platform and URLs array are required' }); return; }
    console.log('[BULK] Starting', urls.length, 'URLs for', platform);
    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      let result;
      try {
        console.log(`[BULK] ${i + 1}/${urls.length}: Processing ${url}`);
        result = await rateLimitedFetch(() => scrapePlatform(platform, url));
        results.push(result);
        await saveScrapeHistory({
          userId: req.user!.userId,
          userEmail: req.user!.email,
          platform,
          url,
          status: result && (result as any).error ? 'error' : 'success',
          resultData: result,
          errorMessage: result && (result as any).error ? (result as any).error : undefined
        });
      } catch (e) {
        console.error('[BULK] Error:', url, e);
        results.push({ url, error: 'Failed: ' + (e instanceof Error ? e.message : String(e)) });
        await saveScrapeHistory({
          userId: req.user!.userId,
          userEmail: req.user!.email,
          platform,
          url,
          status: 'error',
          resultData: null,
          errorMessage: e instanceof Error ? e.message : String(e)
        });
      }
    }
    console.log('[BULK] Completed all URLs');
    const bulkHeaders: Record<string, string[]> = {
      tiktok: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Profile URL', 'Display Name', 'Subscribers'],
      facebook: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      dailymotion: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Name', 'Channel Username', 'Followers', 'Channel URL'],
      archive: ['URL', 'Title', 'Upload Date', 'Views', 'File Duration', 'Username', 'Followers / Subscribers', 'Profile URL', 'Status'],
      twitter: ['Video URL', 'Video Title / Tweet Text', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      youtube: ['Video URL', 'Video Title', 'Video ID', 'Views', 'Duration', 'Channel ID', 'Channel Name', 'Username', 'Channel URL', 'Subscribers', 'Likes', 'Upload Date', 'Live Status', 'Live Viewers'],
      okru: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      telegram: ['Input URL', 'Channel Username', 'Channel Name', 'Description', 'Subscribers', 'Post Views', 'Post Date & Time (IST)', 'Post Text', 'Channel URL', 'Status'],
      kwai: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status'],
      snackvideo: ['Video URL', 'Video Title', 'Views', 'Duration', 'Upload Date', 'Channel Username', 'Profile Name', 'Followers', 'Profile URL', 'Status']
    };
    const headers = bulkHeaders[platform] || [];
    res.json({ headers, data: results });
  } catch (error) { 
    console.error('[BULK] Fatal error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Bulk scraping failed' }); 
  }
});

async function scrapePlatform(platform: string, url: string) {
  switch (platform) {
    case 'tiktok': return await tiktokScraper(url);
    case 'facebook': return await facebookScraper(url);
    case 'dailymotion': return await dailymotionScraper(url);
    case 'archive': return await archiveScraper(url);
    case 'twitter': return await twitterScraper(url);
    case 'youtube': return await youtubeScraper(url);
    case 'okru': return await okruScraper(url);
    case 'telegram': return await telegramScraper(url);
    case 'kwai': return await kwaiScraper(url);
    case 'snackvideo': return await snackvideoScraper(url);
    default: return { url, error: 'Platform is not supported' };
  }
}

function parseTikTokUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const s = url.trim();
  if (!s.toLowerCase().includes('tiktok')) return '';
  try {
    const urlObj = new URL(s.startsWith('http') ? s : 'https://' + s.replace(/^\/\//, ''));
    const pathname = urlObj.pathname;
    const host = urlObj.hostname.toLowerCase();
    if (host.includes('vm.tiktok.com')) {
      return 'https://vm.tiktok.com' + pathname;
    }
    if (host.includes('tiktok.com')) {
      const match = pathname.match(/^\/(@[\w.\-]+)(?:\/video\/(\d+))?/i);
      if (match) {
        const username = match[1];
        const videoId = match[2];
        if (videoId) return `https://www.tiktok.com/@${username}/video/${videoId}`;
        return `https://www.tiktok.com/@${username}`;
      }
      const shareMatch = pathname.match(/^\/t\/([\w\-]+)/i);
      if (shareMatch) return s.startsWith('http') ? s : 'https://www.tiktok.com' + pathname;
    }
  } catch {}
  return s.startsWith('http') ? s : '';
}

async function fetchFollowersTiktok(username: string): Promise<string> {
  if (!username) return '-';
  const u = username.replace('@', '').trim();
  if (!u) return '-';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${u}`, { 
        method: 'GET', 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
          'Accept': 'application/json',
          'Referer': 'https://www.tiktok.com/'
        }
      });
      if (res.status === 200) {
        const json = await res.json() as any;
        const d = json?.data;
        if (d) {
          const count = 
            d?.stats?.followerCount || 
            d?.userInfo?.stats?.followerCount ||
            d?.user_info?.stats?.followerCount || 
            d?.followerCount || 
            d?.follower_count || 
            d?.fans ||
            d?.author?.follower_count ||
            d?.author_stats?.follower_count ||
            d?.statistics?.followerCount ||
            0;
          if (count > 0) return count.toLocaleString();
        }
      }
    } catch (e) {
      console.error('[TikTok] Followers fetch attempt error:', e);
    }
    if (attempt < 1) await new Promise(r => setTimeout(r, 500));
  }
  return '-';
}

async function tiktokScraper(url: string) {
  const videoUrl = parseTikTokUrl(url);
  if (!videoUrl) return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Profile URL': '-', 'Display Name': '-', 'Subscribers': '-', error: 'Invalid TikTok URL' };
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`;
    console.log('[TikTok] API URL:', apiUrl);
    const res = await fetch(apiUrl, { 
      method: 'GET', 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
        'Accept': 'application/json',
        'Referer': 'https://www.tiktok.com/'
      } 
    });
    const text = await res.text();
    console.log('[TikTok] API response status:', res.status, 'text:', text.substring(0, 200));
    if (res.status !== 200) { 
      console.log('[TikTok] API error:', res.status, text.substring(0, 300)); 
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Profile URL': '-', 'Display Name': '-', 'Subscribers': '-', error: 'TikTok API error: ' + res.status }; 
    }
    const json = JSON.parse(text);
    if (json.code !== 0) {
      console.log('[TikTok] API error code:', json.code, json.msg);
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Profile URL': '-', 'Display Name': '-', 'Subscribers': '-', error: json.msg || 'API error: ' + json.code };
    }
    const d = json?.data;
    if (!d || !d.title) {
      console.log('[TikTok] No data. Response:', JSON.stringify(json)?.substring(0, 300));
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Profile URL': '-', 'Display Name': '-', 'Subscribers': '-', error: json?.msg || 'No data in TikTok response' };
    }
    const author = d as any;
    const stats = d as any;
    const views = d.play_count ? formatNumberWithCommas(d.play_count) : '-';
    const likes = stats.like_count ? formatNumberWithCommas(stats.like_count) : '-';
    const comments = stats.comment_count ? formatNumberWithCommas(stats.comment_count) : '-';
    const shares = stats.share_count ? formatNumberWithCommas(stats.share_count) : '-';
    const duration = d.duration ? formatTikTokDuration(d.duration) : '-';
    const uploadDate = d.create_time ? formatTikTokDate(d.create_time) : '-';
    const authorUsername = author.author?.unique_id ? '@' + author.author.unique_id : '-';
    const displayName = author.author?.nickname || author.author?.unique_id || '-';
    const profileUrl = author.author?.unique_id ? 'https://www.tiktok.com/@' + author.author.unique_id : '-';
    const followers = await fetchFollowersTiktok(author.author?.unique_id || '');
    return {
      'Video URL': url,
      'Video Title': d.title || '-',
      'Views': views,
      'Duration': duration,
      'Upload Date': uploadDate,
      'Profile URL': profileUrl,
      'Display Name': displayName,
      'Subscribers': followers
    };
  } catch (e) {
    console.error('[TikTok] Error:', e);
    return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Profile URL': '-', 'Display Name': '-', 'Subscribers': '-', error: 'Failed: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

async function facebookScraper(url: string) {
  try {
    if (!url.includes('facebook.com') && !url.includes('fb.com') && !url.includes('fb.watch')) {
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Invalid Facebook URL' };
    }
    if (url.includes('fb.watch') || (url.includes('fb.com') && !url.includes('facebook.com'))) {
      try {
        const expRes = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
        const loc = expRes.headers.get('location');
        if (loc && loc.includes('facebook.com')) url = loc;
      } catch {}
    }
    const data = await fetchFacebookData(url);
    if (!data) {
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Not Found / Private' };
    }
    return {
      'Video URL': url,
      'Video Title': data.title,
      'Views': data.views,
      'Duration': data.duration,
      'Upload Date': data.uploadDate,
      'Channel Username': data.username,
      'Profile Name': data.profileName,
      'Followers': data.followers,
      'Profile URL': data.profileUrl,
      'Status': 'Done'
    };
  } catch (e) {
    return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Error: ' + String(e) };
  }
}

async function fetchFacebookData(url: string): Promise<any> {
  let desktopHtml: string | null = null;
  let mobileHtml: string | null = null;
  let mbasicHtml: string | null = null;
  let embedHtml: string | null = null;
  let watchHtml: string | null = null;
  let oData: any = null;
  const videoId = extractFBVideoId(url);
  const userAgents = {
    desktop: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    facebookBot: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
  };
  const acceptLang = 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';
  const requests = [];
  const meta: any = { url, videoId, reqCount: 0, startIdx: 0 };
  meta.startIdx = requests.length;
  requests.push({ url: url, method: 'GET', headers: { 'User-Agent': userAgents.facebookBot, 'Accept': 'text/html,*/*', 'Accept-Language': acceptLang }, redirect: 'follow' });
  meta.reqCount++;
  const mobileUrl = url.replace(/(?:www\.)?facebook\.com/i, 'm.facebook.com');
  const mbasicUrl = url.replace(/(?:www\.)?facebook\.com/i, 'mbasic.facebook.com');
  requests.push({ url: mobileUrl, method: 'GET', headers: { 'User-Agent': userAgents.mobile, 'Accept': 'text/html,*/*', 'Accept-Language': acceptLang }, redirect: 'follow' });
  meta.reqCount++;
  requests.push({ url: mbasicUrl, method: 'GET', headers: { 'User-Agent': userAgents.mobile, 'Accept': 'text/html,*/*', 'Accept-Language': acceptLang }, redirect: 'follow' });
  meta.reqCount++;
  if (videoId) {
    const embedUrl = 'https://www.facebook.com/video/embed?video_id=' + videoId;
    requests.push({ url: embedUrl, method: 'GET', headers: { 'User-Agent': userAgents.desktop, 'Accept': 'text/html,*/*', 'Accept-Language': acceptLang }, redirect: 'follow' });
    meta.reqCount++;
    const watchUrl = 'https://www.facebook.com/watch/?v=' + videoId;
    requests.push({ url: watchUrl, method: 'GET', headers: { 'User-Agent': userAgents.desktop, 'Accept': 'text/html,*/*', 'Accept-Language': acceptLang }, redirect: 'follow' });
    meta.reqCount++;
  }
  try {
    const responses = await Promise.all(requests.map(async (r) => {
      try {
        const res = await fetch(r.url, { method: 'GET', headers: r.headers, redirect: 'follow' });
        if (res.status === 200) {
          const text = await res.text();
          if (text && text.length > 3000 && !isFBFullLoginWall(text)) return text;
        }
      } catch {}
      return null;
    }));
    desktopHtml = responses[0] || null;
    mobileHtml = responses[1] || null;
    mbasicHtml = responses[2] || null;
    embedHtml = videoId ? (responses[3] || null) : null;
    watchHtml = videoId ? (responses[4] || null) : null;
  } catch (e) { console.log('[FB] Fetch error:', e); }
  try {
    const oRes = await fetch('https://www.facebook.com/plugins/video/oembed.json?url=' + encodeURIComponent(url), {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (oRes.status === 200) {
      const j: any = await oRes.json();
      if (j && ((j.title && !isFBLoginWall(j.title)) || j.author_name)) {
        oData = { title: j.title ? decodeFBHtml(j.title) : '-', authorName: j.author_name, authorUrl: j.author_url };
      }
    }
  } catch (e) { console.log('[FB] oEmbed error:', e); }
  if (!oData && videoId) {
    try {
      const watchUrl = 'https://www.facebook.com/watch/?v=' + videoId;
      const oRes2 = await fetch('https://www.facebook.com/plugins/video/oembed.json?url=' + encodeURIComponent(watchUrl), {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      if (oRes2.status === 200) {
        const j: any = await oRes2.json();
        if (j && ((j.title && !isFBLoginWall(j.title)) || j.author_name)) {
          oData = { title: j.title ? decodeFBHtml(j.title) : '-', authorName: j.author_name, authorUrl: j.author_url };
        }
      }
    } catch {}
  }
  if (!desktopHtml && !mobileHtml && !mbasicHtml && !oData) return null;
  return await parseFBVideoData(url, desktopHtml, mobileHtml, mbasicHtml, embedHtml, watchHtml, oData);
}

async function parseFBVideoData(url: string, desktopHtml: string | null, mobileHtml: string | null, mbasicHtml: string | null, embedHtml: string | null, watchHtml: string | null, oData: any): Promise<any> {
  let rawTitle: string | null = null;
  if (oData && oData.title && !isFBLoginWall(oData.title)) rawTitle = oData.title;
  if (!rawTitle) rawTitle = extractFBRawTitle(desktopHtml!) || extractFBRawTitle(mobileHtml!) || extractFBRawTitle(mbasicHtml!) || extractFBRawTitle(watchHtml!);
  if (!rawTitle) return null;
  rawTitle = decodeFBHtml(rawTitle);
  const viewsFromTitle = extractFBViewsFromTitle(rawTitle);
  const profileNameFromTitle = extractFBProfileNameFromTitle(rawTitle);
  const cleanTitle = cleanFBVideoTitle(rawTitle);
  if (isFBLoginWall(cleanTitle)) return null;
  const views = extractFBViews(desktopHtml!) || extractFBViews(mobileHtml!) || extractFBViews(mbasicHtml!) || extractFBViews(watchHtml!) || viewsFromTitle || '-';
  let duration = '-';
  [embedHtml!, watchHtml!, desktopHtml!, mobileHtml!, mbasicHtml!].forEach(function(h) { if (duration === '-' && h) duration = extractFBDuration(h); });
  const uploadDate = extractFBDate(desktopHtml!) || extractFBDate(mobileHtml!) || extractFBDate(mbasicHtml!) || extractFBDate(watchHtml!) || '-';
  const mobileUrl = url.replace(/(?:www\.)?facebook\.com/i, 'm.facebook.com');
  const mbasicUrl = url.replace(/(?:www\.)?facebook\.com/i, 'mbasic.facebook.com');
  let owner = extractFBOwner(desktopHtml!, url) || extractFBOwner(mobileHtml!, mobileUrl) || extractFBOwner(mbasicHtml!, mbasicUrl) || extractFBOwner(watchHtml!, url);
  if (!owner) owner = { username: '-', profileUrl: '-' };
  if (owner.username !== '-' && owner.username.replace('@', '') && /^@?\d+$/.test(owner.username.replace('@', ''))) {
    const nId = owner.username.replace('@', '');
    owner.username = 'id=' + nId;
    owner.profileUrl = 'https://www.facebook.com/profile.php?id=' + nId;
  }
  if (owner.profileUrl && owner.profileUrl.indexOf('profile.php') !== -1) {
    const idM = owner.profileUrl.match(/[?&]id=(\d+)/);
    if (idM) { owner.username = 'id=' + idM[1]; owner.profileUrl = 'https://www.facebook.com/profile.php?id=' + idM[1]; }
  }
  if (owner.username === '-' && oData && oData.authorUrl) {
    const um = oData.authorUrl.match(/facebook\.com\/([^\/\?&]+)/i);
    if (um && um[1] !== 'video' && um[1] !== 'watch') {
      const uv = um[1];
      if (/^\d+$/.test(uv)) { owner.username = 'id=' + uv; owner.profileUrl = 'https://www.facebook.com/profile.php?id=' + uv; }
      else { owner.username = '@' + uv; owner.profileUrl = 'https://www.facebook.com/' + uv; }
    }
  }
  let profileName: string | null = null;
  if (oData && oData.authorName && !isFBLoginWall(oData.authorName)) profileName = oData.authorName;
  if (!profileName && profileNameFromTitle) profileName = profileNameFromTitle;
  if (!profileName) {
    profileName = cleanFB(extractFBProfileName(desktopHtml!)) || cleanFB(extractFBProfileName(mobileHtml!)) || cleanFB(extractFBProfileName(mbasicHtml!)) || cleanFB(extractFBProfileName(watchHtml!)) || '-';
  }
  if (profileName === '-' && (owner.profileUrl && owner.profileUrl !== '-')) {
    try {
      const profRes = await fetch(owner.profileUrl.replace('www.facebook.com', 'm.facebook.com'), {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15', 'Accept': 'text/html' },
        redirect: 'follow'
      });
      if (profRes.status === 200) {
        const profHtml = await profRes.text();
        const pn = cleanFB(extractFBProfileName(profHtml));
        if (pn) profileName = pn;
      }
    } catch {}
  }
  // profile.php?id=xxx → follow redirect; if redirect to vanity URL, use it; else keep ID
  if (owner.profileUrl && owner.profileUrl.indexOf('profile.php') !== -1) {
    try {
      const profRes = await fetch(owner.profileUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Accept': 'text/html' },
        redirect: 'follow'
      });
      if (profRes.status === 200) {
        const finalUrl = profRes.url;
        const vanityMatch = finalUrl.match(/facebook\.com\/([a-zA-Z][a-zA-Z0-9.\-]{2,50})(?:\/|$)/i);
        if (vanityMatch && !/^(profile\.php|watch|reel|video|story|groups|pages|plugins|share|sharer|about|photos|videos|login|checkpoint|home|messages|notifications|settings|people)$/i.test(vanityMatch[1]) && !isFBLoginWall(vanityMatch[1]) && isValidFBHandle(vanityMatch[1])) {
          owner.username = '@' + vanityMatch[1];
          owner.profileUrl = 'https://www.facebook.com/' + vanityMatch[1];
        }
      }
    } catch {}
  }
  if (profileName !== '-' && owner.profileUrl === '-' && oData && oData.authorUrl) {
    const um = oData.authorUrl.match(/facebook\.com\/([^\/\?&]+)/i);
    if (um && um[1] !== 'video' && um[1] !== 'watch' && !isFBLoginWall(um[1]) && isValidFBHandle(um[1])) {
      const uv = um[1];
      if (/^\d+$/.test(uv)) { owner.username = 'id=' + uv; owner.profileUrl = 'https://www.facebook.com/profile.php?id=' + uv; }
      else { owner.username = '@' + uv; owner.profileUrl = 'https://www.facebook.com/' + uv; }
    }
  }
  const followers = extractFBFollowers(desktopHtml!) || extractFBFollowers(mobileHtml!) || extractFBFollowers(mbasicHtml!) || extractFBFollowers(watchHtml!) || '-';
  return { title: cleanTitle || '-', views: views, duration: duration, uploadDate: uploadDate, username: owner.username, profileName: profileName || '-', followers: followers, profileUrl: owner.profileUrl };
}

function extractFBVideoId(url: string): string | null {
  const m = url.match(/\/videos\/(\d+)/i); if (m) return m[1];
  const m2 = url.match(/[?&]v=(\d+)/i); if (m2) return m2[1];
  const m3 = url.match(/\/video\/(\d+)/i); if (m3) return m3[1];
  const m4 = url.match(/\/reel\/(\d+)/i); if (m4) return m4[1];
  return null;
}

function extractFBRawTitle(html: string | null): string | null {
  if (!html) return null;
  const t1 = html.match(/property="og:title"\s+content="([^"]+)"/i);
  const t2 = html.match(/name="twitter:title"\s+content="([^"]+)"/i);
  const tM = t1 || t2;
  if (!tM) return null;
  const t = tM[1].trim();
  const bad = ['facebook', 'watch', 'video', 'videos', 'descobrir vídeos populares', 'discover popular videos', 'explorar vídeos', 'watch videos on facebook', 'facebook watch', 'ver vídeos no facebook'];
  if (t.length < 3 || bad.indexOf(t.toLowerCase()) !== -1 || isFBLoginWall(t)) return null;
  return t;
}

function cleanFBVideoTitle(title: string | null): string {
  if (!title || title === '-') return title || '';
  let t = title;
  const pi = t.indexOf('|');
  if (pi !== -1 && /(?:visualiza|views?|reak|reaction|curtida|like|comment|coment)/i.test(t.substring(0, pi))) t = t.substring(pi + 1).trim();
  t = t.replace(/^\|\s*/, '').trim();
  const lp = t.lastIndexOf(' | ');
  if (lp !== -1) { const b = t.substring(0, lp).trim(); if (b.length > 3) t = b; }
  t = t.replace(/\s*\|\s*(?:Facebook|FB)\s*$/i, '').trim();
  return t.length > 2 ? t : (title || '');
}

function extractFBViews(html: string | null): string | null {
  if (!html) return null;
  let m = html.match(/"video_view_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) > 0) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"view_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) > 0) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"viewCount"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) > 0) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"play_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) > 0) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"video_views"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) > 0) return formatFBNumber(parseInt(m[1]));
  const cs = html.match(/"countString"\s*:\s*"([^"]+)"/i);
  if (cs) { const vm = cs[1].match(/([\d.,]+\s*[KMBkmb]?)/); if (vm) return parseFBKMB(vm[1]); }
  const og = html.match(/property="og:description"\s+content="([^"]+)"/i);
  if (og && og[1]) { const dv = og[1].match(/([\d.,]+\s*[KMBkmb]?)\s*(?:views|Views|visualiza)/i); if (dv) return parseFBKMB(dv[1]); }
  return null;
}

function extractFBViewsFromTitle(title: string | null): string | null {
  if (!title) return null;
  const pm = title.match(/^(\d[\d.,]*\s*(?:mil|[KMBkmb])?)\s*(?:visualiza[çc][õo]es?|views?)\s*/i);
  if (pm) {
    const raw = pm[1].trim();
    if (/mil$/i.test(raw)) {
      const num = parseFloat(raw.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(num)) return formatFBNumber(Math.round(num * 1000));
    }
    return parseFBKMB(raw);
  }
  return null;
}

function extractFBProfileNameFromTitle(title: string | null): string | null {
  if (!title) return null;
  const pp = title.split('|');
  if (pp.length >= 2) {
    const suffix = pp[pp.length - 1].trim();
    if (suffix.length > 1 && suffix.length < 80 && !/^\d+$/.test(suffix) && !isFBLoginWall(suffix)) return suffix;
  }
  return null;
}

function extractFBDuration(html: string | null): string {
  if (!html) return '-';
  const ldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/gi;
  let ldM;
  while ((ldM = ldRe.exec(html)) !== null) {
    try {
      const ld = JSON.parse(ldM[1].trim());
      if (ld.duration) return isoToFBDuration(ld.duration);
      if (ld['@graph']) { for (const item of ld['@graph']) { if (item.duration) return isoToFBDuration(item.duration); } }
    } catch {}
  }
  let m = html.match(/"duration"\s*:\s*"(PT[^"]+)"/i); if (m) return isoToFBDuration(m[1]);
  m = html.match(/"length_in_second"\s*:\s*(\d+)/i); if (m) { const s = parseInt(m[1]); if (s > 0 && s < 86400) return secsToFBDuration(s); }
  m = html.match(/"video_length"\s*:\s*(\d+)/i); if (m) { const s2 = Math.round(parseInt(m[1]) / 1000); if (s2 > 0 && s2 < 86400) return secsToFBDuration(s2); }
  m = html.match(/"lengthInSecond[s]?"\s*:\s*(\d+)/i); if (m) { const s3 = parseInt(m[1]); if (s3 > 0 && s3 < 86400) return secsToFBDuration(s3); }
  m = html.match(/property="video:duration"\s+content="(\d+)"/i); if (m) { const s4 = parseInt(m[1]); if (s4 > 0 && s4 < 86400) return secsToFBDuration(s4); }
  m = html.match(/"playable_duration_in_ms"\s*:\s*(\d+)/i); if (m) { const s5 = Math.round(parseInt(m[1]) / 1000); if (s5 > 0 && s5 < 86400) return secsToFBDuration(s5); }
  return '-';
}

function extractFBDate(html: string | null): string | null {
  if (!html) return null;
  const c: any[] = [];
  let m = html.match(/property="article:published_time"\s+content="([^"]+)"/i); if (m) c.push({ val: m[1], p: 1 });
  m = html.match(/"uploadDate"\s*:\s*"([^"]+)"/i); if (m) c.push({ val: m[1], p: 1 });
  m = html.match(/"datePublished"\s*:\s*"([^"]+)"/i); if (m) c.push({ val: m[1], p: 1 });
  m = html.match(/"publish_time"\s*:\s*(\d{10})/i); if (m) c.push({ val: m[1], p: 2 });
  m = html.match(/"created_time"\s*:\s*"([^"]+)"/i); if (m) c.push({ val: m[1], p: 3 });
  m = html.match(/"creation_time"\s*:\s*(\d{10})/i); if (m) c.push({ val: m[1], p: 3 });
c.sort(function(a, b) { return a.p - b.p; });
  for (let i = 0; i < c.length; i++) { if (c[i] && c[i].val) { const d = toFBDate(c[i].val); if (d && d !== '-') return d; } }
  return null;
}

function isValidFBHandle(v: string): boolean {
  if (/\.(xml|json|css|js|png|jpg|gif|svg|ico|txt|php|html?|jsp|asp|cfm|rss|atom)$/i.test(v)) return false;
  if (/^(osd|robots|sitemap|crossdomain|favicon|browserconfig|site|login|checkpoint|home|messages|notifications|settings|saved|marketplace|gaming|pages|groups|friends|find|search|bookmarks|developers|business|help|about|ad_campaign|adcenter|ads|analytics|appcenter|apps|bugs|careers|community|connect|contact|cookies|creator|crisisresponse|culture|datasets|design|developers|device|directory|discover|download|email|events|experiments|favorites|fb|fbai|fbalbum|fbbiz|fblearn|fbsearch|fbhelp|fbid|fblogin|fbmarket|fbme|fbmqtt|fbpay|fbpigeon|fbsb|fbsbx|fbsignup|fbstudent|fbvideo|fbwatson|fbwork|fbx|feed|file|filestore|follow|free|friend|friends|fun|fundraisers|fundraisers|gaming|gifts|give|go|groups|help|helpcenter|home|host|hosting|ideas|info|instagram|interns|investor|invitations|invite|jobs|json|kodiak|legal|lgbt|li|list|lists|live|locale|log|login|logout|m|make|map|marketplace|messages|messenger|military|minors|mobile|money|motion|movies|music|my|name|networks|new|news|newsroom|notes|notifications|notify|oauth|offers|office|ok|online|pages|parent|parents|partners|pay|payments|people|photos|policies|policy|poll|privacy|profile|projects|public|publish|quest|questions|react|read|recover|register|related|remove|report|requests|research|reset|reviews|rights|rooms|rsrc|safety|save|saved|science|search|security|select|self|send|settings|share|sharer|shopping|showcase|signup|site|sitemap|soccer|social|software|sports|sponsored|staging|status|storage|store|stories|story|student|students|studio|study|support|surveys|syndicate|t|table|tabs|talk|terms|test|testing|themes|this|tips|tos|tour|trade|translations|travel|trending|trust|tubics|tv|updates|upload|url|usage|users|v|v2|v3|v4|v5|v6|v7|v8|v9|validator|values|vault|verification|verify|video|videos|view|views|viral|visitor|vote|voting|w|want|watch|web|webapp|webapps|webmaster|welcome|what|whitepaper|widget|wiki|win|wiz|word|work|world|www|xml|year|yes|you|your|yourtv)$/i.test(v)) return false;
  return true;
}

function extractFBOwner(html: string | null, url: string): any {
  const skip = ['video', 'watch', 'reel', 'groups', 'pages', 'profile.php', 'permalink', 'story.php', 'watch_later', 'plugins', 'sharer', 'sharer.php'];
  if (html) {
    const ldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/gi;
    let ldM;
    while ((ldM = ldRe.exec(html)) !== null) {
      try {
        const ld = JSON.parse(ldM[1].trim());
        const items = ld['@graph'] || [ld];
        for (const item of items) {
          const author = item.author || item.creator || item.publisher || {};
          const a = Array.isArray(author) ? author[0] : author;
          if (a.url) {
            const um = a.url.match(/facebook\.com\/([^\/\?&"]+)/i);
            if (um && skip.indexOf(um[1]) === -1 && !isFBLoginWall(um[1]))
              return { username: '@' + um[1], profileUrl: a.url.replace(/\/+$/, '') };
          }
        }
      } catch {}
    }
  }
  if (url) {
    // facebook.com/{user}/videos/{id}, facebook.com/{user}/reel/{id}
    let urlMatch = url.match(/facebook\.com\/([^\/\?&"]+)\/(?:videos|video|reel)\//i);
    if (urlMatch && skip.indexOf(urlMatch[1]) === -1 && !isFBLoginWall(urlMatch[1])) {
      return { username: '@' + urlMatch[1].replace(/\?.*/, ''), profileUrl: 'https://www.facebook.com/' + urlMatch[1].replace(/\?.*/, '') };
    }
    // facebook.com/{user} (standalone page with query params like ?v= or ?__tn__=)
    urlMatch = url.match(/facebook\.com\/(?!watch|reel\b|video\b|story\b|groups\b|pages\b|plugins\b|permalink\b|share\b|sharer\b|profile\.php\b|messages\b|events\b|notifications\b|settings\b)([a-zA-Z][a-zA-Z0-9.\-]{2,50})(?:\/|$|\?|#)/i);
    if (urlMatch && skip.indexOf(urlMatch[1]) === -1 && !isFBLoginWall(urlMatch[1])) {
      return { username: '@' + urlMatch[1], profileUrl: 'https://www.facebook.com/' + urlMatch[1] };
    }
    // permalink.php?story_fbid=...&id=12345
    urlMatch = url.match(/[?&]id=(\d+)/i);
    if (urlMatch) {
      return { username: 'id=' + urlMatch[1], profileUrl: 'https://www.facebook.com/profile.php?id=' + urlMatch[1] };
    }
  }
  if (!html) return null;
  const h1 = html.match(/"vanity"\s*:\s*"([^"]{2,50})"/i);
  const h2 = html.match(/"username"\s*:\s*"([^"]{2,50})"/i);
  const h3 = html.match(/property="og:url"\s+content="https?:\/\/(?:www\.|m\.)?facebook\.com\/([^\/\?"]+)/i);
  const h4 = html.match(/"page_id"\s*:\s*"?(\d+)"?/i);
  const h5 = html.match(/"fan_page_id"\s*:\s*"?(\d+)"?/i);
  if (h1 && skip.indexOf(h1[1]) === -1 && !isFBLoginWall(h1[1])) return { username: '@' + h1[1], profileUrl: 'https://www.facebook.com/' + h1[1] };
  if (h2 && skip.indexOf(h2[1]) === -1 && !isFBLoginWall(h2[1])) return { username: '@' + h2[1], profileUrl: 'https://www.facebook.com/' + h2[1] };
  if (h3 && skip.indexOf(h3[1]) === -1 && !isFBLoginWall(h3[1])) return { username: '@' + h3[1], profileUrl: 'https://www.facebook.com/' + h3[1] };
  if (h4) return { username: 'id=' + h4[1], profileUrl: 'https://www.facebook.com/profile.php?id=' + h4[1] };
  if (h5) return { username: 'id=' + h5[1], profileUrl: 'https://www.facebook.com/profile.php?id=' + h5[1] };
  // broader JSON patterns for numeric Facebook profile IDs (15+ digits, typically starting with 1000)
  if (!h4 && !h5 && html) {
    const idCtx = html.match(/"(?:pageID|actorID|actor_id|owner_id|from_id|node_id|target_id)"\s*:\s*"?(\d{10,})"?/i) ||
                  html.match(/"id"\s*:\s*"?(\d{15,})"?/i);
    if (idCtx) return { username: 'id=' + idCtx[1], profileUrl: 'https://www.facebook.com/profile.php?id=' + idCtx[1] };
  }
  if (html) {
    // profile.php?id=12345 in href
    const pidM = html.match(/profile\.php\?id=(\d{10,})/i);
    if (pidM) return { username: 'id=' + pidM[1], profileUrl: 'https://www.facebook.com/profile.php?id=' + pidM[1] };
    const linkM = html.match(/href="https?:\/\/(?:www\.|m\.|mbasic\.)?facebook\.com\/([a-zA-Z][a-zA-Z0-9.\-]{2,50})(?:\/|\?|")/i);
    if (linkM && skip.indexOf(linkM[1]) === -1 && !isFBLoginWall(linkM[1]) && isNaN(Number(linkM[1])) && isValidFBHandle(linkM[1]))
      return { username: '@' + linkM[1], profileUrl: 'https://www.facebook.com/' + linkM[1] };
    // mbasic-style: href="/username" (relative URL for Facebook profiles)
    const relM = html.match(/href="\/([a-zA-Z][a-zA-Z0-9.\-]{2,50})(?:\/|\?|")/i);
    if (relM && skip.indexOf(relM[1]) === -1 && !isFBLoginWall(relM[1]) && isNaN(Number(relM[1])) && isValidFBHandle(relM[1]))
      return { username: '@' + relM[1], profileUrl: 'https://www.facebook.com/' + relM[1] };
    // protocol-relative link: href="//www.facebook.com/{handle}"
    const prM = html.match(/href="\/\/(?:www\.|m\.|mbasic\.)?facebook\.com\/([a-zA-Z][a-zA-Z0-9.\-]{2,50})(?:\/|\?|")/i);
    if (prM && skip.indexOf(prM[1]) === -1 && !isFBLoginWall(prM[1]) && isNaN(Number(prM[1])) && isValidFBHandle(prM[1]))
      return { username: '@' + prM[1], profileUrl: 'https://facebook.com/' + prM[1] };
    // data-href or data-content attribute with facebook.com profile URL
    const dM = html.match(/(?:data-href|data-content|content)="https?:\/\/(?:www\.|m\.|mbasic\.)?facebook\.com\/([a-zA-Z][a-zA-Z0-9.\-]{2,50})(?:\/|\?|")/i);
    if (dM && skip.indexOf(dM[1]) === -1 && !isFBLoginWall(dM[1]) && isNaN(Number(dM[1])) && isValidFBHandle(dM[1]))
      return { username: '@' + dM[1], profileUrl: 'https://www.facebook.com/' + dM[1] };
    // JSON key pattern: "actor" or "pageUrl" or "profileUrl" containing facebook.com/{handle}
    let jM = html.match(/"(?:actor|pageUrl|page_url|profileUrl|profile_url|targetOwner)"\s*:\s*\{[^}]*?"url"\s*:\s*"https?:\/\/(?:www\.|m\.)?facebook\.com\/([a-zA-Z][a-zA-Z0-9.\-]{0,50})/i);
    if (jM && skip.indexOf(jM[1]) === -1 && !isFBLoginWall(jM[1]))
      return { username: '@' + jM[1], profileUrl: 'https://www.facebook.com/' + jM[1] };
    // JSON "owner" or "author" object with url field containing facebook.com/{handle}
    jM = html.match(/"(?:owner|author|creator|uploader|publisher|from|nodeOwner)"\s*:\s*\{[^}]*?"url"\s*:\s*"https?:\/\/(?:www\.|m\.)?facebook\.com\/([a-zA-Z][a-zA-Z0-9.\-]{0,50})/i);
    if (jM && skip.indexOf(jM[1]) === -1 && !isFBLoginWall(jM[1]))
      return { username: '@' + jM[1], profileUrl: 'https://www.facebook.com/' + jM[1] };
    // JSON "id" key pattern: "page_owner":{"id":"12345","name":"..."}
    jM = html.match(/"(?:page_owner|owner_id|actor_id|profile_id)"\s*:\s*"(\d{5,})"/i);
    if (jM) return { username: 'id=' + jM[1], profileUrl: 'https://www.facebook.com/profile.php?id=' + jM[1] };
  }
  return null;
}

function extractFBProfileName(html: string | null): string | null {
  if (!html) return null;
  const bl = ['connection_quality', 'unknown', 'null', 'undefined', 'true', 'false', 'facebook', 'facebook watch', 'video', 'watch', 'reel', 'home', 'timeline', 'photos', 'videos', 'about', 'watch videos on facebook', 'descobrir vídeos populares', 'discover popular videos', 'explorar vídeos', 'ver vídeos no facebook'];
  function isValid(v: string): boolean { if (!v) return false; const s = v.toString().trim().toLowerCase(); if (s.length < 2 || s.length > 100 || bl.indexOf(s) !== -1 || isFBLoginWall(s)) return false; if (/^[a-z_]+$/.test(s) && s.indexOf('_') !== -1) return false; if (/^\d+$/.test(s)) return false; return true; }
  const ldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/gi;
  let ldM;
  while ((ldM = ldRe.exec(html)) !== null) {
    try {
      const ld = JSON.parse(ldM[1].trim());
      const a = ld.author?.name || ld.creator?.name || ld.publisher?.name || ((ld['@type'] === 'Person' || ld['@type'] === 'Organization') ? ld.name : null);
      if (a && isValid(a)) return a.trim();
    } catch {}
  }
  const p1 = html.match(/"page_name"\s*:\s*"([^"]+)"/i); if (p1 && p1[1] && isValid(p1[1])) return p1[1].trim();
  const og = html.match(/property="og:title"\s+content="([^"]+)"/i);
  if (og && og[1]) {
    const ogTitle = og[1].trim();
    const decoded = decodeFBHtml(ogTitle);
    if (decoded) {
      const t = decoded.replace(/\s*[-–|]\s*(?:Home|Facebook|Videos|About|Posts|Timeline|Reels).*$/i, '').trim();
      if (isValid(t)) return t;
    }
  }
  return null;
}

function extractFBFollowers(html: string | null): string | null {
  if (!html) return null;
  const MIN = 100;
  let m = html.match(/"fan_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) >= MIN) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"follower_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) >= MIN) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"followers_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) >= MIN) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"subscriber_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) >= MIN) return formatFBNumber(parseInt(m[1]));
  m = html.match(/"friend_count"\s*:\s*(\d+)/i); if (m && parseInt(m[1]) >= MIN) return formatFBNumber(parseInt(m[1]));
  m = html.match(/(\d[\d,]+)\s*people\s+like\s+this/i); if (m) { const n = parseInt(m[1].replace(/,/g, '')); if (n >= MIN) return formatFBNumber(n); }
  m = html.match(/(\d[\d,]+)\s*people\s+follow\s+this/i); if (m) { const n2 = parseInt(m[1].replace(/,/g, '')); if (n2 >= MIN) return formatFBNumber(n2); }
  m = html.match(/([\d.,]+\s*[KMBkmb]?)\s*[Ff]ollowers/i); if (m) { const v = parseFBKMB(m[1]); if (v !== '-' && parseInt(v.replace(/,/g, '')) >= MIN) return v; }
  m = html.match(/(\d[\d,]+)\s*likes\s*[·|]/i); if (m) { const n3 = parseInt(m[1].replace(/,/g, '')); if (n3 >= MIN) return formatFBNumber(n3); }
  m = html.match(/(\d[\d,]+)\s+(?:people\s+)?(?:follow|Followers|seguidores)/i); if (m) { const n4 = parseInt(m[1].replace(/,/g, '')); if (n4 >= MIN) return formatFBNumber(n4); }
  m = html.match(/([\d.,]+\s*[KkMmBb]?)\s*(?:Followers|seguidores|curtidas)/i); if (m) { const v2 = parseFBKMB(m[1]); if (v2 !== '-' && parseInt(v2.replace(/,/g, '')) >= MIN) return v2; }
  const dM = html.match(/property="og:description"\s+content="([^"]+)"/i) || html.match(/name="description"\s+content="([^"]+)"/i);
  if (dM) { m = dM[1].match(/([\d.,]+\s*[KMBkmb]?)\s*(?:followers|Followers|people follow)/i); if (m) { const dv = parseFBKMB(m[1]); if (dv !== '-' && parseInt(dv.replace(/,/g, '')) >= MIN) return dv; } }
  const ldRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/gi;
  let ldM;
  while ((ldM = ldRe.exec(html)) !== null) {
    try {
      const ld = JSON.parse(ldM[1].trim());
      if (ld.followerCount && parseInt(ld.followerCount) >= MIN) return formatFBNumber(ld.followerCount);
      if (ld.interactionStatistic) {
        const stats = Array.isArray(ld.interactionStatistic) ? ld.interactionStatistic : [ld.interactionStatistic];
        for (const st of stats) {
          const it = String(st.interactionType || '');
          const cnt = parseInt(st.userInteractionCount || 0);
          if ((it.indexOf('Follow') !== -1 || it.indexOf('Like') !== -1) && cnt >= MIN) return formatFBNumber(cnt);
        }
      }
    } catch {}
  }
  return null;
}

function parseFBKMB(str: string): string {
  if (!str) return '-';
  const orig = str.toString().replace(/,/g, '').trim();
  const n = parseFloat(orig);
  if (isNaN(n) || n <= 0) return '-';
  let num = n;
  if (/[Bb]$/.test(orig)) num *= 1000000000;
  else if (/[Mm]$/.test(orig)) num *= 1000000;
  else if (/[Kk]$/.test(orig)) num *= 1000;
  return formatFBNumber(Math.round(num));
}

function isoToFBDuration(iso: string): string {
  if (!iso) return '-';
  try { const m = iso.match(/P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/); if (!m) return '-'; const h = parseInt(m[1] || '0'), mn = parseInt(m[2] || '0'), s = Math.round(parseFloat(m[3] || '0')); if (h === 0 && mn === 0 && s === 0) return '-'; return [h, mn, s].map(function(x) { return x.toString().padStart(2, '0'); }).join(':'); } catch { return '-'; }
}

function secsToFBDuration(s: number): string {
  if (!s || s <= 0) return '-';
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(function(x) { return x.toString().padStart(2, '0'); }).join(':');
}

function toFBDate(val: string): string {
  if (!val) return '-';
  try { const s = val.toString().trim(), d = /^\d{10}$/.test(s) ? new Date(parseInt(s) * 1000) : /^\d{13}$/.test(s) ? new Date(parseInt(s)) : new Date(s); if (isNaN(d.getTime())) return '-'; const yr = d.getFullYear(); if (yr < 2007 || yr > 2030) return '-'; const day = String(d.getDate()).padStart(2, '0'); const month = String(d.getMonth() + 1).padStart(2, '0'); return day + '/' + month + '/' + yr; } catch { return '-'; }
}

function formatFBNumber(n: number): string { if (!n || n === 0) return '-'; return Number(n).toLocaleString(); }

function isFBLoginWall(text: string | null): boolean { if (!text) return false; const t = text.toLowerCase(); return t.indexOf('log in') !== -1 || t.indexOf('login') !== -1 || t.indexOf('sign up') !== -1 || t.indexOf('sign in') !== -1 || t.indexOf('fazer login') !== -1 || t.indexOf('entrar') !== -1 || t.indexOf('cadastre') !== -1; }

function cleanFB(val: string | null): string | null { if (!val || val === '-' || isFBLoginWall(val)) return null; return val; }

function isFBFullLoginWall(html: string | null): boolean { if (!html) return true; const og = html.match(/property="og:title"\s+content="([^"]+)"/i); if (!og || !og[1]) return false; const t = og[1].toLowerCase(); return (t.indexOf('log in') !== -1 || t.indexOf('sign up') !== -1 || t === 'facebook') && html.indexOf('video_view_count') === -1 && html.indexOf('uploadDate') === -1; }

function decodeFBHtml(str: string | null): string | null {
  if (!str) return str;
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, h) { try { return String.fromCharCode(parseInt(h, 16)); } catch { return ''; } })
    .replace(/&#(\d+);/g, function(_, d) { try { return String.fromCharCode(parseInt(d, 10)); } catch { return ''; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

async function dailymotionScraper(url: string) {
  try {
    const videoIdMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/) || url.match(/dai\.ly\/([a-zA-Z0-9]+)/);
    if (!videoIdMatch) return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Name': '-', 'Channel Username': '-', 'Followers': '-', 'Channel URL': '-', 'Status': 'Invalid Dailymotion URL' };
    const videoId = videoIdMatch[1];
    const apiUrl = `https://api.dailymotion.com/video/${videoId}?fields=title,views_total,duration,created_time,owner.username,owner.screenname`;
    const res = await fetch(apiUrl, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) {
      console.log('[Dailymotion] API error:', res.status);
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Name': '-', 'Channel Username': '-', 'Followers': '-', 'Channel URL': '-', 'Status': 'API Error: ' + res.status };
    }
    const data = await res.json() as any;
    console.log('[Dailymotion] Response:', JSON.stringify(data).substring(0, 500));
    if (!data || !data.title) return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Name': '-', 'Channel Username': '-', 'Followers': '-', 'Channel URL': '-', 'Status': 'Not Found' };
    
    const username = data['owner.username'] || data.owner?.username || '';
    const channelName = data['owner.screenname'] || data.owner?.screenname || '';
    
    let followers = '';
    if (username) {
      try {
        const channelApi = `https://api.dailymotion.com/user/${username}?fields=followers_total`;
        const cRes = await fetch(channelApi, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (cRes.ok) {
          const cData = await cRes.json() as any;
          console.log('[Dailymotion] Followers response:', JSON.stringify(cData));
          followers = cData.followers_total ? formatNumberWithCommas(cData.followers_total) : '';
        }
      } catch (err) {
        console.log('[Dailymotion] Followers error:', err);
      }
    }
    
    const title = data.title || '';
    const views = data.views_total ? formatNumberWithCommas(data.views_total) : '';
    const duration = data.duration ? formatTikTokDuration(data.duration) : '';
    const uploadDate = data.created_time ? new Date(data.created_time * 1000).toISOString().split('T')[0] : '';
    const channelUsername = username ? '@' + username : '';
    const channelUrl = username ? `https://www.dailymotion.com/user/${username}` : '';
    
    return { 
      'Video URL': url, 
      'Video Title': title || '-', 
      'Views': views || '-', 
      'Duration': duration || '-', 
      'Upload Date': uploadDate || '-', 
      'Channel Name': channelName || '-', 
      'Channel Username': channelUsername || '-', 
      'Followers': followers || '-', 
      'Channel URL': channelUrl || '-', 
      'Status': 'Done' 
    };
  } catch (e) {
    console.log('[Dailymotion] Error:', e);
    return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Name': '-', 'Channel Username': '-', 'Followers': '-', 'Channel URL': '-', 'Status': 'Error: ' + String(e) };
  }
}

async function archiveScraper(url: string) {
  try {
    if (!url.includes('archive.org/')) {
      return { 'URL': url, 'Title': '-', 'Upload Date': '-', 'Views': '-', 'File Duration': '-', 'Username': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Invalid Archive.org URL' };
    }
    const urlType = detectArchiveUrlType(url);
    if (!urlType) {
      return { 'URL': url, 'Title': '-', 'Upload Date': '-', 'Views': '-', 'File Duration': '-', 'Username': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Invalid URL' };
    }
    const data = await fetchArchiveData(url, urlType);
    if (!data) {
      return { 'URL': url, 'Title': '-', 'Upload Date': '-', 'Views': '-', 'File Duration': '-', 'Username': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Not Found / Private' };
    }
    let followers = '-';
    if (data.username && data.username !== '-') {
      const profile = await fetchArchiveProfile(data.username);
      if (profile) {
        followers = profile.followers || '-';
      }
    }
    return {
      'URL': url,
      'Title': data.title || '-',
      'Upload Date': data.uploadDate || '-',
      'Views': data.views || '-',
      'File Duration': data.fileDuration || '-',
      'Username': data.username || '-',
      'Followers': followers,
      'Profile URL': data.profileUrl || '-',
      'Status': 'Done'
    };
  } catch (e) {
    console.log('[Archive] Error:', e);
    return { 'URL': url, 'Title': '-', 'Upload Date': '-', 'Views': '-', 'File Duration': '-', 'Username': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Error: ' + String(e) };
  }
}

function detectArchiveUrlType(url: string) {
  if (/web\.archive\.org\/web\//i.test(url)) return 'wayback';
  if (/archive\.org\/search/i.test(url)) return 'search';
  if (/archive\.org\/(?:details|download|stream)\/[^\/\?#]+\/.+/i.test(url)) return 'file';
  if (/archive\.org\/(?:details|stream|download|embed)\//i.test(url)) return 'item';
  if (/archive\.org/i.test(url)) return 'item';
  return null;
}

function extractIdentifierAndFile(url: string) {
  const m = url.match(/archive\.org\/(?:details|download|stream|embed)\/([^\/\?#]+)\/([^\?#]+)/i);
  if (m) return { identifier: m[1], filename: decodeURIComponent(m[2].replace(/\+/g, ' ')).trim() };
  const m2 = url.match(/archive\.org\/(?:details|download|stream|embed)\/([^\/\?#]+)/i);
  if (m2) return { identifier: m2[1], filename: null };
  return null;
}

function buildArchiveUsername(uploaderRaw: string) {
  if (!uploaderRaw || uploaderRaw === '-') return { username: '-', profileUrl: '-' };
  const raw = uploaderRaw.toString().trim();
  let username = raw;
  if (raw.indexOf('@') !== -1) {
    const parts = raw.split('@');
    username = parts[1] && parts[1].indexOf('.') !== -1 ? parts[0].trim() : parts[parts.length - 1].trim();
    if (!username) username = parts[0].trim();
  }
  username = username.replace(/\s+/g, '');
  if (!username) return { username: '-', profileUrl: '-' };
  return { username: username, profileUrl: 'https://archive.org/details/@' + username };
}

async function fetchArchiveData(url: string, urlType: string): Promise<any> {
  if (urlType === 'wayback') {
    const m = url.match(/web\.archive\.org\/web\/(\d+)\/(https?:\/\/.+)/i);
    if (!m) return null;
    const title = m[2];
    const uploadDate = parseWaybackTimestamp(m[1]);
    return { title, uploadDate, views: '-', fileDuration: '-', username: '-', profileUrl: '-' };
  }
  if (urlType === 'search') {
    const qm = url.match(/[?&](?:query|q)=([^&]+)/i);
    const query = qm ? decodeURIComponent(qm[1]) : 'Unknown';
    return { title: 'Search: "' + query + '"', uploadDate: '-', views: '0', fileDuration: '-', username: '-', profileUrl: '-' };
  }
  const parsed = extractIdentifierAndFile(url);
  if (!parsed) return null;
  const identifier = parsed.identifier;
  const targetFile = parsed.filename;
  try {
    const res = await fetch('https://archive.org/metadata/' + encodeURIComponent(identifier), {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return null;
    const raw = await res.json() as any;
    if (!raw || !raw.metadata) return null;
    const meta = raw.metadata;
    const files = raw.files || [];
    const title = pickField(meta, ['title']) || '-';
    const uploadDateRaw = pickField(meta, ['date', 'publicdate', 'addeddate']) || '-';
    const uploadDate = parseArchiveDate(uploadDateRaw);
    const uploaderRaw = pickField(meta, ['uploader', 'creator', 'author']) || '-';
    const up = buildArchiveUsername(uploaderRaw);
    let username = up.username;
    let profileUrl = up.profileUrl;
    try {
      const itemHtml = await fetch('https://archive.org/details/' + encodeURIComponent(identifier), {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).then(r => r.text()).catch(() => null);
      if (itemHtml) {
        const scrapedUsername = scrapeUsernameFromItemPage(itemHtml);
        if (scrapedUsername && scrapedUsername.length > 1) {
          username = scrapedUsername;
          profileUrl = 'https://archive.org/details/@' + scrapedUsername;
        }
      }
    } catch {}
    let views = await fetchArchiveViews(identifier);
    if (views === '-' && meta['downloads'] && parseInt(meta['downloads']) > 0) {
      views = formatNumberWithCommas(parseInt(meta['downloads']));
    }
    let fileDuration = '-';
    if (targetFile) {
      const matched = findMatchingFile(files, targetFile);
      if (matched) fileDuration = extractFileDuration(matched);
    } else {
      const bestFile = findBestPrimaryFile(files);
      if (bestFile) fileDuration = extractFileDuration(bestFile);
    }
    return { title, uploadDate, views, fileDuration, username, profileUrl };
  } catch {
    return null;
  }
}

async function fetchArchiveProfile(username: string) {
  const u = (username || '').replace('@', '').trim();
  if (!u || u === '-') return null;
  let profileName = '-';
  let followers = '-';
  let realUsername = u;
  try {
    const ar = await fetch('https://archive.org/metadata/@' + encodeURIComponent(u), {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (ar.ok) {
      const ad = await ar.json() as any;
      if (ad) {
        const nameVal = (ad.metadata && ad.metadata.title) || ad.patron || ad.display_name || ad.name || null;
        if (nameVal && nameVal.toString().trim().length > 0) profileName = nameVal.toString().trim();
        const snVal = ad.screenname || ad.screen_name || null;
        if (snVal && snVal.toString().trim().length > 0) realUsername = snVal.toString().trim();
        const folVal = ad.followers || ad.followerCount || ad.subscribers || null;
        if (folVal) {
          const fn = parseInt(folVal);
          if (!isNaN(fn) && fn > 0) followers = formatNumberWithCommas(fn);
        }
      }
    }
  } catch {}
  if (profileName === '-' || followers === '-') {
    try {
      const html = await fetch('https://archive.org/details/@' + realUsername, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).then(r => r.text()).catch(() => null);
      if (html) {
        if (profileName === '-') {
          const patronM = html.match(/"patron"\s*:\s*"([^"]{2,120})"/i);
          if (patronM) profileName = patronM[1];
        }
        if (profileName === '-') {
          const ogM = html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i);
          if (ogM) profileName = ogM[1].replace(/\s*[:|\-]\s*(?:Internet\s+Archive|Archive\.org).*/i, '').trim();
        }
        if (followers === '-') {
          const fM = html.match(/"followers"\s*:\s*(\d+)/i) || html.match(/(\d[\d,]+)\s+followers/i);
          if (fM) {
            const fn = parseInt(fM[1].replace(/,/g, ''));
            if (!isNaN(fn) && fn > 0) followers = formatNumberWithCommas(fn);
          }
        }
      }
    } catch {}
  }
  if (profileName === '-') profileName = realUsername;
  return { profileName, followers, realUsername };
}

async function fetchArchiveViews(identifier: string) {
  try {
    const res = await fetch('https://archive.org/services/views/?identifier=' + encodeURIComponent(identifier), {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const json = await res.json() as any;
      let views = null;
      if (json && json.item) {
        views = json.item.views !== undefined ? json.item.views : (json.item.all_time || null);
      } else if (json && json[identifier]) {
        views = json[identifier].views || json[identifier].all_time || null;
      } else if (json && json.views !== undefined) {
        views = json.views;
      }
      if (views !== null && parseInt(views) > 0) return formatNumberWithCommas(parseInt(views));
    }
  } catch {}
  try {
    const sRes = await fetch('https://archive.org/advancedsearch.php?q=identifier:' + encodeURIComponent(identifier) + '&fl[]=downloads&output=json&rows=1', {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (sRes.ok) {
      const sData = await sRes.json() as any;
      if (sData && sData.response && sData.response.docs && sData.response.docs[0]) {
        const dl = sData.response.docs[0].downloads;
        if (dl && parseInt(dl) > 0) return formatNumberWithCommas(parseInt(dl));
      }
    }
  } catch {}
  return '-';
}

function scrapeUsernameFromItemPage(html: string) {
  if (!html) return null;
  const m1 = html.match(/href=["']\/details\/@([a-zA-Z0-9_.\-]+)["']/i);
  if (m1 && m1[1]) return m1[1].trim();
  const m2 = html.match(/href=["']\/@([a-zA-Z0-9_.\-]+)["']/i);
  if (m2 && m2[1]) return m2[1].trim();
  return null;
}

function findMatchingFile(files: any[], targetFile: string) {
  if (!targetFile || !files || !files.length) return null;
  const tf = String(targetFile || '');
  const tBase = tf.split('/').pop()?.toLowerCase() ?? '';
  if (!tBase) return null;
  for (const file of files) {
    if (!file || !file.name) continue;
    if (file.name === targetFile) return file;
  }
  for (const file of files) {
    if (!file || !file.name) continue;
    const fn = String(file.name || '').split('/').pop()?.toLowerCase() ?? '';
    if (fn === tBase) return file;
  }
  return null;
}

function findBestPrimaryFile(files: any[]) {
  if (!files || !files.length) return null;
  const exts = ['mp4', 'mkv', 'ogv', 'avi', 'mov', 'webm', 'mp3', 'ogg', 'flac', 'wav', 'm4a', 'pdf', 'epub'];
  for (const ext of exts) {
    for (const file of files) {
      if (!file || !file.name) continue;
      const fn = String(file.name || '').toLowerCase();
      if (fn.endsWith('.' + ext) && file.source === 'original') return file;
    }
  }
  for (const ext of exts) {
    for (const file of files) {
      if (!file || !file.name) continue;
      const fn = String(file.name || '').toLowerCase();
      if (fn.endsWith('.' + ext)) return file;
    }
  }
  return null;
}

function extractFileDuration(f: any) {
  if (!f) return '-';
  if (f.length !== undefined && f.length !== null && f.length !== '') {
    const s = parseFloat(f.length);
    if (!isNaN(s) && s > 0) return formatTikTokDuration(Math.round(s));
  }
  if (f.runtime) {
    const rt = f.runtime.toString().trim();
    const cM = rt.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (cM) {
      if (cM[3] !== undefined) return [parseInt(cM[1]), parseInt(cM[2]), parseInt(cM[3])].map(x => x.toString().padStart(2, '0')).join(':');
      return ['00', parseInt(cM[1]).toString().padStart(2, '0'), parseInt(cM[2]).toString().padStart(2, '0')].join(':');
    }
    const mM = rt.match(/^(\d+)\s*min/i);
    if (mM) return formatTikTokDuration(parseInt(mM[1]) * 60);
    const hM = rt.match(/(\d+)\s*h(?:our)?s?\s*(?:(\d+)\s*m)?/i);
    if (hM) return formatTikTokDuration(parseInt(hM[1]) * 3600 + parseInt(hM[2] || '0') * 60);
  }
  if (f.duration !== undefined && f.duration !== null && f.duration !== '') {
    const d = f.duration.toString().trim();
    if (d.indexOf('PT') === 0) return parseIsoDuration(d);
    const dN = parseFloat(d);
    if (!isNaN(dN) && dN > 0 && dN < 86400) return formatTikTokDuration(Math.round(dN));
  }
  return '-';
}

function parseIsoDuration(iso: string) {
  if (!iso) return '-';
  try {
    const m = iso.match(/P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
    if (!m) return '-';
    let h = parseInt(m[1] || '0'), min = parseInt(m[2] || '0'), s = Math.ceil(parseFloat(m[3] || '0'));
    if (s === 60) { s = 0; min += 1; }
    if (min === 60) { min = 0; h += 1; }
    if (h === 0 && min === 0 && s === 0) return '-';
    return [h, min, s].map(x => x.toString().padStart(2, '0')).join(':');
  } catch { return '-'; }
}

function parseArchiveDate(val: string) {
  if (!val || val === '-') return '-';
  try {
    const d = new Date(val.toString().trim());
    if (isNaN(d.getTime())) return val.toString().substring(0, 10);
    return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear();
  } catch { return val.toString().substring(0, 10); }
}

function parseWaybackTimestamp(ts: string) {
  try { return ts.substring(6, 8) + '/' + ts.substring(4, 6) + '/' + ts.substring(0, 4); } catch { return ts; }
}

function pickField(meta: any, keys: string[]) {
  for (const key of keys) {
    const val = meta[key];
    if (val === undefined || val === null) continue;
    const v = Array.isArray(val) ? val[0] : val;
    if (v && v.toString().trim().length > 0) return v.toString().trim();
  }
  return null;
}

async function twitterScraper(url: string) {
  try {
    if (!url.includes('twitter.com') && !url.includes('x.com')) {
      return { 'Video URL': url, 'Video Title / Tweet Text': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Invalid Twitter URL' };
    }
    const parsed = parseTweetUrl(url);
    if (!parsed) {
      return { 'Video URL': url, 'Video Title / Tweet Text': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Invalid URL' };
    }
    const data = await fetchViaFxTwitter(parsed.username, parsed.tweetId);
    if (!data) {
      return { 'Video URL': url, 'Video Title / Tweet Text': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Not Found / Private' };
    }
    const profileUrl = `https://x.com/${data.username.replace('@', '')}`;
    return {
      'Video URL': url,
      'Video Title / Tweet Text': data.title || '-',
      'Views': data.views || '-',
      'Duration': data.duration || '-',
      'Upload Date': data.uploadDate || '-',
      'Channel Username': data.username || '-',
      'Profile Name': data.profileName || '-',
      'Followers': data.followers || '-',
      'Profile URL': profileUrl || '-',
      'Status': 'Done'
    };
  } catch (e) {
    console.log('[Twitter] Error:', e);
    return { 'Video URL': url, 'Video Title / Tweet Text': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Error: ' + String(e) };
  }
}

function parseTweetUrl(url: string) {
  const m = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)\/status\/(\d+)/);
  if (!m) return null;
  return { username: m[1].replace('@', ''), tweetId: m[2] };
}

function parseDate(val: string | number) {
  if (!val) return '-';
  try {
    const d = typeof val === 'string' ? new Date(val) : new Date(val > 1e12 ? val : val * 1000);
    if (isNaN(d.getTime())) return '-';
    return d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear();
  } catch { return '-'; }
}

function formatDuration(s: number) {
  if (!s || s <= 0) return '00:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(x => x.toString().padStart(2, '0')).join(':');
}

async function fetchViaFxTwitter(username: string, tweetId: string): Promise<any> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/${username}/status/${tweetId}`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (!res.ok) return fetchViaVxTwitter(username, tweetId);
    const json = await res.json() as any;
    if (!json || !json.tweet) return fetchViaVxTwitter(username, tweetId);
    const t = json.tweet;
    const title = (t.text || '').replace(/\n/g, ' ').substring(0, 250) || '-';
    const views = t.views ? Number(t.views).toLocaleString() : '-';
    const uploadDate = parseDate(t.created_at);
    const uname = t.author ? '@' + t.author.screen_name : '@' + username;
    const profileName = t.author?.name || '-';
    const followers = t.author?.followers ? Number(t.author.followers).toLocaleString() : '-';
    let duration = '00:00:00';
    if (t.media?.videos?.length > 0) {
      const s = Math.round(t.media.videos[0].duration || 0);
      duration = formatDuration(s);
    }
    return { title, views, duration, uploadDate, username: uname, profileName, followers };
  } catch {
    return fetchViaVxTwitter(username, tweetId);
  }
}

async function fetchViaVxTwitter(username: string, tweetId: string): Promise<any> {
  try {
    const res = await fetch(`https://api.vxtwitter.com/${username}/status/${tweetId}`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const json = await res.json() as any;
    if (!json || json.error) return null;
    const title = (json.text || '').replace(/\n/g, ' ').substring(0, 250) || '-';
    const views = json.views ? Number(json.views).toLocaleString() : '-';
    const uploadDate = parseDate(json.date_epoch || json.date);
    const uname = json.user_screen_name ? '@' + json.user_screen_name : '@' + username;
    const profileName = json.user_name || '-';
    const followers = '-';
    let duration = '00:00:00';
    if (json.media_extended) {
      const vid = json.media_extended.find((m: any) => m.type === 'video' || m.type === 'gif');
      if (vid?.duration_millis) duration = formatDuration(Math.floor(vid.duration_millis / 1000));
    }
    return { title, views, duration, uploadDate, username: uname, profileName, followers };
  } catch {
    return null;
  }
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatIsoDuration(iso: string): string {
  if (!iso) return '-';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '-';
  const h = parseInt(match[1] || '0');
  const m = parseInt(match[2] || '0');
  const s = parseInt(match[3] || '0');
  if (h === 0 && m === 0 && s === 0) return '-';
  return [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
}

async function youtubeScraper(url: string) {
  try {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return { url, videoTitle: '-', videoId: '-', views: '-', duration: '-', channelId: '-', channelName: '-', username: '-', channelUrl: '-', subscribers: '-', likes: '-', uploadDate: '-', liveStatus: '-', liveViewers: '-', error: 'Invalid YouTube URL' };
    }
    const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (videoRes.status !== 200) {
      return { url, videoTitle: '-', videoId: '-', views: '-', duration: '-', channelId: '-', channelName: '-', username: '-', channelUrl: '-', subscribers: '-', likes: '-', uploadDate: '-', liveStatus: '-', liveViewers: '-', error: 'YouTube API error: ' + videoRes.status };
    }
    const videoData = await videoRes.json() as any;
    if (!videoData.items || videoData.items.length === 0) {
      return { url, videoTitle: '-', videoId: '-', views: '-', duration: '-', channelId: '-', channelName: '-', username: '-', channelUrl: '-', subscribers: '-', likes: '-', uploadDate: '-', liveStatus: '-', liveViewers: '-', error: 'Video not found' };
    }
    const v = videoData.items[0];
    const vs = v.snippet;
    const vstat = v.statistics || {};
    const vcont = v.contentDetails || {};
    const vlive = v.liveStreamingDetails || {};
    const channelId = vs.channelId;
    const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    let channelName = vs.channelTitle || '';
    let username = '';
    let subscribers = '-';
    if (channelRes.status === 200) {
      const channelData = await channelRes.json() as any;
      if (channelData.items && channelData.items.length > 0) {
        const c = channelData.items[0];
        const cs = c.snippet;
        const cstat = c.statistics || {};
        channelName = cs.title || '';
        if (cs.customUrl) {
          username = cs.customUrl.startsWith('@') ? cs.customUrl : '@' + cs.customUrl;
        }
        subscribers = cstat.subscriberCount ? formatNumberWithCommas(parseInt(cstat.subscriberCount)) : '-';
      }
    }
    const channelUrl = username ? 'https://www.youtube.com/' + username : `https://www.youtube.com/channel/${channelId}`;
    const liveStatus = vlive.active ? 'Live' : (vcont.liveBroadcastContent === 'live' ? 'Live' : 'Not Live');
    const liveViewers = vlive.concurrentViewers ? formatNumberWithCommas(parseInt(vlive.concurrentViewers)) : '';
    const uploadDate = vs.publishedAt ? vs.publishedAt.split('T')[0] : '-';
    return {
      url,
      videoTitle: vs.title || '-',
      videoId: videoId,
      views: vstat.viewCount ? formatNumberWithCommas(parseInt(vstat.viewCount)) : '-',
      duration: vcont.duration ? formatIsoDuration(vcont.duration) : '-',
      channelId: channelId,
      channelName: channelName || '-',
      username: username,
      channelUrl: channelUrl,
      subscribers: subscribers,
      likes: vstat.likeCount ? formatNumberWithCommas(parseInt(vstat.likeCount)) : '-',
      uploadDate: uploadDate,
      liveStatus: liveStatus,
      liveViewers: liveViewers
    };
  } catch (e) {
    return { url, videoTitle: '-', videoId: '-', views: '-', duration: '-', channelId: '-', channelName: '-', username: '-', channelUrl: '-', subscribers: '-', likes: '-', uploadDate: '-', liveStatus: '-', liveViewers: '-', error: 'Failed: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

async function okruScraper(url: string) {
  try {
    if (!url.includes('ok.ru') && !url.includes('ok.com')) {
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Invalid OK.ru URL' };
    }
    const html = await fetchOkruHtml(url);
    if (!html) {
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Not Found / Private' };
    }
    const data = await parseOkruData(html, url);
    if (!data || data.title === '-') {
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Not Found / Private' };
    }
    return {
      'Video URL': url,
      'Video Title': data.title,
      'Views': data.views,
      'Duration': data.duration,
      'Upload Date': data.uploadDate,
      'Channel Username': data.username,
      'Profile Name': data.profileName,
      'Followers': data.followers,
      'Profile URL': data.profileUrl,
      'Status': 'Done'
    };
  } catch (err) {
    return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Error: ' + String(err) };
  }
}

async function fetchOkruHtml(url: string): Promise<string | null> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Twitterbot/1.0'
  ];
  for (let i = 0; i < userAgents.length; i++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgents[i],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Referer': 'https://ok.ru/'
        },
        redirect: 'follow'
      });
      if (res.status === 200) {
        const h = await res.text();
        if (h && h.length > 5000) return h;
      }
    } catch { continue; }
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

async function parseOkruData(html: string, url: string): Promise<any> {
  let title = '-', views = '-', duration = '-', uploadDate = '-';
  let username = '-', profileName = '-', profileUrl = '-', followers = '-';
  const ogDurMatch = html.match(/property="og:video:duration"\s+content="(\d+)"/i) || html.match(/property="video:duration"\s+content="(\d+)"/i);
  if (ogDurMatch && parseInt(ogDurMatch[1]) > 0 && parseInt(ogDurMatch[1]) < 86400) {
    duration = formatOkruDuration(parseInt(ogDurMatch[1]));
  }
  if (duration === '-') {
    const durMatch = html.match(/class="vid-card_duration">([\d:]+)<\/div>/i);
    if (durMatch && durMatch[1]) duration = padOkruDuration(durMatch[1]);
  }
  const subAttr = html.match(/subscriberscount="(\d+)"/i);
  if (subAttr && parseInt(subAttr[1]) >= 0) followers = formatOkruNumber(parseInt(subAttr[1]));
  const chUrlMatch = html.match(/\/(group|profile)\/([\w\d]+)/i);
  if (chUrlMatch) {
    profileUrl = 'https://ok.ru/' + chUrlMatch[1] + '/' + chUrlMatch[2];
    username = chUrlMatch[2];
  }
  const chNameMatch = html.match(/name="([^"]+)" id="[\d]+"/i);
  if (chNameMatch && chNameMatch[1] && chNameMatch[1] !== 'OK' && chNameMatch[1] !== 'Главная') {
    profileName = decodeOkruHtml(chNameMatch[1]);
  }
  if (profileName === '-' && profileUrl !== '-') {
    try {
      const profHtml = await fetchOkruHtml(profileUrl);
      if (profHtml) {
        const profNameMatch = profHtml.match(/property="og:title"\s+content="([^"|]+?)(?:\s*[|])/i) || profHtml.match(/property="og:title"\s+content="([^"]+)"/i);
        if (profNameMatch && profNameMatch[1]) {
          const pn = decodeOkruHtml(profNameMatch[1].trim());
          if (pn.toLowerCase().indexOf('odnoklassniki') === -1 && pn.length > 1) {
            profileName = pn;
          }
        }
        if (profileName === '-') {
          const pn2 = profHtml.match(/"name"\s*:\s*"([^"]{2,80})"/i) || profHtml.match(/"groupName"\s*:\s*"([^"]{2,80})"/i);
          if (pn2 && pn2[1] && pn2[1] !== 'Главная' && pn2[1] !== 'OK') {
            profileName = decodeOkruHtml(pn2[1].trim());
          }
        }
      }
    } catch (e) { console.log('[OK.ru] Profile fetch error:', e); }
  }
  const viewsMatch = html.match(/<div class="vp-layer-info_i"><span>(.*?)<\/span>/i);
  if (viewsMatch && viewsMatch[1]) {
    const vn = parseInt(viewsMatch[1].toString().replace(/[\s,]/g, ''));
    if (!isNaN(vn) && vn >= 0) views = formatOkruNumber(vn);
  }
  const dateMatch = html.match(/<span class="vp-layer-info_i vp-layer-info_date">([^<]+)<\/span>/i);
  if (dateMatch && dateMatch[1]) {
    const dateText = dateMatch[1].trim().toLowerCase();
    const currentYear = new Date().getFullYear();
    if (dateText.indexOf('вчера') !== -1) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dy = String(yesterday.getDate()).padStart(2, '0');
      const mo = String(yesterday.getMonth() + 1).padStart(2, '0');
      uploadDate = dy + '/' + mo + '/' + currentYear;
    } else {
      const tParts = dateText.split(' ');
      if (tParts.length >= 1) {
        const dParts = tParts[0].split('-');
        const dd = dParts[0] ? dParts[0].padStart(2, '0') : '01';
        const mm = dParts[1] ? dParts[1].padStart(2, '0') : '01';
        uploadDate = dd + '/' + mm + '/' + currentYear;
      }
    }
  }
  const ogTitle = html.match(/<meta property="og:title" content="(.*?)"/i);
  if (ogTitle && ogTitle[1]) {
    const t0 = decodeOkruHtml(ogTitle[1].trim());
    if (t0.toLowerCase().indexOf('odnoklassniki') === -1 && t0.length > 2) title = t0;
  }
  if (title === '-' || views === '-' || duration === '-') {
    const meta = await fetchOkruMetadata(html);
    if (meta) {
      const movie = meta.movie || {};
      const channel = meta.channel || meta.group || meta.user || {};
      if (title === '-') {
        const rawTitle = movie.title || movie.name || '';
        if (rawTitle.length > 1) title = decodeOkruHtml(rawTitle);
      }
      if (views === '-' && movie.views !== undefined && movie.views !== null) {
        views = formatOkruNumber(parseInt(movie.views));
      }
      if (duration === '-' && movie.duration && parseInt(movie.duration) > 0) {
        duration = formatOkruDuration(Math.round(parseInt(movie.duration) / 1000));
      }
      if (uploadDate === '-') {
        const ts = movie.created_ms || movie.ms || movie.date || movie.created || movie.createTime;
        if (ts) uploadDate = parseOkruDate(ts.toString());
      }
      const ownerObj = movie.owner || channel;
      if (ownerObj && typeof ownerObj === 'object') {
        if (profileName === '-') {
          const rawName = ownerObj.name || ownerObj.groupName || ownerObj.userName || ownerObj.firstName || '';
          if (rawName.length > 1) profileName = decodeOkruHtml(rawName);
        }
        if ((username === '-' || profileUrl === '-') && ownerObj.id) {
          const oid = ownerObj.id || ownerObj.groupId || ownerObj.userId;
          if (oid) {
            const isGroup = ownerObj.type === 'GROUP_OPEN' || ownerObj.type === 'GROUP_CLOSED' || !!ownerObj.groupId;
            profileUrl = isGroup ? 'https://ok.ru/group' + oid : 'https://ok.ru/profile/' + oid;
            username = String(oid);
          }
        }
      }
      if (profileName === '-') {
        const metaName = meta.name || meta.groupName || meta.userName || meta.channelName || '';
        if (metaName.length > 1) profileName = decodeOkruHtml(metaName);
      }
      if (followers === '-') {
        const fc = channel.subscribersCount || channel.membersCount || channel.members_count || channel.friendsCount || channel.totalFriendsCount;
        if (fc && parseInt(fc) >= 0) followers = formatOkruNumber(parseInt(fc));
      }
    }
  }
  if (!title || title === '-') title = '-';
  return { title, views, duration, uploadDate, username, profileName, followers, profileUrl };
}

async function fetchOkruMetadata(html: string): Promise<any> {
  const m = html.match(/"metadataUrl"\s*:\s*"(\/[^"]+)"/i);
  if (!m || !m[1]) return null;
  let metaPath = m[1]
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\u003F/gi, '?')
    .replace(/\\u003A/gi, ':')
    .replace(/\\\//g, '/');
  const metaUrl = 'https://ok.ru' + metaPath;
  try {
    const res = await fetch(metaUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://ok.ru/',
        'Accept': 'application/json, text/javascript, */*'
      }
    });
    if (res.status === 200) {
      const text = await res.text();
      if (text && text.length > 10) return JSON.parse(text);
    }
  } catch (e) { console.log('[OK.ru] Metadata fetch error:', e); }
  return null;
}

function formatOkruDuration(s: number): string {
  if (!s || s <= 0) return '-';
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0') + ':' + sec.toString().padStart(2, '0');
}

function padOkruDuration(str: string): string {
  if (!str) return '-';
  const parts = str.split(':').map(p => parseInt(p) || 0);
  while (parts.length < 3) parts.unshift(0);
  return parts.map(p => p.toString().padStart(2, '0')).join(':');
}

function parseOkruDate(val: string): string {
  if (!val) return '-';
  try {
    const str = val.toString().trim();
    let d;
    if (/^\d{10}$/.test(str)) d = new Date(parseInt(str) * 1000);
    else if (/^\d{13}$/.test(str)) d = new Date(parseInt(str));
    else d = new Date(str);
    if (isNaN(d.getTime())) return '-';
    const yr = d.getFullYear();
    if (yr < 2006 || yr > new Date().getFullYear() + 1) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return day + '/' + month + '/' + yr;
  } catch { return '-'; }
}

function formatOkruNumber(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return '-';
  if (n === 0) return '0';
  return Number(n).toLocaleString();
}

function decodeOkruHtml(s: string): string {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

async function telegramScraper(url: string) {
  try {
    if (!url.includes('t.me') && !url.includes('telegram.org') && !url.includes('telegram.me')) {
      return { 'Input URL': url, 'Channel Username': '-', 'Channel Name': '-', 'Description': '-', 'Subscribers': '-', 'Post Views': '-', 'Post Date & Time (IST)': '-', 'Post Text': '-', 'Channel URL': '-', 'Status': 'Invalid Telegram URL' };
    }
    const parsed = extractTelegramUsername(url);
    if (!parsed || !parsed.username) {
      return { 'Input URL': url, 'Channel Username': '-', 'Channel Name': '-', 'Description': '-', 'Subscribers': '-', 'Post Views': '-', 'Post Date & Time (IST)': '-', 'Post Text': '-', 'Channel URL': '-', 'Status': 'Invalid URL' };
    }
    const data = await scrapeTelegramChannel(parsed.username, parsed.msgId);
    if (!data) {
      return { 'Input URL': url, 'Channel Username': '-', 'Channel Name': '-', 'Description': '-', 'Subscribers': '-', 'Post Views': '-', 'Post Date & Time (IST)': '-', 'Post Text': '-', 'Channel URL': '-', 'Status': 'Not Found / Private' };
    }
    return {
      'Input URL': url,
      'Channel Username': data.username || '-',
      'Channel Name': data.channelName || '-',
      'Description': data.description || '-',
      'Subscribers': data.subscribers || '-',
      'Post Views': data.latestViews || '-',
      'Post Date & Time (IST)': data.latestDate || '-',
      'Post Text': data.latestText || '-',
      'Channel URL': data.channelUrl || '-',
      'Status': 'Done'
    };
  } catch (err) {
    console.log('[Telegram] Error:', err);
    return { 'Input URL': url, 'Channel Username': '-', 'Channel Name': '-', 'Description': '-', 'Subscribers': '-', 'Post Views': '-', 'Post Date & Time (IST)': '-', 'Post Text': '-', 'Channel URL': '-', 'Status': 'Error: ' + String(err) };
  }
}

function extractTelegramUsername(input: string) {
  if (!input) return null;
  const s = input.trim();
  const postM = s.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9][A-Za-z0-9_]{2,})\/(\d+)/i);
  if (postM) return { username: postM[1].toLowerCase(), msgId: parseInt(postM[2]) };
  const chanM = s.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9][A-Za-z0-9_]{2,})/i);
  if (chanM) return { username: chanM[1].toLowerCase(), msgId: null };
  if (s.startsWith('@')) return { username: s.substring(1).toLowerCase(), msgId: null };
  if (/^[A-Za-z0-9][A-Za-z0-9_]{2,}$/i.test(s)) return { username: s.toLowerCase(), msgId: null };
  return null;
}

async function scrapeTelegramChannel(username: string, msgId: number | null) {
  const channelUrl = 'https://t.me/' + username;
  const html = await fetchTelegramHtml(channelUrl);
  if (!html || (html.indexOf('tgme_page') === -1 && html.indexOf('og:title') === -1)) {
    return null;
  }
  const data: any = {
    username: '@' + username,
    channelUrl: channelUrl,
    channelName: '-',
    description: '-',
    subscribers: '-',
    latestViews: '-',
    latestDate: '-',
    latestText: '-'
  };
  const nameM = html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i);
  if (nameM) data.channelName = decodeHtmlEntTelegram(nameM[1].trim());
  if (data.channelName === '-') {
    const titleM = html.match(/class="tgme_page_title"[^>]*>\s*<span[^>]*>([^<]+)</i);
    if (titleM) data.channelName = decodeHtmlEntTelegram(titleM[1].trim());
  }
  const descM = html.match(/property="og:description"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:description"/i);
  if (descM) {
    const rawDesc = decodeHtmlEntTelegram(descM[1].trim());
    if (rawDesc.toLowerCase().indexOf('you can view and join') === -1) {
      data.description = rawDesc.substring(0, 300);
    }
  }
  if (data.description === '-') {
    const descM2 = html.match(/class="tgme_page_description"[^>]*>([\s\S]{0,600}?)<\/div>/i);
    if (descM2) {
      const d2 = stripHtmlTelegram(descM2[1]).trim();
      if (d2.toLowerCase().indexOf('you can view and join') === -1) {
        data.description = d2.substring(0, 300);
      }
    }
  }
  const subPatterns = [
    /(\d[\d\s,.]*[KMBkmb]?)\s+subscriber/i,
    /class="[^"]*tgme_page_extra[^"]*"[^>]*>([^<]*\d[^<]*)/i,
    /"extra"[^>]*>([^<]*subscriber[^<]*)/i
  ];
  for (const pattern of subPatterns) {
    const sm = html.match(pattern);
    if (sm && data.subscribers === '-') {
      const parsed2 = parseSubscribersTelegram(sm[1]);
      if (parsed2 !== '-') { data.subscribers = parsed2; break; }
    }
  }
  if (msgId) {
    const embedUrl = 'https://t.me/' + username + '/' + msgId + '?embed=1&single=1&mode=tme';
    const embedHtml = await fetchTelegramHtml(embedUrl);
    if (embedHtml) {
      const postData = parseEmbedPost(embedHtml);
      if (postData) {
        if (postData.views !== '-') data.latestViews = postData.views;
        if (postData.date !== '-') data.latestDate = postData.date;
        if (postData.text !== '-') data.latestText = postData.text;
      }
    }
    if (data.latestDate === '-') {
      const feedUrl = 'https://t.me/s/' + username + '?before=' + (msgId + 1);
      const feedHtml = await fetchTelegramHtml(feedUrl);
      if (feedHtml) {
        if (data.subscribers === '-') {
          const subF = feedHtml.match(/(\d[\d\s,.]*[KMBkmb]?)\s+subscriber/i);
          if (subF) data.subscribers = parseSubscribersTelegram(subF[1]);
        }
        const pData = extractPostById(feedHtml, msgId, username) || extractLatestPost(feedHtml);
        if (pData) {
          if (pData.views !== '-' && data.latestViews === '-') data.latestViews = pData.views;
          if (pData.date !== '-' && data.latestDate === '-') data.latestDate = pData.date;
          if (pData.text !== '-' && data.latestText === '-') data.latestText = pData.text;
        }
      }
    }
  } else {
    const feedUrl2 = 'https://t.me/s/' + username;
    const feedHtml2 = await fetchTelegramHtml(feedUrl2);
    if (feedHtml2) {
      if (data.subscribers === '-') {
        const subF2 = feedHtml2.match(/(\d[\d\s,.]*[KMBkmb]?)\s+subscriber/i);
        if (subF2) data.subscribers = parseSubscribersTelegram(subF2[1]);
      }
      const latest = extractLatestPost(feedHtml2);
      if (latest) {
        if (latest.views !== '-') data.latestViews = latest.views;
        if (latest.date !== '-') data.latestDate = latest.date;
        if (latest.text !== '-') data.latestText = latest.text;
      }
    }
  }
  return data;
}

function parseEmbedPost(html: string) {
  if (!html) return null;
  const result: any = { views: '-', date: '-', text: '-' };
  const viewsPatterns = [
    /class="[^"]*tgme_widget_message_views[^"]*"[^>]*>\s*([0-9][0-9\s.,KMBkmb]*)\s*</i,
    /message_views[^>]*>\s*([0-9][0-9\s.,KMBkmb]*)\s*</i,
    /<span[^>]*>\s*(\d[\d.,]*[KMBkmb]?)\s*<\/span>\s*<\/span>\s*<\/div>/i
  ];
  for (const pattern of viewsPatterns) {
    const vm = html.match(pattern);
    if (vm && result.views === '-') {
      const pv = parseSubscribersTelegram(vm[1].trim());
      if (pv !== '-') { result.views = pv; break; }
    }
  }
  const dateM = html.match(/<time[^>]+datetime="([^"]+)"/i);
  if (dateM) result.date = parseDateTelegram(dateM[1]);
  const textPatterns = [
    /class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]{1,1500}?)<\/div>/i,
    /class="[^"]*js-message_text[^"]*"[^>]*>([\s\S]{1,1500}?)<\/div>/i,
    /class="tgme_widget_message_text[^"]*">([\s\S]{1,1500}?)<\/div>/i
  ];
  for (const pattern of textPatterns) {
    const tm = html.match(pattern);
    if (tm && result.text === '-') {
      const txt = stripHtmlTelegram(tm[1]).trim();
      if (txt.length > 5) { result.text = txt.substring(0, 300); break; }
    }
  }
  if (result.text === '-') {
    const anyText = html.match(/<div[^>]+class="[^"]*message[^"]*"[^>]*>([\s\S]{20,800}?)<\/div>/gi);
    if (anyText) {
      for (const block of anyText) {
        const stripped = stripHtmlTelegram(block).trim();
        if (stripped.length > 20 && stripped.toLowerCase().indexOf('view in telegram') === -1) {
          result.text = stripped.substring(0, 300);
          break;
        }
      }
    }
  }
  return result;
}

function extractPostById(html: string, msgId: number, username: string) {
  if (!html || !msgId) return null;
  const escapedUser = (username || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const p1 = new RegExp('<div[^>]+data-post="' + escapedUser + '\\/' + msgId + '"[^>]*>[\\s\\S]{50,6000}?(?=<div[^>]+data-post="|$)', 'i');
  const m1 = html.match(p1);
  if (m1) return parsePostBlock(m1[0]);
  const p2 = new RegExp('<div[^>]+data-post="[^"]*\\/' + msgId + '"[^>]*>[\\s\\S]{50,6000}?(?=<div[^>]+data-post="|$)', 'i');
  const m2 = html.match(p2);
  if (m2) return parsePostBlock(m2[0]);
  return null;
}

function parsePostBlock(block: string) {
  if (!block) return null;
  const result: any = { views: '-', date: '-', text: '-' };
  const viewsM = block.match(/class="[^"]*tgme_widget_message_views[^"]*"[^>]*>\s*([^<]+)\s*</i) || block.match(/message_views[^>]*>\s*([^<]+)\s*</i);
  if (viewsM) result.views = parseSubscribersTelegram(viewsM[1].trim());
  const dateM = block.match(/<time[^>]+datetime="([^"]+)"/i);
  if (dateM) result.date = parseDateTelegram(dateM[1]);
  const textM = block.match(/class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]{0,1500}?)<\/div>/i);
  if (textM) result.text = stripHtmlTelegram(textM[1]).trim().substring(0, 300);
  return result;
}

function extractLatestPost(html: string) {
  if (!html) return null;
  const msgBlocks: string[] = [];
  const re = /<div[^>]+class="[^"]*tgme_widget_message_wrap[^"]*"[^>]*>[\s\S]+?<\/div>\s*<\/div>\s*<\/div>/gi;
  let m;
  while ((m = re.exec(html)) !== null) msgBlocks.push(m[0]);
  if (msgBlocks.length === 0) {
    const re2 = /<div[^>]+class="[^"]*tgme_widget_message\b[^"]*"[^>]*>([\s\S]{100,3000}?)<\/div>/gi;
    while ((m = re2.exec(html)) !== null) msgBlocks.push(m[0]);
  }
  if (msgBlocks.length === 0) return null;
  const result = parsePostBlock(msgBlocks[msgBlocks.length - 1]);
  if (result.views === '-') {
    const allViews = html.match(/tgme_widget_message_views[^>]*>\s*([^<]+)\s*</gi);
    if (allViews) {
      const lv = allViews[allViews.length - 1].match(/>\s*([^<]+)\s*</);
      if (lv) result.views = parseSubscribersTelegram(lv[1].trim());
    }
  }
  if (result.date === '-') {
    const allDates = html.match(/<time[^>]+datetime="([^"]+)"/gi);
    if (allDates) {
      const ld = allDates[allDates.length - 1].match(/datetime="([^"]+)"/i);
      if (ld) result.date = parseDateTelegram(ld[1]);
    }
  }
  return result;
}

async function fetchTelegramHtml(url: string): Promise<string | null> {
  const userAgents = [
    'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
  ];
  for (let i = 0; i < userAgents.length; i++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgents[i],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        redirect: 'follow'
      });
      if (res.status === 200) {
        const h = await res.text();
        if (h && h.length > 300) return h;
      }
    } catch { continue; }
    await new Promise(r => setTimeout(r, 400));
  }
  return null;
}

function parseDateTelegram(val: string) {
  if (!val) return '-';
  try {
    const d = new Date(val.trim());
    if (isNaN(d.getTime())) return '-';
    d.setHours(d.getHours() + 5, d.getMinutes() + 30);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
  } catch { return '-'; }
}

function parseSubscribersTelegram(str: string) {
  if (!str) return '-';
  const s = str.trim().replace(/\s+/g, '');
  if (!s || s === '-') return '-';
  let n = parseFloat(s.replace(/,/g, ''));
  if (isNaN(n) || n <= 0) return '-';
  if (/[Bb]$/i.test(s)) n *= 1000000000;
  else if (/[Mm]$/i.test(s)) n *= 1000000;
  else if (/[Kk]$/i.test(s)) n *= 1000;
  return Math.round(n).toLocaleString();
}

function stripHtmlTelegram(html: string) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntTelegram(str: string) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n)); } catch { return ''; }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
    })
    .trim();
}

// ======================
// KWAI SCRAPER
// ======================

async function kwaiScraper(url: string) {
  try {
    let result = await snackvideoScraper(url);
    if (result && result['Status'] === 'Not Found / Private') {
      const kwaiUrl = url.replace(/https?:\/\/(www\.)?kwai\.com/i, 'https://www.snackvideo.com');
      const result2 = await snackvideoScraper(kwaiUrl);
      if (result2) result = result2;
    }
    if (result) {
      result['Video URL'] = url;
      if (result['Profile URL'] && result['Profile URL'] !== '-') {
        result['Profile URL'] = result['Profile URL'].replace(/snackvideo\.com/i, 'kwai.com').replace(/snack\.video/i, 'kwai.com');
      }
    }
    return result;
  } catch (e) {
    return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Error: ' + String(e) };
  }
}

// ======================
// SNACKVIDEO SCRAPER
// ======================

async function snackvideoScraper(url: string) {
  try {
    const html = await fetchPlatformHtml(url);
    if (!html) {
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Not Found / Private' };
    }
    const ldData = parseVideoJsonLd(html, url, 'snackvideo');
    const data = ldData && ldData.title !== '-' ? ldData : parseSnackVideoHtml(html, url);
    if (!data || data.title === '-') {
      return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Not Found / Private' };
    }
    let profileUrl = data.username !== '-' ? buildProfileUrlKwaiSnack('snackvideo', data.username) : '-';
    if (data.username !== '-' && (data.profileName === '-' || data.followers === '-')) {
      const pData = await fetchProfileDataKwaiSnack('snackvideo', data.username);
      if (pData) {
        if (data.profileName === '-' && pData.profileName !== '-') data.profileName = pData.profileName;
        if (data.followers === '-' && pData.followers !== '-') data.followers = pData.followers;
      }
    }
    return {
      'Video URL': url,
      'Video Title': data.title,
      'Views': data.views,
      'Duration': data.duration,
      'Upload Date': data.uploadDate,
      'Channel Username': data.username,
      'Profile Name': data.profileName,
      'Followers': data.followers,
      'Profile URL': profileUrl,
      'Status': 'Done'
    };
  } catch (e) {
    return { 'Video URL': url, 'Video Title': '-', 'Views': '-', 'Duration': '-', 'Upload Date': '-', 'Channel Username': '-', 'Profile Name': '-', 'Followers': '-', 'Profile URL': '-', 'Status': 'Error: ' + String(e) };
  }
}

// ======================
// SHARED: HTML Fetch
// ======================

async function fetchPlatformHtml(url: string): Promise<string | null> {
  const userAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Twitterbot/1.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  ];
  for (const ua of userAgents) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        redirect: 'follow'
      });
      if (res.status === 200) {
        const html = await res.text();
        if (html && html.length > 5000) return html;
      }
    } catch { continue; }
  }
  return null;
}

// ======================
// SHARED: JSON-LD Parser
// ======================

function parseVideoJsonLd(html: string, url: string, platform: string): any {
  const blocks: any[] = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try { blocks.push(JSON.parse(match[1].trim())); } catch {}
  }
  if (!blocks.length) return null;
  let video: any = null;
  for (const block of blocks) {
    if (block['@type'] === 'VideoObject') { video = block; break; }
    if (Array.isArray(block['@graph'])) {
      for (const item of block['@graph']) {
        if (item['@type'] === 'VideoObject') { video = item; break; }
      }
      if (video) break;
    }
  }
  if (!video) {
    for (const block of blocks) {
      if (block.name || block.duration) { video = block; break; }
    }
  }
  if (!video) return null;
  const rawTitle = video.name || video.headline || '-';
  const title = cleanVideoTitle(rawTitle);
  const duration = video.duration ? parseIsoDuration(video.duration) : '-';
  const uploadDate = parseKwaiSnackDate(video.uploadDate || video.datePublished);
  let views = '-';
  if (video.interactionStatistic) {
    const stats = Array.isArray(video.interactionStatistic) ? video.interactionStatistic : [video.interactionStatistic];
    for (const st of stats) {
      if (st.userInteractionCount) { views = formatNumberWithCommas(parseInt(st.userInteractionCount)); break; }
    }
  }
  let username = '-';
  let profileName = '-';
  const author = video.author || video.creator || video.publisher;
  if (author) {
    const a = Array.isArray(author) ? author[0] : author;
    profileName = a.name || '-';
    if (a.url) {
      let um;
      if (platform === 'kwai') um = a.url.match(/kwai\.com\/@?([\w.]+)/);
      else um = a.url.match(/snackvideo\.com\/@?([\w.]+)/i) || a.url.match(/snack\.video\/@?([\w.]+)/i);
      if (um) username = '@' + um[1];
    }
  }
  if (username === '-') {
    let um;
    if (platform === 'kwai') um = url.match(/kwai\.com\/@([\w.]+)/);
    else um = url.match(/snackvideo\.com\/@([\w.]+)/i) || url.match(/snack\.video\/@([\w.]+)/i);
    if (um) username = '@' + um[1];
  }
  const followersMatch = html.match(/"fansCount"\s*:\s*(\d+)/i)
    || html.match(/"followerCount"\s*:\s*(\d+)/i)
    || html.match(/"fans_count"\s*:\s*(\d+)/i)
    || html.match(/"followersCount"\s*:\s*(\d+)/i);
  const followers = followersMatch ? formatNumberWithCommas(parseInt(followersMatch[1])) : '-';
  return { title, views, duration, uploadDate, username, profileName, followers };
}

// ======================
// SHARED: Kwai HTML Parser
// ======================

function parseKwaiHtml(html: string, url: string): any {
  let title = pickFromHtml(html, [
    /property="og:title"\s+content="([^"]+)"/i,
    /name="twitter:title"\s+content="([^"]+)"/i,
    /<title>([^<|]+?)(?:\s*[-|].*)?<\/title>/i
  ]);
  if (!title || title.length < 2) {
    const inlineMatch = html.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (inlineMatch && inlineMatch[1].length > 2 && inlineMatch[1].length < 200) title = inlineMatch[1];
  }
  if (!title || title.length < 2) {
    const descMatch = html.match(/"desc"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (descMatch && descMatch[1].length > 2 && descMatch[1].length < 200) title = descMatch[1];
  }
  if (!title || title.length < 2) {
    const videoTitleMatch = html.match(/"videoTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (videoTitleMatch && videoTitleMatch[1].length > 2) title = videoTitleMatch[1];
  }
  if (!title || title.length < 2) return null;
  title = cleanVideoTitle(title);
  const durRaw = pickFromHtml(html, [
    /"duration"\s*:\s*"(PT[^"]+)"/i,
    /"duration"\s*:\s*"(\d+)"/i,
    /"duration"\s*:\s*(\d+)/i,
    /"videoDuration"\s*:\s*(\d+)/i,
    /"playTime"\s*:\s*(\d+)/i
  ]);
  let duration = '-';
  if (durRaw) {
    if (durRaw.indexOf('PT') === 0) {
      duration = parseIsoDuration(durRaw);
    } else {
      const raw = parseInt(durRaw);
      if (raw > 1000) duration = formatKwaiSnackDuration(Math.ceil(raw / 1000));
      else if (raw > 0) duration = formatKwaiSnackDuration(raw);
    }
  }
  const viewsRaw = pickFromHtml(html, [
    /"viewCount"\s*:\s*(\d+)/,
    /"playCount"\s*:\s*(\d+)/,
    /userInteractionCount['":\s]+(\d+)/,
    /"views"\s*:\s*(\d+)/i,
    /"watchCount"\s*:\s*(\d+)/i
  ]);
  const dateRaw = pickFromHtml(html, [
    /"uploadDate"\s*:\s*"([^"]+)"/i,
    /property="article:published_time"\s+content="([^"]+)"/i,
    /"timestamp"\s*:\s*(\d{10,13})/,
    /"createTime"\s*:\s*(\d{10,13})/i,
    /"publishTime"\s*:\s*(\d{10,13})/i
  ]);
  let usernameRaw = pickFromHtml(html, [
    /kwai\.com\/@([A-Za-z0-9_.]+)/i,
    /"kwaiId"\s*:\s*"([^"]+)"/i,
    /"userId"\s*:\s*"([^"]+)"/i,
    /"uid"\s*:\s*"([^"]+)"/i
  ]);
  if (!usernameRaw) {
    const um = url.match(/kwai\.com\/@([\w.]+)/);
    if (um) usernameRaw = um[1];
  }
  const profileName = pickFromHtml(html, [
    /"nickname"\s*:\s*"([^"]+)"/i,
    /"nickName"\s*:\s*"([^"]+)"/i,
    /"authorName"\s*:\s*"([^"]+)"/i,
    /"name"\s*:\s*"([^"]{2,50})"/i,
    /"userName"\s*:\s*"([^"]+)"/i
  ]);
  const followersRaw = pickFromHtml(html, [
    /"fansCount"\s*:\s*(\d+)/i,
    /"followerCount"\s*:\s*(\d+)/i,
    /"fans_count"\s*:\s*(\d+)/i,
    /"followersCount"\s*:\s*(\d+)/i
  ]);
  return {
    title,
    views: viewsRaw ? formatNumberWithCommas(parseInt(viewsRaw)) : '-',
    duration,
    uploadDate: parseKwaiSnackDate(dateRaw),
    username: usernameRaw ? '@' + usernameRaw.replace('@', '') : '-',
    profileName: profileName || '-',
    followers: followersRaw ? formatNumberWithCommas(parseInt(followersRaw)) : '-'
  };
}

// ======================
// SHARED: SnackVideo HTML Parser
// ======================

function parseSnackVideoHtml(html: string, url: string): any {
  const titleRaw = pickFromHtml(html, [
    /property="og:title"\s+content="([^"]+)"/i,
    /name="twitter:title"\s+content="([^"]+)"/i,
    /<title>([^<|]+?)(?:\s*[-|].*)?<\/title>/i
  ]);
  if (!titleRaw) return null;
  const title = cleanVideoTitle(titleRaw);
  const durRaw = pickFromHtml(html, [
    /"duration"\s*:\s*"(PT[^"]+)"/i,
    /"duration"\s*:\s*"(\d+)"/i,
    /"duration"\s*:\s*(\d+)/i,
    /property="video:duration"\s+content="(\d+)"/i
  ]);
  let duration = '-';
  if (durRaw) {
    if (durRaw.indexOf('PT') === 0) {
      duration = parseIsoDuration(durRaw);
    } else {
      const raw = parseInt(durRaw);
      if (raw > 1000) duration = formatKwaiSnackDuration(Math.ceil(raw / 1000));
      else if (raw > 0) duration = formatKwaiSnackDuration(raw);
    }
  }
  const viewsRaw = pickFromHtml(html, [
    /"playCount"\s*:\s*(\d+)/,
    /"viewCount"\s*:\s*(\d+)/,
    /"play_count"\s*:\s*(\d+)/,
    /userInteractionCount['":\s]+(\d+)/
  ]);
  const dateRaw = pickFromHtml(html, [
    /"uploadDate"\s*:\s*"([^"]+)"/i,
    /property="article:published_time"\s+content="([^"]+)"/i,
    /"createTime"\s*:\s*(\d{10,13})/,
    /"timestamp"\s*:\s*(\d{10,13})/
  ]);
  let usernameRaw = pickFromHtml(html, [
    /snackvideo\.com\/@([A-Za-z0-9_.]+)/i,
    /snack\.video\/@([A-Za-z0-9_.]+)/i,
    /"userId"\s*:\s*"([^"]+)"/i,
    /"userName"\s*:\s*"([^"]+)"/i
  ]);
  if (!usernameRaw) {
    const um = url.match(/snackvideo\.com\/@([\w.]+)/i);
    if (um) usernameRaw = um[1];
  }
  const profileName = pickFromHtml(html, [
    /"nickname"\s*:\s*"([^"]+)"/i,
    /"nickName"\s*:\s*"([^"]+)"/i,
    /"authorName"\s*:\s*"([^"]+)"/i,
    /"name"\s*:\s*"([^"]{2,50})"/i
  ]);
  const followersRaw = pickFromHtml(html, [
    /"fansCount"\s*:\s*(\d+)/i,
    /"followerCount"\s*:\s*(\d+)/i,
    /"fans_count"\s*:\s*(\d+)/i,
    /"followersCount"\s*:\s*(\d+)/i
  ]);
  return {
    title,
    views: viewsRaw ? formatNumberWithCommas(parseInt(viewsRaw)) : '-',
    duration,
    uploadDate: parseKwaiSnackDate(dateRaw),
    username: usernameRaw ? '@' + usernameRaw.replace('@', '') : '-',
    profileName: profileName || '-',
    followers: followersRaw ? formatNumberWithCommas(parseInt(followersRaw)) : '-'
  };
}

// ======================
// SHARED: Helpers
// ======================

function cleanVideoTitle(title: string | null): string {
  if (!title || title === '-') return title || '-';
  let t = title;
  let hadPrefix = false;
  const idx1 = t.indexOf('). ');
  if (idx1 !== -1) {
    const after1 = t.substring(idx1 + 3).trim();
    if (after1 && after1.length > 2) { t = after1; hadPrefix = true; }
  }
  if (!hadPrefix) {
    const m = t.match(/^.{1,80}?\(@?[\w.]+\)\s*[.\-–]?\s*/);
    if (m) {
      const after2 = t.substring(m[0].length).trim();
      if (after2 && after2.length > 2) { t = after2; hadPrefix = true; }
    }
  }
  if (!hadPrefix) {
    const dotIdx = t.indexOf('. ');
    if (dotIdx > 3 && dotIdx < 60) {
      const after3 = t.substring(dotIdx + 2).trim();
      if (after3 && after3.length > 5 && /[a-zA-Z\u0600-\u06FF\u0900-\u097F]/.test(after3)) {
        t = after3; hadPrefix = true;
      }
    }
  }
  if (hadPrefix) {
    const idx2 = t.indexOf('. ');
    if (idx2 !== -1) {
      const after4 = t.substring(idx2 + 2).trim();
      if (after4 && after4.length > 2) t = after4;
    }
  }
  return (t && t.length > 2) ? t : title;
}

function buildProfileUrlKwaiSnack(platform: string, username: string): string {
  const u = username.replace('@', '');
  if (platform === 'kwai') return 'https://www.kwai.com/@' + u;
  if (platform === 'snackvideo') return 'https://www.snackvideo.com/@' + u;
  return '-';
}

async function fetchProfileDataKwaiSnack(platform: string, username: string): Promise<{ profileName: string; followers: string } | null> {
  const u = username.replace('@', '');
  const profileUrl = buildProfileUrlKwaiSnack(platform, '@' + u);
  const html = await fetchPlatformHtml(profileUrl);
  if (!html) return null;
  const ldBlocks: any[] = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try { ldBlocks.push(JSON.parse(match[1].trim())); } catch {}
  }
  let profileName = '-';
  let followers = '-';
  for (const b of ldBlocks) {
    if (b['@type'] === 'Person' || b['@type'] === 'ProfilePage' || b.name) {
      if (b.name && profileName === '-') profileName = b.name;
      if (b.interactionStatistic) {
        const stats = Array.isArray(b.interactionStatistic) ? b.interactionStatistic : [b.interactionStatistic];
        for (const st of stats) {
          if (st.userInteractionCount &&
              (String(st.interactionType || '').indexOf('Follow') !== -1 ||
               String(st.name || '').toLowerCase().indexOf('follow') !== -1)) {
            followers = formatNumberWithCommas(parseInt(st.userInteractionCount));
            break;
          }
        }
        if (followers === '-' && stats[0] && stats[0].userInteractionCount) {
          followers = formatNumberWithCommas(parseInt(stats[0].userInteractionCount));
        }
      }
      if (b.followerCount) followers = formatNumberWithCommas(parseInt(b.followerCount));
      break;
    }
  }
  if (profileName === '-') {
    profileName = pickFromHtml(html, [
      /"nickname"\s*:\s*"([^"]+)"/i,
      /"nickName"\s*:\s*"([^"]+)"/i,
      /"name"\s*:\s*"([^"]{2,50})"/i,
      /property="og:title"\s+content="([^"]+)"/i,
      /name="twitter:title"\s+content="([^"]+)"/i
    ]) || '-';
  }
  if (followers === '-') {
    const rawF = pickFromHtml(html, [
      /"fansCount"\s*:\s*(\d+)/i,
      /"followerCount"\s*:\s*(\d+)/i,
      /"fans_count"\s*:\s*(\d+)/i,
      /"followersCount"\s*:\s*(\d+)/i
    ]);
    if (rawF) {
      const n = parseInt(rawF);
      followers = !isNaN(n) ? formatNumberWithCommas(n) : rawF;
    }
  }
  return { profileName, followers };
}

function pickFromHtml(html: string | null, patterns: RegExp[]): string | null {
  if (!html) return null;
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function formatKwaiSnackDuration(s: number): string {
  if (!s || s <= 0) return '-';
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(x => x.toString().padStart(2, '0')).join(':');
}

function parseKwaiSnackDate(val: string | null | undefined): string {
  if (!val) return '-';
  try {
    const str = val.toString().trim();
    let d;
    if (/^\d{10}$/.test(str)) d = new Date(parseInt(str) * 1000);
    else if (/^\d{13}$/.test(str)) d = new Date(parseInt(str));
    else d = new Date(str);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return day + '/' + month + '/' + year;
  } catch { return '-'; }
}

export default router;