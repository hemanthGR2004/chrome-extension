function loadWhitelist() {
  chrome.storage.sync.get(['whitelist'], (result) => {
    const whitelist = result.whitelist || [];
    const ul = document.getElementById('whitelist');
    ul.innerHTML = '';
    whitelist.forEach(domain => {
      const li = document.createElement('li');
      li.textContent = domain;
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.onclick = () => removeDomain(domain);
      li.appendChild(removeButton);
      ul.appendChild(li);
    });
  });
}

function addDomain() {
  const input = document.getElementById('domainInput');
  const domain = input.value.trim();
  if (domain) {
    chrome.storage.sync.get(['whitelist'], (result) => {
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        chrome.runtime.sendMessage({ action: 'updateWhitelist', whitelist }, (response) => {
          loadWhitelist();
          input.value = '';
        });
      }
    });
  }
}

function removeDomain(domain) {
  chrome.storage.sync.get(['whitelist'], (result) => {
    const whitelist = result.whitelist || [];
    const updatedWhitelist = whitelist.filter(d => d !== domain);
    chrome.runtime.sendMessage({ action: 'updateWhitelist', whitelist: updatedWhitelist }, (response) => {
      loadWhitelist();
    });
  });
}

function loadHistory() {
  chrome.storage.sync.get(['downloadHistory'], (result) => {
    const history = result.downloadHistory || [];
    const table = document.getElementById('historyTable');
    while (table.rows.length > 1) table.deleteRow(1);
    history.forEach(entry => {
      const row = table.insertRow();
      row.insertCell().textContent = entry.filename;
      row.insertCell().textContent = entry.url;
      row.insertCell().textContent = entry.timestamp;
      row.insertCell().textContent = entry.dangerous ? 'Yes' : 'No';
    });
  });
}

window.onload = () => {
  loadWhitelist();
  loadHistory();
};