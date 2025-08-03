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

    // ✅ Get the first track's download page URL
    const firstTrackLink = $album('.songlist tr:first-child td:last-child a').attr('href');
    
    if (!firstTrackLink) {
      console.log('No track links found');
      return res.status(404).json({ error: 'No track links found' });
    }

    const trackPageUrl = `https://downloads.khinsider.com${firstTrackLink}`;
    console.log(`Track page URL: ${trackPageUrl}`);

    // ✅ Follow the track page to get the actual audio stream
    const trackPageHtml = await fetch(trackPageUrl).then(r => r.text());
    const $trackPage = cheerio.load(trackPageHtml);

    // ✅ Look for the audio player source or direct download links
    let audioUrl = null;
    
    // Try to find the audio player source
    const audioPlayer = $trackPage('audio source').first();
    if (audioPlayer.length > 0) {
      audioUrl = audioPlayer.attr('src');
      console.log(`Found audio player source: ${audioUrl}`);
    }
    
    // If no player source, try to find direct download links
    if (!audioUrl) {
      const downloadLinks = $trackPage('a[href*=".mp3"], a[href*=".ogg"], a[href*=".wav"]');
      if (downloadLinks.length > 0) {
        audioUrl = downloadLinks.first().attr('href');
        console.log(`Found download link: ${audioUrl}`);
      }
    }

    if (audioUrl) {
      const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `https://downloads.khinsider.com${audioUrl}`;
      console.log(`✅ Final audio URL: ${fullAudioUrl}`);
      
      // Get track name from the page
      const trackName = $trackPage('h1, h2, .song-name').first().text().trim() || 'Track 1';
      
      const audioTracks = [{
        name: trackName,
        url: fullAudioUrl
      }];
      
      res.json({ tracks: audioTracks });
    } else {
      console.log('❌ No audio URL found on track page');
      res.status(404).json({ error: 'No audio URL found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
