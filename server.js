app.get('/ost', async (req, res) => {
  const game = req.query.game;
  if (!game) return res.status(400).json({ error: 'No game provided' });

  try {
    // Step 1: Search KHInsider
    const searchUrl = `https://downloads.khinsider.com/search?search=${encodeURIComponent(game)}`;
    const searchHtml = await fetch(searchUrl).then(r => r.text());
    const $search = cheerio.load(searchHtml);
    const firstAlbumLink = $search('.albumLink').first().attr('href');

    if (!firstAlbumLink) return res.status(404).json({ error: 'No album found' });

    // Step 2: Get album page
    const albumUrl = `https://downloads.khinsider.com${firstAlbumLink}`;
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
    res.status(500).json({ error: err.message });
  }
});
