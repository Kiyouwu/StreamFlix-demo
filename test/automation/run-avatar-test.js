const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const root = path.resolve(__dirname, '..', '..'); // c:/.../Web/test
  const profileHtml = `file://${path.join(root, 'profile.html')}`;
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  // small 1x1 png base64
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAm8B9dKf0wAAAABJRU5ErkJggg==';
  const avatar1Path = path.join(tmpDir, 'avatar1.png');
  const avatar2Path = path.join(tmpDir, 'avatar2.png');

  // write two files (identical small pngs are fine for functionality test)
  fs.writeFileSync(avatar1Path, Buffer.from(tinyPngBase64, 'base64'));
  fs.writeFileSync(avatar2Path, Buffer.from(tinyPngBase64, 'base64'));

  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Prepare localStorage before page scripts run: create a test user and currentUser
  const testUser = {
    id: 'user_test_automation',
    username: 'puppet',
    email: 'puppet@example.com',
    password: '123456',
    avatar: 'assets/default-avatar.png',
    signature: 'automation test',
    registerTime: new Date().toISOString(),
    followers: [],
    following: [],
    favorites: [],
    videos: [],
    dynamic: []
  };

  await page.evaluateOnNewDocument((user) => {
    try {
      localStorage.setItem('StreamFlix_data/users', JSON.stringify([user]));
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e) {
      // ignore
    }
  }, testUser);

  // Open profile page
  await page.goto(profileHtml, { waitUntil: 'networkidle2' });

  // Wait for profileManager
  await page.waitForFunction('window.profileManager !== undefined');
  console.log('profileManager ready');

  // Helper to list image keys in IndexedDB
  async function listImageKeys() {
    return await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open('VideoStorageDB');
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['images'], 'readonly');
            const store = tx.objectStore('images');
            const getAllKeysReq = store.getAllKeys();
            getAllKeysReq.onsuccess = () => resolve(getAllKeysReq.result || []);
            getAllKeysReq.onerror = () => resolve([]);
          };
          req.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
      });
    });
  }

  // Open edit modal via profileManager
  await page.evaluate(() => {
    try { profileManager.openEditProfile(); } catch(e) { console.warn(e); }
  });

  // Wait for input to appear
  await page.waitForSelector('#editAvatar', { visible: true });

  // Upload first avatar
  await page.setInputFiles('#editAvatar', avatar1Path);
  // submit form
  await page.click('#editProfileForm button[type="submit"]');

  // Wait a bit for async storage operations
  await page.waitForTimeout(1500);

  const keysAfterFirst = await listImageKeys();
  console.log('IndexedDB images after first upload:', keysAfterFirst);

  const currentUserAfterFirst = await page.evaluate(() => localStorage.getItem('currentUser'));
  console.log('currentUser after first upload:', currentUserAfterFirst ? JSON.parse(currentUserAfterFirst).avatar : null);

  // Upload second avatar
  await page.evaluate(() => { profileManager.openEditProfile(); });
  await page.waitForTimeout(200);
  await page.setInputFiles('#editAvatar', avatar2Path);
  await page.click('#editProfileForm button[type="submit"]');

  await page.waitForTimeout(2000);

  const keysAfterSecond = await listImageKeys();
  console.log('IndexedDB images after second upload:', keysAfterSecond);

  const currentUserAfterSecond = await page.evaluate(() => localStorage.getItem('currentUser'));
  console.log('currentUser after second upload:', currentUserAfterSecond ? JSON.parse(currentUserAfterSecond).avatar : null);

  // Check that first stored id (if any) was removed from images store (i.e., keysAfterFirst should be superset or equal to keysAfterSecond depending on deletion)
  try {
    const firstIds = keysAfterFirst;
    const secondIds = keysAfterSecond;

    const removed = firstIds.filter(id => !secondIds.includes(id));
    console.log('Removed image ids after second upload (should include old avatar id if it was indexeddb):', removed);
  } catch (e) { console.warn(e); }

  await browser.close();
  console.log('Done. Please inspect logs to verify behavior.');
})();
