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
        
        // ✅ Skip if trackName looks like duration or file size
        if (trackName && downloadUrl && 
            !trackName.includes('Track') && 
            !trackName.match(/^\d+:\d+$/) && // Skip durations like "1:11"
            !trackName.match(/^\d+\.\d+\s*MB$/) && // Skip file sizes like "1.08 MB"
            !trackName.includes('get_app') && // Skip download buttons
            trackName.length > 3) { // Skip very short names like "11"
          
          tracks.push({
            name: trackName,
            downloadPage: `https://downloads.khinsider.com${downloadUrl}`
          });
        }
      }
    });

    console.log(`Found ${tracks.length} valid tracks, getting first audio URL...`);

    // ✅ Only get the first track's audio URL
    if (tracks.length > 0) {
      const firstTrack = tracks[0];
      try {
        console.log(`Getting audio URL for: ${firstTrack.name}`);
        const downloadPageHtml = await fetch(firstTrack.downloadPage).then(r => r.text());
        const $download = cheerio.load(downloadPageHtml);
        
        // Look for direct audio file links
        const audioUrl = $download('a[href*=".mp3"], a[href*=".ogg"], a[href*=".wav"]').first().attr('href');
        
        if (audioUrl) {
          const audioTracks = [{
            name: firstTrack.name,
            url: `https://downloads.khinsider.com${audioUrl}`
          }];
          
          console.log(`✅ Found audio URL for ${firstTrack.name}: ${audioUrl}`);
          res.json({ tracks: audioTracks });
        } else {
          console.log(`❌ No audio URL found for ${firstTrack.name}`);
          res.status(404).json({ error: 'No audio URL found' });
        }
      } catch (err) {
        console.log(`Failed to get audio URL for ${firstTrack.name}: ${err.message}`);
        res.status(500).json({ error: 'Failed to get audio URL' });
      }
    } else {
      console.log('No valid tracks found');
      res.status(404).json({ error: 'No valid tracks found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
