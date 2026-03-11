// Content script for YouTube Music

let isReady = false;
let queue = [];
let isProcessing = false;

function waitForYTM() {
  return new Promise((resolve) => {
    if (document.querySelector('ytmusic-search-box') || document.querySelector('.ytmusic-search-box')) {
      resolve();
      return;
    }
    
    const observer = new MutationObserver(() => {
      if (document.querySelector('ytmusic-search-box') || document.querySelector('.ytmusic-search-box')) {
        observer.disconnect();
        resolve();
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => resolve(), 5000);
  });
}

async function searchTrack(query) {
  await waitForYTM();
  
  const searchBox = document.querySelector('ytmusic-search-box') || document.querySelector('.ytmusic-search-box');
  if (!searchBox) {
    return { success: false, error: 'Search box not found' };
  }

  const input = searchBox.querySelector('input') || searchBox.querySelector('#input');
  if (!input) {
    return { success: false, error: 'Search input not found' };
  }

  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  await new Promise(r => setTimeout(r, 500));
  
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  });
  input.dispatchEvent(enterEvent);

  await new Promise(r => setTimeout(r, 2000));

  const firstResult = document.querySelector('ytmusic-responsive-list-item-renderer') || 
                     document.querySelector('.ytmusic-responsive-list-item-renderer');
  
  if (!firstResult) {
    return { success: false, error: 'No results found' };
  }

  const playButton = firstResult.querySelector('play-button') || 
                     firstResult.querySelector('.play-button') ||
                     firstResult.querySelector('[icon="play-arrow"]');
  
  if (playButton) {
    playButton.click();
    return { success: true };
  }

  return { success: false, error: 'Could not play track' };
}

async function addToPlaylist(trackName, artist) {
  await new Promise(r => setTimeout(r, 1000));
  
  const menuItems = document.querySelectorAll('ytmusic-menu-renderer .menu-item');
  
  for (const item of menuItems) {
    const text = item.textContent.toLowerCase();
    if (text.includes('add to playlist') || text.includes('добавить в плейлист')) {
      item.click();
      await new Promise(r => setTimeout(r, 500));
      
      const playlistItems = document.querySelectorAll('ytmusic-playlist-add-to-option-renderer');
      if (playlistItems.length > 0) {
        playlistItems[0].click();
        return { success: true };
      }
    }
  }
  
  return { success: false, error: 'Could not find add to playlist option' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'searchAndAdd') {
    searchTrack(message.query)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

console.log('🎵 Spotify to YTM content script loaded');
