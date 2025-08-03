const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Store current game and track info
let currentGame = null;
let currentTrackIndex = 0;
let allTracks = [];

app.get('/ping', (req, res) => {
  res.json({ status: 'Proxy is alive ✅' });
});

app.get('/ost', async (req, res) => {
  const game = req.query.game;
  if (!game) return res.status(400).json({ error: 'No game provided' });

  try {
    // If it's a new game, reset track index and fetch all tracks
    if (currentGame !== game) {
      console.log(`New game selected: ${game}`);
      currentGame = game;
      currentTrackIndex = 0;
      allTracks = [];
      
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

      // ✅ Look for download links in the songlist table
      $album('.songlist tr').each((index, element) => {
        const $row = $album(element);
        const $nameCell = $row.find('td:first-child');
        const $downloadCell = $row.find('td:last-child a');
        
        if ($nameCell.length && $downloadCell.length) {
          const trackName = $nameCell.text().trim();
          const downloadUrl = $downloadCell.attr('href');
          
          if (trackName && downloadUrl && !trackName.includes('Track')) {
            allTracks.push({
              name: trackName,
              downloadPage: `https://downloads.khinsider.com${downloadUrl}`
            });
          }
        }
      });

      console.log(`Found ${allTracks.length} tracks for ${game}`);
    }

    // Get the current track's audio URL
    if (allTracks.length > currentTrackIndex) {
      const selectedTrack = allTracks[currentTrackIndex];
      try {
        console.log(`Getting audio URL for: ${selectedTrack.name} (Track ${currentTrackIndex + 1}/${allTracks.length})`);
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
            trackIndex: currentTrackIndex,
            totalTracks: allTracks.length
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
      console.log(`Track index ${currentTrackIndex} out of range (0-${allTracks.length - 1})`);
      res.status(404).json({ error: 'Track index out of range' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// New endpoint to get the next track
app.get('/next-track', async (req, res) => {
  if (!currentGame) {
    return res.status(400).json({ error: 'No game currently selected' });
  }

  // Move to next track
  currentTrackIndex++;
  
  // Loop back to first track if we've reached the end
  if (currentTrackIndex >= allTracks.length) {
    currentTrackIndex = 0;
    console.log(`Looping back to first track for ${currentGame}`);
  }

  console.log(`Getting next track: ${currentTrackIndex + 1}/${allTracks.length}`);
  
  // Get the next track's audio URL
  const selectedTrack = allTracks[currentTrackIndex];
  try {
    const downloadPageHtml = await fetch(selectedTrack.downloadPage).then(r => r.text());
    const $download = cheerio.load(downloadPageHtml);
    
    const audioUrl = $download('a[href*=".mp3"], a[href*=".ogg"], a[href*=".wav"]').first().attr('href');
    
    if (audioUrl) {
      const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `https://downloads.khinsider.com${audioUrl}`;
      console.log(`✅ Found next track: ${selectedTrack.name}`);
      
      const audioTracks = [{
        name: selectedTrack.name,
        url: fullAudioUrl,
        trackIndex: currentTrackIndex,
        totalTracks: allTracks.length
      }];
      
      res.json({ tracks: audioTracks });
    } else {
      console.log(`❌ No audio URL found for next track: ${selectedTrack.name}`);
      res.status(404).json({ error: 'No audio URL found for next track' });
    }
  } catch (err) {
    console.log(`Failed to get next track: ${err.message}`);
    res.status(500).json({ error: 'Failed to get next track' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
