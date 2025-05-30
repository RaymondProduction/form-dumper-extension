let allFieldsData = []; // Store all field data for search
let favoriteFields = []; // Store favorite field keys

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
      
      // Restore saved keys and favorites
      const saved = localStorage.getItem('formDumperSelectedKeys');
      const savedKeys = saved ? JSON.parse(saved) : [];
      
      const savedFavorites = localStorage.getItem('formDumperFavoriteKeys');
      favoriteFields = savedFavorites ? JSON.parse(savedFavorites) : [];
      
      // Apply saved selections to field data
      allFieldsData.forEach(field => {
        field.selected = savedKeys.includes(field.key);
        field.favorite = favoriteFields.includes(field.key);
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
    container.style.cssText = `border: 1px solid #ddd; padding: 8px; margin: 5px 0; border-radius: 4px; background: ${field.favorite ? '#fff3cd' : '#f9f9f9'};`;
    
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;';
    
    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display: flex; align-items: center; flex: 1;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'field';
    checkbox.value = field.key;
    checkbox.checked = field.selected;
    checkbox.style.cssText = 'margin-right: 8px;';
    
    // Update field selection when checkbox changes
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation(); // Prevent event bubbling
      field.selected = checkbox.checked;
    });
    
    // Prevent checkbox click from bubbling to container
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    const fieldName = document.createElement('strong');
    fieldName.textContent = field.key;
    fieldName.style.cssText = 'margin-right: 8px;';
    
    const fieldType = document.createElement('small');
    fieldType.textContent = `(${field.element}${field.type !== 'text' ? ', ' + field.type : ''})`;
    fieldType.style.cssText = 'color: #666;';
    
    leftSide.appendChild(checkbox);
    leftSide.appendChild(fieldName);
    leftSide.appendChild(fieldType);
    
    // Star button
    const starButton = document.createElement('button');
    starButton.innerHTML = field.favorite ? '⭐' : '☆';
    starButton.title = field.favorite ? 'Remove from favorites' : 'Add to favorites';
    starButton.style.cssText = 'background: none; border: none; font-size: 16px; cursor: pointer; padding: 2px 6px; margin-left: 8px; color: #f39c12;';
    
    starButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(field, starButton, container);
    });
    
    topRow.appendChild(leftSide);
    topRow.appendChild(starButton);
    
    container.appendChild(topRow);
    
    // Field value (if exists)
    if (field.value) {
      const fieldValue = document.createElement('div');
      fieldValue.style.cssText = 'margin-top: 4px; font-size: 12px; color: #555; max-height: 40px; overflow: hidden; padding-left: 24px;';
      fieldValue.textContent = field.value.substring(0, 100) + (field.value.length > 100 ? '...' : '');
      container.appendChild(fieldValue);
    }
    
    // Make the whole container clickable (except star button and checkbox)
    container.addEventListener('click', (e) => {
      if (e.target !== starButton && e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        field.selected = checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    
    fieldList.appendChild(container);
  });
}

function toggleFavorite(field, starButton, container) {
  field.favorite = !field.favorite;
  starButton.innerHTML = field.favorite ? '⭐' : '☆';
  starButton.title = field.favorite ? 'Remove from favorites' : 'Add to favorites';
  container.style.background = field.favorite ? '#fff3cd' : '#f9f9f9';
  
  // Update favorites list
  if (field.favorite) {
    if (!favoriteFields.includes(field.key)) {
      favoriteFields.push(field.key);
    }
  } else {
    favoriteFields = favoriteFields.filter(key => key !== field.key);
  }
  
  // Save to localStorage
  localStorage.setItem('formDumperFavoriteKeys', JSON.stringify(favoriteFields));
  console.log('Favorites updated:', favoriteFields);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase().trim();
  const showFavoritesBtn = document.getElementById('showFavorites');
  const showingFavoritesOnly = showFavoritesBtn.textContent.includes('Show All');
  
  // Determine base fields to search in
  const baseFields = showingFavoritesOnly ? 
    allFieldsData.filter(field => field.favorite) : 
    allFieldsData;
  
  if (!searchTerm) {
    renderFields(baseFields);
    updateSearchResults(baseFields);
    return;
  }
  
  const filteredFields = baseFields.filter(field => {
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

// Select All Fields button (all fields, not just visible)
document.getElementById('selectAll').addEventListener('click', () => {
  allFieldsData.forEach(field => {
    field.selected = true;
  });
  // Update visible checkboxes
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => cb.checked = true);
});

// Deselect All Fields button (all fields, not just visible)
document.getElementById('deselectAll').addEventListener('click', () => {
  allFieldsData.forEach(field => {
    field.selected = false;
  });
  // Update visible checkboxes
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => cb.checked = false);
});

// Select only currently visible/found fields
document.getElementById('selectVisible').addEventListener('click', () => {
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => {
    cb.checked = true;
    // Update the corresponding field data
    const field = allFieldsData.find(f => f.key === cb.value);
    if (field) field.selected = true;
  });
});

// Deselect only currently visible/found fields
document.getElementById('deselectVisible').addEventListener('click', () => {
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => {
    cb.checked = false;
    // Update the corresponding field data
    const field = allFieldsData.find(f => f.key === cb.value);
    if (field) field.selected = false;
  });
});

// Show Favorites button
document.getElementById('showFavorites').addEventListener('click', () => {
  const showFavoritesBtn = document.getElementById('showFavorites');
  const searchInput = document.getElementById('searchInput');
  
  if (showFavoritesBtn.textContent.includes('Show Favorites')) {
    // Show only favorites
    const favoriteFieldsData = allFieldsData.filter(field => field.favorite);
    renderFields(favoriteFieldsData);
    updateSearchResults(favoriteFieldsData);
    showFavoritesBtn.innerHTML = '📋 Show All';
    searchInput.value = '';
    searchInput.placeholder = '🔍 Search in favorites...';
  } else {
    // Show all fields
    renderFields(allFieldsData);
    updateSearchResults(allFieldsData);
    showFavoritesBtn.innerHTML = '⭐ Show Favorites';
    searchInput.placeholder = '🔍 Search by field name or value...';
  }
});

// Select Favorites button
document.getElementById('selectFavorites').addEventListener('click', () => {
  // First update the data
  allFieldsData.forEach(field => {
    if (field.favorite) {
      field.selected = true;
    }
  });
  
  // Then update all visible checkboxes
  const visibleCheckboxes = document.querySelectorAll('input[name="field"]');
  visibleCheckboxes.forEach(cb => {
    const field = allFieldsData.find(f => f.key === cb.value);
    if (field && field.favorite) {
      cb.checked = true;
    }
  });
  
  console.log('Selected favorites:', allFieldsData.filter(f => f.favorite && f.selected).map(f => f.key));
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