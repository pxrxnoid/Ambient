const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/ping', (req, res) => {
  res.json({ status: 'Proxy is alive ✅' });
});

app.get('/ost', async (req, res) => {
  const game = req.query.game;
  if (!game) return res.status(400).json({ error: 'No game provided' });

  try {
    const searchUrl = `https://downloads.khinsider.com/search?search=${encodeURIComponent(game)}`;
    console.log(`Searching: ${searchUrl}`);

    const searchHtml = await fetch(searchUrl).then(r => r.text());
    const $search = cheerio.load(searchHtml);

    // ✅ Grab first album link from second row of results table
    const firstAlbumLink = $search('table tr:nth-child(2) td a').attr('href');

    if (!firstAlbumLink) {
      console.log('No album found for search');
      return res.status(404).json({ error: 'No album found' });
    }

    const albumUrl = `https://downloads.khinsider.com${firstAlbumLink}`;
    console.log(`Album URL: ${albumUrl}`);

    const albumHtml = await fetch(albumUrl).then(r => r.text());
    const $album = cheerio.load(albumHtml);

    let tracks = [];

    // ✅ Look for download links in the songlist table
    $album('.songlist tr').each((index, element) => {
      const $row = $album(element);
      const $nameCell = $row.find('td:first-child');
      const $downloadCell = $row.find('td:last-child a');
      
      if ($nameCell.length && $downloadCell.length) {
        const trackName = $nameCell.text().trim();
        const downloadUrl = $downloadCell.attr('href');
        
        if (trackName && downloadUrl && !trackName.includes('Track')) {
          tracks.push({
            name: trackName,
            downloadPage: `https://downloads.khinsider.com${downloadUrl}`
          });
        }
      }
    });

    // ✅ If no tracks found in songlist, try alternative selectors
    if (tracks.length === 0) {
      $album('table tr td a').each((index, element) => {
        const href = $album(element).attr('href');
        const text = $album(element).text().trim();
        
        if (href && href.includes('/game-soundtracks/') && text) {
          tracks.push({
            name: text,
            downloadPage: `https://downloads.khinsider.com${href}`
          });
        }
      });
    }

    console.log(`Found ${tracks.length} tracks, getting audio URLs...`);

    // ✅ Now follow each download page to get the actual audio URL
    const audioTracks = [];
    for (let i = 0; i < Math.min(tracks.length, 5); i++) { // Limit to first 5 tracks
      const track = tracks[i];
      try {
        console.log(`Getting audio URL for: ${track.name}`);
        const downloadPageHtml = await fetch(track.downloadPage).then(r => r.text());
        const $download = cheerio.load(downloadPageHtml);
        
        // Look for direct audio file links
        const audioUrl = $download('a[href*=".mp3"], a[href*=".ogg"], a[href*=".wav"]').first().attr('href');
        
        if (audioUrl) {
          audioTracks.push({
            name: track.name,
            url: `https://downloads.khinsider.com${audioUrl}`
          });
          console.log(`✅ Found audio URL for ${track.name}`);
        } else {
          console.log(`❌ No audio URL found for ${track.name}`);
        }
      } catch (err) {
        console.log(`Failed to get audio URL for ${track.name}: ${err.message}`);
      }
    }

    console.log(`Found ${audioTracks.length} audio tracks`);
    res.json({ tracks: audioTracks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
