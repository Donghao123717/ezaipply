// Generic label-matching autofill. This does not know the DOM structure of
// any specific site (including Common App) - it scans whatever labels/
// placeholders/aria text actually exist on the current page and fuzzy-
// matches them against the fields saved from Aipply. Accuracy depends on
// how the target site labels its own fields.

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[*:_\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelForElement(el) {
  const parts = []

  if (el.id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (labelEl) parts.push(labelEl.textContent)
  }

  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) parts.push(ariaLabel)

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach((id) => {
      const ref = document.getElementById(id)
      if (ref) parts.push(ref.textContent)
    })
  }

  const placeholder = el.getAttribute('placeholder')
  if (placeholder) parts.push(placeholder)

  const name = el.getAttribute('name')
  if (name) parts.push(name.replace(/[_.-]/g, ' '))

  // Fall back to the nearest ancestor <label>, or a preceding label-ish sibling
  const closestLabel = el.closest('label')
  if (closestLabel) parts.push(closestLabel.textContent)

  let sibling = el.previousElementSibling
  let hops = 0
  while (sibling && hops < 3) {
    const text = sibling.textContent?.trim()
    if (text && text.length < 200) parts.push(text)
    sibling = sibling.previousElementSibling
    hops += 1
  }

  return normalize(parts.join(' '))
}

function scoreMatch(fieldKeyNormalized, labelNormalized) {
  if (!labelNormalized) return 0
  if (labelNormalized === fieldKeyNormalized) return 100
  if (labelNormalized.includes(fieldKeyNormalized)) return 80
  const fieldWords = fieldKeyNormalized.split(' ').filter(Boolean)
  const labelWords = new Set(labelNormalized.split(' ').filter(Boolean))
  const overlap = fieldWords.filter((w) => labelWords.has(w)).length
  if (overlap === 0) return 0
  return Math.round((overlap / fieldWords.length) * 60)
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value)
  } else {
    el.value = value
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function fillSelect(el, value) {
  const valueNormalized = normalize(value)
  for (const option of el.options) {
    const optionText = normalize(option.textContent || option.value)
    if (optionText === valueNormalized || optionText.includes(valueNormalized) || valueNormalized.includes(optionText)) {
      el.value = option.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
  }
  return false
}

function fillPage(fields) {
  const fieldEntries = Object.entries(fields).map(([key, value]) => ({
    key,
    value,
    normalized: normalize(key),
  }))

  const inputs = Array.from(document.querySelectorAll('input, textarea, select')).filter((el) => {
    if (el.disabled || el.readOnly) return false
    if (el instanceof HTMLInputElement) {
      const skipTypes = ['hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'password']
      if (skipTypes.includes(el.type)) return false
    }
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })

  let filled = 0

  for (const el of inputs) {
    if (el instanceof HTMLInputElement && el.value) continue
    if (el instanceof HTMLTextAreaElement && el.value) continue

    const labelText = labelForElement(el)
    if (!labelText) continue

    let best = null
    let bestScore = 0
    for (const entry of fieldEntries) {
      const score = scoreMatch(entry.normalized, labelText)
      if (score > bestScore) {
        bestScore = score
        best = entry
      }
    }

    if (best && bestScore >= 60) {
      if (el instanceof HTMLSelectElement) {
        if (fillSelect(el, best.value)) filled += 1
      } else {
        setNativeValue(el, best.value)
        filled += 1
      }
    }
  }

  return filled
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'AIPPLY_FILL') return

  chrome.storage.local.get(['aipplyFields'], (result) => {
    const fields = result.aipplyFields || {}
    const filled = fillPage(fields)
    sendResponse({ filled })
  })

  return true // keep the message channel open for the async sendResponse
})
