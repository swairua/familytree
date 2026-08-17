const API_BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API error ${res.status}`)
  }
  return res.json()
}

export async function fetchSummary() {
  return request('tree.php?action=summary')
}

export async function fetchIndividuals(q = '') {
  const params = q ? `&q=${encodeURIComponent(q)}` : ''
  return request(`tree.php?action=individuals${params}`)
}

export async function fetchIndividual(id) {
  return request(`tree.php?action=individual&id=${encodeURIComponent(id)}`)
}

export async function fetchFamilies() {
  return request('tree.php?action=families')
}

export async function fetchExport() {
  return request('tree.php?action=export')
}

export async function importGedcom(gedcomText) {
  return request('tree.php?action=import', {
    method: 'POST',
    body: JSON.stringify({ gedcom: gedcomText }),
  })
}

export async function clearTree() {
  return request('tree.php?action=clear', { method: 'POST', body: '{}' })
}

export async function syncStatus() {
  return request('sync.php?action=status')
}

export async function startSync() {
  return request('sync.php?action=start', { method: 'POST', body: '{}' })
}

export async function abortSync() {
  return request('sync.php?action=abort', { method: 'POST', body: '{}' })
}
