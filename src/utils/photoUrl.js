export function photoUrl(person) {
  if (!person || !person.photo) return null
  // photo is stored as "2000001.jpg" (local file name in data/photos)
  if (/^\d+\.jpg$/i.test(person.photo)) {
    // In dev, serve the file directly from Vite's static root (much faster
    // than routing through PHP). In production, use the caching PHP endpoint.
    if (import.meta.env.DEV) {
      return `/data/photos/${encodeURIComponent(person.photo)}`
    }
    return `/api/photo.php?file=${encodeURIComponent(person.photo)}`
  }
  // full URL fallback (e.g. previously-saved CDN link)
  if (/^https?:\/\//i.test(person.photo)) return person.photo
  return person.photo || null
}