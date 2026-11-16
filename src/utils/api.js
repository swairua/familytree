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

export async function registerAccount({ name, email, password }) {
  const res = await fetch(`${API_BASE}/auth.php?action=register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name, email, password }),
  })
  return res.json()
}

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth.php?action=forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email }),
  })
  return res.json()
}

export async function resetPassword(token, password) {
  const res = await fetch(`${API_BASE}/auth.php?action=reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ token, password }),
  })
  return res.json()
}

export async function changePassword({ current_password, new_password }) {
  const res = await fetch(`${API_BASE}/auth.php?action=change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ current_password, new_password }),
  })
  return res.json()
}

export async function changeProfile({ display_name, email }) {
  const res = await fetch(`${API_BASE}/auth.php?action=change-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ display_name, email }),
  })
  return res.json()
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/auth.php?action=users-list`, {
    credentials: 'same-origin',
  })
  return res.json()
}

export async function userAction(action, id) {
  const res = await fetch(`${API_BASE}/auth.php?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id }),
  })
  return res.json()
}

export async function userSetPassword(id, password) {
  const res = await fetch(`${API_BASE}/auth.php?action=user-set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id, password }),
  })
  return res.json()
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings.php?action=get`, {
    credentials: 'same-origin',
  })
  return res.json()
}

export async function updateSettings(patch) {
  const res = await fetch(`${API_BASE}/settings.php?action=set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(patch),
  })
  return res.json()
}

export async function sendTestEmail(to) {
  const res = await fetch(`${API_BASE}/settings.php?action=send-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ to }),
  })
  return res.json()
}

export async function userSetEmail(id, email) {
  const res = await fetch(`${API_BASE}/auth.php?action=user-set-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id, email }),
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

export async function uploadPhoto(individualId, file) {
  const form = new FormData()
  form.append('individualId', individualId || '')
  form.append('photo', file)
  const res = await fetch(`${API_BASE}/upload_photo.php`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Upload failed (${res.status})`)
  }
  return data
}

export async function createIndividual(childId, role, fields) {
  const res = await fetch(`${API_BASE}/create_individual.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ childId, role, ...fields }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status}`)
  }
  return res.json()
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

export async function fetchUpcomingBirthdays(days = 30) {
  const res = await fetch(`${API_BASE}/birthdays.php?action=list&days=${days}`, {
    credentials: 'same-origin',
  })
  return res.json()
}

export async function sendBirthdayReminders(days = 30) {
  const res = await fetch(`${API_BASE}/birthdays.php?action=send&days=${days}`, {
    method: 'POST',
    credentials: 'same-origin',
    body: '{}',
  })
  return res.json()
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

