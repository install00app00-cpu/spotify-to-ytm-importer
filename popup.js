let selectedFiles = [];
let tracks = [];
const CHECKBOX_KEY = 'selectedPlaylists';

document.addEventListener('DOMContentLoaded', async () => {
  const fileInput = document.getElementById('fileInput');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  const fileList = document.getElementById('fileList');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const openYTM = document.getElementById('openYTM');
  const importBtn = document.getElementById('importBtn');
  const status = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');

  async function loadSavedFiles() {
    const result = await chrome.storage.local.get(['savedFiles', CHECKBOX_KEY]);
    if (result.savedFiles && result.savedFiles.length > 0) {
      selectedFiles = result.savedFiles;
      fileList.innerHTML = '';
      
      const savedCheckboxes = result[CHECKBOX_KEY] || {};
      
      for (const file of selectedFiles) {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
          <input type="checkbox" ${savedCheckboxes[file.name] !== false ? 'checked' : ''} data-filename="${file.name}">
          <span>${file.name.replace('.csv', '')}</span>
        `;
        fileList.appendChild(label);
      }

      step2.classList.remove('hidden');
      step3.classList.remove('hidden');
      showStatus(`Loaded ${selectedFiles.length} files from last session.`, 'info');
    }
  }

  await loadSavedFiles();

  selectFilesBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    selectedFiles = files;
    fileList.innerHTML = '';
    
    for (const file of files) {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      label.innerHTML = `
        <input type="checkbox" checked data-filename="${file.name}">
        <span>${file.name.replace('.csv', '')}</span>
      `;
      fileList.appendChild(label);
    }

    await chrome.storage.local.set({ savedFiles: selectedFiles });
    
    step2.classList.remove('hidden');
    step3.classList.remove('hidden');
    showStatus(`Loaded ${files.length} playlists.`, 'success');
  });

  fileList.addEventListener('change', async () => {
    const checkboxes = {};
    fileList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      checkboxes[cb.dataset.filename] = cb.checked;
    });
    await chrome.storage.local.set({ [CHECKBOX_KEY]: checkboxes });
  });

  openYTM.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://music.youtube.com' });
    showStatus('Open YouTube Music, then click Start Import.', 'info');
  });

  importBtn.addEventListener('click', async () => {
    const selectedCheckboxes = fileList.querySelectorAll('input:checked');
    const selectedFileNames = Array.from(selectedCheckboxes).map(cb => cb.dataset.filename);
    
    if (selectedFileNames.length === 0) {
      showStatus('Select at least one playlist!', 'error');
      return;
    }

    importBtn.disabled = true;
    progressBar.classList.add('active');
    showStatus('Reading CSV files...', 'info');

    try {
      tracks = [];
      
      for (const fileName of selectedFileNames) {
        const file = selectedFiles.find(f => f.name === fileName);
        if (!file) continue;
        
        const text = await file.text();
        const parsedTracks = parseCSV(text, file.name.replace('.csv', ''));
        tracks.push(...parsedTracks);
      }

      showStatus(`Found ${tracks.length} tracks. Starting import...`, 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('music.youtube.com')) {
        showStatus('Open YouTube Music tab first!', 'error');
        importBtn.disabled = false;
        return;
      }

      await processImport(tab.id);
      
      showStatus(`Done! Imported ${tracks.length} tracks.`, 'success');
    } catch (err) {
      console.error(err);
      showStatus('Error: ' + err.message, 'error');
    }

    importBtn.disabled = false;
    progressBar.classList.remove('active');
  });

  function parseCSV(text, playlistName) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const trackIdx = headers.findIndex(h => h.includes('track name'));
    const artistIdx = headers.findIndex(h => h.includes('artist'));
    const albumIdx = headers.findIndex(h => h.includes('album'));

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length <= Math.max(trackIdx, artistIdx)) continue;

      result.push({
        name: cols[trackIdx]?.trim() || '',
        artist: cols[artistIdx]?.trim() || '',
        album: albumIdx >= 0 ? cols[albumIdx]?.trim() || '' : '',
        playlist: playlistName
      });
    }
    return result;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  async function processImport(tabId) {
    const total = tracks.length;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const progress = Math.round((i / total) * 100);
      progressFill.style.width = progress + '%';

      try {
        const result = await chrome.tabs.sendMessage(tabId, {
          action: 'searchAndAdd',
          query: `${track.name} ${track.artist}`,
          trackName: track.name,
          artist: track.artist
        });

        if (result.success) {
          imported++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }

      await new Promise(r => setTimeout(r, 800));
    }

    showStatus(`Done! Imported: ${imported}, Failed: ${failed}`, imported > 0 ? 'success' : 'error');
  }

  function showStatus(msg, type) {
    status.textContent = msg;
    status.className = 'status ' + type;
  }
});
