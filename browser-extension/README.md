# Aipply Autofill (dev/beta build)

An unpacked Chrome extension that fills application forms from data you
export out of Aipply. Not published to the Chrome Web Store - load it
manually for the demo.

## How it works

1. In Aipply, go to **Submit** and click **"Copy my data for the plugin"**.
   This copies a small JSON object of your Profile/Colleges/Essay data to
   your clipboard.
2. Load this extension in Chrome (see below), open its popup, paste the
   data in, and click **Save data**. It's stored locally in the extension
   (`chrome.storage.local`) - nothing is sent anywhere else.
3. On any application page (e.g. `https://apply.commonapp.org`), open the
   extension popup and click **Fill this page**.

## How the autofill actually works (read this before demoing)

This extension does **not** know Common App's specific field names or DOM
structure - nobody outside Common App has reliably documented that, and it
changes over time. Instead, it does **generic label matching**: for every
visible, empty input/textarea/select on the page, it looks at the field's
`<label>`, `aria-label`, `placeholder`, and nearby text, normalizes it, and
fuzzy-matches it against your exported field names (`First Name`, `GPA`,
`SAT Score`, etc.). If it finds a good match, it fills the field the same
way a real user typing would (dispatches proper `input`/`change` events so
React-controlled forms pick up the change).

This is a legitimate, real autofill technique - it's part of how tools like
password managers and job-application autofillers work - but it is **not
guaranteed to hit every question** on any given site. Accuracy depends
entirely on how that site labels its fields.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `browser-extension/` folder.
4. Pin the extension icon for quick access.

## Files

- `manifest.json` - Manifest V3 config
- `popup.html` / `popup.js` / `popup.css` - the import/fill UI
- `content.js` - the label-matching autofill logic, injected on every page
- `icons/` - placeholder icon set
