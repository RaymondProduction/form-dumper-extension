let allFieldsData = []; // Store all field data for search

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
          
          const value = el.tagName === 'DIV' && el.isContentEditable ? el.innerText : el.value;
          
          return {
            key: key.trim(),
            value: value || '',
            element: el.tagName,
            type: el.type || 'text'
          };
        });
      }
    }, (results) => {
      // Store all fields data
      allFieldsData = results[0].result;
      
      // Remove duplicates by key
      const uniqueFields = [];
      const seenKeys = new Set();
      
      allFieldsData.forEach(field => {
        if (!seenKeys.has(field.key)) {
          seenKeys.add(field.key);
          uniqueFields.push(field);
        }
      });
      
      allFieldsData = uniqueFields;
      
      // Restore saved keys
      const saved = localStorage.getItem('formDumperSelectedKeys');
      const savedKeys = saved ? JSON.parse(saved) : [];
      
      // Apply saved selections to field data
      allFieldsData.forEach(field => {
        field.selected = savedKeys.includes(field.key);
      });

      renderFields(allFieldsData);
      document.getElementById('searchContainer').style.display = 'block';
      document.getElementById('fieldListControls').style.display = 'block';
      document.getElementById('export').style.display = 'inline-block';
      updateSearchResults(allFieldsData);
    });
  });
});

function renderFields(fieldsToRender) {
  const fieldList = document.getElementById('fieldList');
  fieldList.innerHTML = '';

  fieldsToRender.forEach((field, index) => {
    const container = document.createElement('div');
    container.className = 'field-item';
    container.style.cssText = 'border: 1px solid #ddd; padding: 8px; margin: 5px 0; border-radius: 4px; background: #f9f9f9;';
    
    const label = document.createElement('label');
    label.style.cssText = 'display: block; cursor: pointer;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'field';
    checkbox.value = field.key;
    checkbox.checked = field.selected;
    checkbox.style.cssText = 'margin-right: 8px;';
    
    // Update field selection when checkbox changes
    checkbox.addEventListener('change', () => {
      field.selected = checkbox.checked;
    });
    
    const fieldInfo = document.createElement('div');
    fieldInfo.innerHTML = `
      <strong>${field.key}</strong> 
      <small style="color: #666;">(${field.element}${field.type !== 'text' ? ', ' + field.type : ''})</small>
      ${field.value ? `<div style="margin-top: 4px; font-size: 12px; color: #555; max-height: 40px; overflow: hidden;">${escapeHtml(field.value.substring(0, 100))}${field.value.length > 100 ? '...' : ''}</div>` : ''}
    `;
    
    label.appendChild(checkbox);
    label.appendChild(fieldInfo);
    container.appendChild(label);
    fieldList.appendChild(container);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase().trim();
  
  if (!searchTerm) {
    renderFields(allFieldsData);
    updateSearchResults(allFieldsData);
    return;
  }
  
  const filteredFields = allFieldsData.filter(field => {
    return field.key.toLowerCase().includes(searchTerm) || 
           field.value.toLowerCase().includes(searchTerm);
  });
  
  renderFields(filteredFields);
  updateSearchResults(filteredFields);
});

function updateSearchResults(fields) {
  const searchResults = document.getElementById('searchResults');
  const count = fields.length;
  searchResults.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
}

// Select All button
document.getElementById('selectAll').addEventListener('click', () => {
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => {
    cb.checked = true;
    // Update the corresponding field data
    const field = allFieldsData.find(f => f.key === cb.value);
    if (field) field.selected = true;
  });
});

// Deselect All button
document.getElementById('deselectAll').addEventListener('click', () => {
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => {
    cb.checked = false;
    // Update the corresponding field data
    const field = allFieldsData.find(f => f.key === cb.value);
    if (field) field.selected = false;
  });
});

// Select Visible button
document.getElementById('selectVisible').addEventListener('click', () => {
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => {
    cb.checked = true;
    // Update the corresponding field data
    const field = allFieldsData.find(f => f.key === cb.value);
    if (field) field.selected = true;
  });
});

// Export logic
document.getElementById('export').addEventListener('click', () => {
  const selectedKeys = allFieldsData.filter(field => field.selected).map(field => field.key);
  
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

// Import functionality
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