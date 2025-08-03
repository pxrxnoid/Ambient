// Import dependencies
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Debug route
app.get('/ping', (req, res) => {
  res.json({ status: 'Proxy is alive ✅' });
});

// Main OST route
app.get('/ost', async (req, res) => {
  const game = req.query.game;
  if (!game) return res.status(400).json({ error: 'No game provided' });

  try {
    // Step 1: Search KHInsider
    const searchUrl = `https://downloads.khinsider.com/search?search=${encodeURIComponent(game)}`;
    console.log(`Searching: ${searchUrl}`);

    const searchHtml = await fetch(searchUrl).then(r => r.text());
    const $search = cheerio.load(searchHtml);

    // ✅ Correct selector for first album link
    let firstAlbumLink = null;
    $search('td.clickable-row a').each((_, el) => {
      const href = $search(el).attr('href');
      if (href && href.includes('/game-soundtracks/album/')) {
        firstAlbumLink = href;
        return false; // stop after first
      }
    });

    if (!firstAlbumLink) {
      console.log('No album found for search');
      return res.status(404).json({ error: 'No album found' });
    }

    // Step 2: Open album page
    const albumUrl = `https://downloads.khinsider.com${firstAlbumLink}`;
    console.log(`Album URL: ${albumUrl}`);

    const albumHtml = await fetch(albumUrl).then(r => r.text());
    const $album = cheerio.load(albumHtml);

    // Step 3: Scrape track MP3 URLs
    let tracks = [];
    $album('table tr td a').each((_, el) => {
      const href = $album(el).attr('href');
      if (href && href.includes('/game-soundtracks/')) {
        tracks.push(`https://downloads.khinsider.com${href}`);
      }
    });

    // Step 4: Return data
    res.json({ game, albumUrl, tracks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
