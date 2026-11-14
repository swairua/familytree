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

export async function fetchRecentActivity() {
  return request('recent.php')
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth.php?action=login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

export async function logout() {
  const res = await fetch(`${API_BASE}/auth.php?action=logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: '{}',
  })
  return res.json()
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/auth.php?action=me`, {
    credentials: 'same-origin',
  })
  return res.json()
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

export async function updateIndividual(id, fields) {
  return request('tree.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ id, ...fields }),
  })
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

export async function aiSearch(prompt) {
  const res = await fetch(`${API_BASE}/ai.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `AI error ${res.status}`)
  }
  return res.json()
}
