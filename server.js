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
  const trackIndex = parseInt(req.query.track || '0'); // Get track index from query
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

    console.log(`Found ${tracks.length} tracks, getting track ${trackIndex}...`);

    // ✅ Get the specified track's audio URL
    if (tracks.length > trackIndex) {
      const selectedTrack = tracks[trackIndex];
      try {
        console.log(`Getting audio URL for: ${selectedTrack.name} (Track ${trackIndex + 1}/${tracks.length})`);
        const downloadPageHtml = await fetch(selectedTrack.downloadPage).then(r => r.text());
        const $download = cheerio.load(downloadPageHtml);
        
        // Look for direct audio file links
        const audioUrl = $download('a[href*=".mp3"], a[href*=".ogg"], a[href*=".wav"]').first().attr('href');
        
        if (audioUrl) {
          const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `https://downloads.khinsider.com${audioUrl}`;
          console.log(`✅ Found audio URL for ${selectedTrack.name}: ${fullAudioUrl}`);
          
          const audioTracks = [{
            name: selectedTrack.name,
            url: fullAudioUrl,
            trackIndex: trackIndex,
            totalTracks: tracks.length,
            nextTrackIndex: trackIndex + 1 < tracks.length ? trackIndex + 1 : 0 // Loop back to first track
          }];
          
          res.json({ tracks: audioTracks });
        } else {
          console.log(`❌ No audio URL found for ${selectedTrack.name}`);
          res.status(404).json({ error: 'No audio URL found' });
        }
      } catch (err) {
        console.log(`Failed to get audio URL for ${selectedTrack.name}: ${err.message}`);
        res.status(500).json({ error: 'Failed to get audio URL' });
      }
    } else {
      console.log(`Track index ${trackIndex} out of range (0-${tracks.length - 1})`);
      res.status(404).json({ error: 'Track index out of range' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
