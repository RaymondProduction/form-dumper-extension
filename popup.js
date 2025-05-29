document.getElementById('export').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // This script is designed to work with Gradio-based UIs like AUTOMATIC1111's WebUI.
        // Gradio often uses custom elements such as <div contenteditable="true"> instead of standard <textarea> or <input>,
        // and those elements may lack traditional identifiers like id or name.
        // To handle this, we collect all input-like elements, including contenteditable divs,
        // and use attributes like aria-label, placeholder, or className as keys for identifying them in the export/import process.
        // This makes the extension compatible with dynamic UIs and supports prompt/negative prompt editing.
        const elements = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]'));
        const data = {};

        elements.forEach((el, i) => {
          const key =
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            el.name ||
            el.className ||
            `element-${i}`;

          const value = el.tagName === 'DIV' && el.isContentEditable ? el.innerText : el.value;
          if (value && key) {
            data[key.trim()] = value;
          }
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
        func: (formData) => {
          const elements = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]'));

          elements.forEach((el) => {
            const key =
              el.getAttribute('aria-label') ||
              el.getAttribute('placeholder') ||
              el.name ||
              el.className;

            const value = formData[key?.trim()];
            if (value !== undefined) {
              if (el.tagName === 'DIV' && el.isContentEditable) {
                el.innerText = value;
              } else {
                el.value = value;
              }
            }
          });
        }
      });
    });
  };
  reader.readAsText(file);
});
