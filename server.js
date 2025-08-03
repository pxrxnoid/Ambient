// Import dependencies
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Debug route to check if server is alive
app.get('/ping', (req, res) => {
  res.json({ status: 'Proxy is alive ✅' });
});

// Main OST route
app.get('/ost', async (req, res) => {
  const game = req.query.game;
  if (!game) return res.status(400).json({ error: 'No game provided' });

  try {
    console.log(`Searching for: ${game}`);

    // Step 1: Search KHInsider
    const searchUrl = `https://downloads.khinsider.com/search?search=${encodeURIComponent(game)}`;
    console.log(`Search URL: ${searchUrl}`);

    const searchHtml = await fetch(searchUrl).then(r => r.text());
    const $search = cheerio.load(searchHtml);
    const firstAlbumLink = $search('.albumLink').first().attr('href');

    if (!firstAlbumLink) return res.status(404).json({ error: 'No album found' });

    // Step 2: Get album page
    const albumUrl = `https://downloads.khinsider.com${firstAlbumLink}`;
    console.log(`Album URL: ${albumUrl}`);

    const albumHtml = await fetch(albumUrl).then(r => r.text());
    const $album = cheerio.load(albumHtml);

    let tracks = [];
    $album('a').each((_, el) => {
      const href = $album(el).attr('href');
      if (href && href.includes('/game-soundtracks/')) {
        tracks.push(`https://downloads.khinsider.com${href}`);
      }
    });

    res.json({ game, searchUrl, albumUrl, tracks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
