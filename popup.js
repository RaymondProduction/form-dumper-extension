document.getElementById('export').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const data = {};
        const elements = document.querySelectorAll('input, textarea');

        elements.forEach(el => {
          let key = el.id || el.name || el.className || el.tagName + '-' + Math.random().toString(36).substr(2, 5);
          data[key] = el.value;
        });

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'form-data.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  });
});

document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const jsonData = JSON.parse(reader.result);
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [jsonData],
        function: (formData) => {
          const elements = document.querySelectorAll('input, textarea');
          elements.forEach(el => {
            let key = el.id || el.name || el.className;
            if (formData[key]) {
              el.value = formData[key];
            }
          });
        }
      });
    });
  };
  reader.readAsText(file);
});
