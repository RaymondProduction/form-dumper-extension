document.getElementById('scan').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const elements = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]'));
        return elements.map((el, i) => {
          const key =
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            el.name ||
            el.className ||
            `element-${i}`;
          return key.trim();
        });
      }
    }, (results) => {
      // Normalize all keys by trimming whitespace before de-duplicating.
      // This ensures that visually identical keys like "prompt", " prompt", and "prompt "
      // are treated as the same entry and appear only once in the selection list.
      // Using Set guarantees uniqueness in the list of scanned fields.
      const keys = [...new Set(results[0].result.map(key => key.trim()))];
      const fieldList = document.getElementById('fieldList');
      fieldList.innerHTML = '';

      // Restore saved keys
      const saved = localStorage.getItem('formDumperSelectedKeys');
      const savedKeys = saved ? JSON.parse(saved) : [];

      keys.forEach((key) => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'field';
        checkbox.value = key;
        checkbox.checked = savedKeys.includes(key); // restore selection
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + key));
        fieldList.appendChild(label);
        fieldList.appendChild(document.createElement('br'));
      });

      document.getElementById('fieldListControls').style.display = 'block';
      document.getElementById('export').style.display = 'inline-block';
    });
  });
});

// Select All button
document.getElementById('selectAll').addEventListener('click', () => {
  document.querySelectorAll('input[name="field"]').forEach(cb => cb.checked = true);
});

// Deselect All button
document.getElementById('deselectAll').addEventListener('click', () => {
  document.querySelectorAll('input[name="field"]').forEach(cb => cb.checked = false);
});

// Export logic (same as before)
document.getElementById('export').addEventListener('click', () => {
  const selectedKeys = Array.from(document.querySelectorAll('input[name="field"]:checked')).map(cb => cb.value);
  // Save selected keys
  localStorage.setItem('formDumperSelectedKeys', JSON.stringify(selectedKeys));

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [selectedKeys],
      func: (selected) => {
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
          if (value && key && selected.includes(key.trim())) {
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

// Import (same as before, with input event dispatching for Gradio)
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
              // Gradio-based UIs (like AUTOMATIC1111) do not react to direct value assignments.
              // To trigger reactivity in Svelte, we must dispatch an 'input' event after updating the value.
              // This ensures the interface properly registers the change, as if the user typed it manually.
              if (el.tagName === 'DIV' && el.isContentEditable) {
                el.innerText = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          });
        }
      });
    });
  };
  reader.readAsText(file);
});
