export function cleanName(name) {
  if (!name) return ''
  return name.replace(/\/[^\/]*\//g, '').replace(/\s+/g, ' ').trim()
}

export function getInitials(name) {
  const cleaned = cleanName(name)
  if (!cleaned) return '?'
  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
