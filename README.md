# 📝 Form Dumper Extension for Chrome

This Chrome Extension allows you to export and import all form field values (`<input>` and `<textarea>`) from any web page as a structured JSON file.

- ✅ Export form data to JSON
- ✅ Import data back into the form
- ✅ Uses element `id`, `name`, or `class` as identifiers
- ✅ Runs directly from the popup

---

## 📦 Features

- **Export Form Data:** Collects all visible input and textarea fields and saves their values in a downloadable JSON file.
- **Import Form Data:** Load a previously exported JSON file and auto-fill the form fields with matching keys.

---

## 🛠 Installation (Developer Mode)

1. Clone or download this repository and unzip it.
2. Open Google Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **"Load unpacked"**.
5. Select the `form-dumper-extension` directory.

---

## 📋 How It Works

### Export
- Click the 📤 **Export** button in the popup.
- A JSON file (e.g., `form-data.json`) will be downloaded.
- Each key represents a field identifier (id, name, or class), and value is the form content.

### Import
- Click the 📥 **Import JSON** area and choose a previously exported JSON file.
- Matching fields will be automatically populated.

---

## 📁 File Structure


```
form-dumper-extension/
├── manifest.json
├── popup.html
├── popup.js
├── style.css
├── icon.png (optional)
```


---

## 🧠 Notes

- If a form element has no `id`, `name`, or `class`, a random identifier is used in the export file.
- This extension does **not** store or send any data externally.
- Intended for developers, testers, and automation workflows.

---

## 💡 Future Ideas

- Add support for `<select>` and `<checkbox>` fields
- Add editable form preview before importing
- Support custom selectors or XPath fallback

---
# form-dumper-extension
