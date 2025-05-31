const DEFAULT_WHITELIST = [
  'microsoft.com',
  'adobe.com',
  'mozilla.org',
  'google.com',
  'apple.com',
  'oracle.com',
  'python.org',
  'github.com'
];

const DANGEROUS_EXTS = [
  '.exe', '.msi', '.bat', '.cmd', '.vbs', '.js', '.jar', '.scr',
  '.dll', '.pif', '.com', '.ps1', '.reg', '.vb', '.vbe', '.wsf',
  '.zip', '.rar', '.7z', '.iso'
];

const SUSPICIOUS_URL_PATTERNS = [
  /bit\.ly/, /tinyurl\.com/, /free\.host/, /download\d*\./, /[\w-]{10,}\.top/,
  /\.xyz$/, /\.info$/, /cloud\d*\./, /share\d*\./
];

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed, initializing storage...');
  chrome.storage.sync.get(['whitelist'], (result) => {
    const existingWhitelist = result.whitelist || [];
    const mergedWhitelist = [...new Set([...DEFAULT_WHITELIST, ...existingWhitelist])];
    chrome.storage.sync.set({ whitelist: mergedWhitelist }, () => {
      console.log('Whitelist initialized:', mergedWhitelist);
    });
  });
  chrome.storage.sync.set({ downloadHistory: [] }, () => {
    console.log('Download history initialized as empty array.');
  });
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('Download started:', downloadItem);

  const filename = downloadItem.filename.toLowerCase();
  console.log('Filename (lowercase):', filename);
  const isDangerousExt = DANGEROUS_EXTS.some(ext => filename.endsWith(ext));
  console.log('Is dangerous extension:', isDangerousExt);

  let domain = '';
  try {
    const url = new URL(downloadItem.url);
    domain = url.hostname;
    console.log('Extracted domain:', domain);
  } catch (e) {
    console.error('Invalid URL:', downloadItem.url, e);
    return;
  }

  chrome.storage.sync.get(['whitelist', 'downloadHistory'], (result) => {
    console.log('Storage data retrieved:', result);

    // Log download attempt
    const history = result.downloadHistory || [];
    history.push({
      filename: downloadItem.filename,
      url: downloadItem.url,
      timestamp: new Date().toISOString(),
      dangerous: isDangerousExt
    });
    chrome.storage.sync.set({ downloadHistory: history.slice(-100) }, () => {
      console.log('Download history updated:', history.slice(-100));
    });

    // Calculate risk score
    let riskScore = 0;
    const riskReasons = [];

    if (isDangerousExt) {
      riskScore += 20;
      riskReasons.push('File type is potentially dangerous');
    }

    const whitelist = result.whitelist || DEFAULT_WHITELIST;
    console.log('Whitelist:', whitelist);
    if (!whitelist.includes(domain)) {
      riskScore += 30;
      riskReasons.push('Domain is not in your trusted list');
    }

    const isSuspiciousUrl = SUSPICIOUS_URL_PATTERNS.some(pattern => pattern.test(downloadItem.url));
    console.log('Is suspicious URL:', isSuspiciousUrl);
    if (isSuspiciousUrl) {
      riskScore += 20;
      riskReasons.push('URL matches a suspicious pattern');
    }

    if (downloadItem.fileSize > 0 && downloadItem.fileSize < 100000) {
      riskScore += 20;
      riskReasons.push('File size is unusually small');
    }
    console.log('File size:', downloadItem.fileSize);

    const similarDownloads = history.filter(entry => entry.url.includes(domain) && !entry.dangerous).length;
    console.log('Similar safe downloads from domain:', similarDownloads);
    if (similarDownloads > 2) {
      riskScore -= 20;
      riskReasons.push('Domain frequently used for safe downloads');
    }

    console.log('Final risk score:', riskScore, 'Reasons:', riskReasons);
    if (riskScore >= 50) {
      console.log('Pausing download due to high risk score...');
      chrome.downloads.pause({ id: downloadItem.id }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error pausing download:', chrome.runtime.lastError.message);
          return;
        }

        console.log('Creating notification for download:', downloadItem.id);
        chrome.notifications.create(`download-${downloadItem.id}`, {
          type: 'basic',
          iconUrl: 'icon128.png',
          title: '⚠️ Potentially Dangerous Download',
          message: `The file "${downloadItem.filename}" from ${domain} scored ${riskScore}/100 for risk. Reasons:\n- ${riskReasons.join('\n- ')}\nAllow it?`,
          buttons: ['Allow Download', 'Cancel Download'],
          priority: 2,
          requireInteraction: true
        }, () => {
          console.log('Notification created for download:', downloadItem.id);
        });
      });
    } else {
      console.log('Risk score too low to pause:', riskScore);
    }
  });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  console.log('Notification button clicked:', notificationId, 'Button:', buttonIndex);
  const downloadId = parseInt(notificationId.replace('download-', ''));
  if (buttonIndex === 0) {
    chrome.downloads.resume({ id: downloadId }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error resuming download:', chrome.runtime.lastError.message);
      }
      chrome.notifications.clear(notificationId);
    });
  } else if (buttonIndex === 1) {
    chrome.downloads.cancel({ id: downloadId }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error cancelling download:', chrome.runtime.lastError.message);
      }
      chrome.notifications.clear(notificationId);
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  if (request.action === 'updateWhitelist') {
    chrome.storage.sync.set({ whitelist: request.whitelist }, () => {
      console.log('Whitelist updated:', request.whitelist);
      sendResponse({ status: 'Whitelist updated' });
    });
    return true;
  }
});