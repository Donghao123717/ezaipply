const importView = document.getElementById('import-view')
const readyView = document.getElementById('ready-view')
const textarea = document.getElementById('import-textarea')
const saveBtn = document.getElementById('save-btn')
const importError = document.getElementById('import-error')
const fieldCount = document.getElementById('field-count')
const fieldPreview = document.getElementById('field-preview')
const fillBtn = document.getElementById('fill-btn')
const fillStatus = document.getElementById('fill-status')
const reimportBtn = document.getElementById('reimport-btn')

function showReady(fields) {
  importView.classList.add('hidden')
  readyView.classList.remove('hidden')
  const entries = Object.entries(fields)
  fieldCount.textContent = String(entries.length)
  fieldPreview.innerHTML = entries
    .slice(0, 12)
    .map(
      ([key, value]) =>
        `<div><span class="key">${escapeHtml(key)}</span><span class="val">${escapeHtml(String(value))}</span></div>`,
    )
    .join('')
}

function showImport() {
  readyView.classList.add('hidden')
  importView.classList.remove('hidden')
  textarea.value = ''
  importError.textContent = ''
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

chrome.storage.local.get(['aipplyFields'], (result) => {
  if (result.aipplyFields && Object.keys(result.aipplyFields).length > 0) {
    showReady(result.aipplyFields)
  }
})

saveBtn.addEventListener('click', () => {
  importError.textContent = ''
  let fields
  try {
    fields = JSON.parse(textarea.value)
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
      throw new Error('not an object')
    }
  } catch {
    importError.textContent = "That doesn't look like valid data - copy it fresh from the Submit page in Aipply."
    return
  }
  chrome.storage.local.set({ aipplyFields: fields }, () => showReady(fields))
})

reimportBtn.addEventListener('click', showImport)

fillBtn.addEventListener('click', async () => {
  fillStatus.textContent = 'Filling...'
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    fillStatus.textContent = 'No active tab.'
    return
  }
  chrome.tabs.sendMessage(tab.id, { type: 'AIPPLY_FILL' }, (response) => {
    if (chrome.runtime.lastError) {
      fillStatus.textContent = 'Could not reach this page - try reloading it.'
      return
    }
    if (response?.filled != null) {
      fillStatus.textContent = `Filled ${response.filled} field${response.filled === 1 ? '' : 's'}.`
    } else {
      fillStatus.textContent = 'Done.'
    }
  })
})
