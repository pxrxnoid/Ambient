// Import dependencies
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Debug route to check server is alive
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

    // Step 2: Find first album link in search table
    let firstAlbumLink = null;
    $search('table tr td.albumDownloadLink a').each((_, el) => {
      const href = $search(el).attr('href');
      if (href && href.includes('/game-soundtracks/album/')) {
        firstAlbumLink = href;
        return false; // stop loop
      }
    });

    if (!firstAlbumLink) {
      console.log('No album found for search');
      return res.status(404).json({ error: 'No album found' });
    }

    // Build full album URL
    const albumUrl = `https://downloads.khinsider.com${firstAlbumLink}`;
    console.log(`Album URL: ${albumUrl}`);

    // Step 3: Open album page
    const albumHtml = await fetch(albumUrl).then(r => r.text());
    const $album = cheerio.load(albumHtml);

    // Step 4: Collect all track MP3 links
    let tracks = [];
    $album('table tr td a').each((_, el) => {
      const href = $album(el).attr('href');
      if (href && href.includes('/game-soundtracks/')) {
        tracks.push(`https://downloads.khinsider.com${href}`);
      }
    });

    // Return data
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
