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

    // ✅ Look for the HTML5 audio player source
    const audioPlayer = $album('audio source').first();
    const audioUrl = audioPlayer.attr('src');
    
    if (audioUrl) {
      const fullAudioUrl = `https://downloads.khinsider.com${audioUrl}`;
      console.log(`✅ Found audio player URL: ${fullAudioUrl}`);
      
      // Get the first track name from the table
      const firstTrackName = $album('.songlist tr:first-child td:first-child').text().trim() || 'Track 1';
      
      const audioTracks = [{
        name: firstTrackName,
        url: fullAudioUrl
      }];
      
      res.json({ tracks: audioTracks });
    } else {
      // ✅ Fallback: Look for audio URLs in the page
      const audioLinks = $album('a[href*=".mp3"], a[href*=".ogg"], a[href*=".wav"]');
      if (audioLinks.length > 0) {
        const firstAudioUrl = audioLinks.first().attr('href');
        const fullAudioUrl = `https://downloads.khinsider.com${firstAudioUrl}`;
        
        console.log(`✅ Found fallback audio URL: ${fullAudioUrl}`);
        
        const audioTracks = [{
          name: 'Track 1',
          url: fullAudioUrl
        }];
        
        res.json({ tracks: audioTracks });
      } else {
        console.log('❌ No audio URLs found');
        res.status(404).json({ error: 'No audio URLs found' });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
