/**
 * Seed 30 Paul Graham essays into Jetpack bookmarks.
 *
 * Usage:
 *   1. Open the Jetpack popup (click extension icon)
 *   2. Right-click popup → Inspect → Console
 *   3. Paste this entire script and press Enter
 */

(async () => {
  const STORAGE_KEY = 'nlm_bookmarks';
  const COLLECTION = 'Paul Graham';

  const articles = [
    { path: 'brandage.html', title: 'The Brand Age' },
    { path: 'field.html', title: 'The Shape of the Essay Field' },
    { path: 'goodwriting.html', title: 'Good Writing' },
    { path: 'do.html', title: 'What to Do' },
    { path: 'woke.html', title: 'The Origins of Wokeness' },
    { path: 'writes.html', title: 'Writes and Write-Nots' },
    { path: 'when.html', title: 'When To Do What You Love' },
    { path: 'foundermode.html', title: 'Founder Mode' },
    { path: 'persistence.html', title: 'The Right Kind of Stubborn' },
    { path: 'reddits.html', title: 'The Reddits' },
    { path: 'google.html', title: 'How to Start Google' },
    { path: 'best.html', title: 'The Best Essay' },
    { path: 'superlinear.html', title: 'Superlinear Returns' },
    { path: 'greatwork.html', title: 'How to Do Great Work' },
    { path: 'getideas.html', title: 'How to Get New Ideas' },
    { path: 'read.html', title: 'The Need to Read' },
    { path: 'want.html', title: "What You (Want to)* Want" },
    { path: 'alien.html', title: 'Alien Truth' },
    { path: 'users.html', title: "What I've Learned from Users" },
    { path: 'heresy.html', title: 'Heresy' },
    { path: 'words.html', title: 'Putting Ideas into Words' },
    { path: 'goodtaste.html', title: 'Is There Such a Thing as Good Taste?' },
    { path: 'smart.html', title: 'Beyond Smart' },
    { path: 'weird.html', title: 'Weird Languages' },
    { path: 'hwh.html', title: 'How to Work Hard' },
    { path: 'own.html', title: "A Project of One's Own" },
    { path: 'fn.html', title: 'Fierce Nerds' },
    { path: 'newideas.html', title: 'Crazy New Ideas' },
    { path: 'nft.html', title: 'An NFT That Saves Lives' },
    { path: 'real.html', title: 'The Real Reason to End the Death Penalty' },
  ];

  // Load existing store
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const store = result[STORAGE_KEY] || { items: [], collections: ['默认收藏'] };

  // Ensure collection exists
  if (!store.collections.includes(COLLECTION)) {
    store.collections.push(COLLECTION);
  }

  // Existing URLs for dedup
  const existingUrls = new Set(store.items.map((b) => b.url));

  let added = 0;
  for (const { path, title } of articles) {
    const url = `https://www.paulgraham.com/${path}`;
    if (existingUrls.has(url)) {
      console.log(`⏭ Skip (exists): ${title}`);
      continue;
    }

    store.items.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      url,
      title,
      favicon: 'https://www.paulgraham.com/favicon.ico',
      collection: COLLECTION,
      addedAt: Date.now() - added * 1000, // slight offset so ordering is stable
    });
    added++;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: store });
  console.log(`✅ Done! Added ${added} Paul Graham essays to "${COLLECTION}" collection.`);
  console.log('   Refresh the popup to see them.');
})();
