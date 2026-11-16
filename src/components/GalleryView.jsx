import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { cleanName } from '../utils/cleanName'
import { photoUrl } from '../utils/photoUrl'
import PhotoLightbox from './PhotoLightbox'
import '../styles/gallery.css'

function GalleryView({ individuals, onSelectPerson }) {
  const photos = useMemo(() => {
    const arr = []
    for (const [, p] of individuals) {
      const url = photoUrl(p)
      if (!url) continue
      arr.push({
        id: p.id,
        name: cleanName(p.name),
        url,
        birthYear: p.birthYear || '',
        deathYear: p.deathDate || '',
        gender: p.gender || 'unknown',
      })
    }
    arr.sort((a, b) => (b.birthYear || '').localeCompare(a.birthYear || '') || (a.name || '').localeCompare(b.name || ''))
    return arr
  }, [individuals])

  const albums = useMemo(() => {
    return [{ id: 'all', title: 'Family photos', count: photos.length }]
  }, [photos])

  const [filter, setFilter] = useState('photos')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(48)
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const sentinelRef = useRef(null)

  const filteredPhotos = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return photos
    return photos.filter(p => (p.name || '').toLowerCase().includes(q))
  }, [photos, query])

  const visiblePhotos = useMemo(() => filteredPhotos.slice(0, visibleCount), [filteredPhotos, visibleCount])

  // Load more photos automatically as the user scrolls (infinite scroll)
  useEffect(() => {
    if (visibleCount >= filteredPhotos.length) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 48, filteredPhotos.length))
        }
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [filteredPhotos.length, visibleCount])

  useEffect(() => { setVisibleCount(48) }, [query, filter])

  const openLightbox = (index) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(-1)
  const nextPhoto = () => setLightboxIndex(i => Math.min(i + 1, filteredPhotos.length - 1))
  const prevPhoto = () => setLightboxIndex(i => Math.max(i - 1, 0))

  if (individuals.size === 0) {
    return (
      <div className="photos-page">
        <div className="photos-empty">
          <i className="fas fa-images"></i>
          <h2>No photos</h2>
          <p>Import a GEDCOM file to see photos.</p>
        </div>
      </div>
    )
  }

  const isAllMode = filter === 'all'
  const isPeopleMode = filter === 'people'
  const isAlbumsMode = filter === 'albums'

  const headerCount = isAllMode
    ? photos.length
    : isPeopleMode
      ? individuals.size
      : albums.length

  const gridItems = isAlbumsMode ? albums : photos

  return (
    <div className="photos-page">
      <div className="photos-layout">
        {/* Left sidebar */}
        <aside className="photos-sidebar">
          <nav className="photos-sidebar-nav" aria-label="Photos navigation">
            <button
              className={`sidebar-item ${filter === 'photos' ? 'active' : ''}`}
              onClick={() => setFilter('photos')}
            >
              <i className="fas fa-th-large" aria-hidden="true"></i>
              <span className="sidebar-label">All media items</span>
              <span className="sidebar-badge">{photos.length.toLocaleString()}</span>
            </button>
            <button
              className={`sidebar-item ${filter === 'people' ? 'active' : ''}`}
              onClick={() => setFilter('people')}
            >
              <i className="fas fa-user-friends" aria-hidden="true"></i>
              <span className="sidebar-label">People</span>
              <span className="sidebar-badge">{individuals.size.toLocaleString()}</span>
            </button>
            <button
              className={`sidebar-item ${filter === 'albums' ? 'active' : ''}`}
              onClick={() => setFilter('albums')}
            >
              <i className="fas fa-images" aria-hidden="true"></i>
              <span className="sidebar-label">Albums</span>
              <span className="sidebar-badge">{albums.length}</span>
            </button>
          </nav>
          <div className="photos-sidebar-footer">
            <div className="sidebar-note">
              <strong>{photos.length.toLocaleString()}</strong> media items
              <span> · {albums.length} albums · {individuals.size.toLocaleString()} people</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="photos-main">
          <div className="photos-header">
            <div className="photos-header-left">
              <h1>{isAlbumsMode ? 'Albums' : 'My photos'}</h1>
              <p className="photos-count">
                {isAlbumsMode
                  ? albums.length
                  : headerCount.toLocaleString()}
                {' '}media item{(isAlbumsMode ? albums.length : headerCount) === 1 ? '' : 's'}
              </p>
            </div>
            <div className="photos-header-right">
              <label className="photos-search">
                <i className="fas fa-search" aria-hidden="true"></i>
                <input
                  type="search"
                  placeholder="Find a photo..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search photos"
                />
              </label>
              <button className="photos-upload" type="button" title="Upload photos">
                <i className="fas fa-upload" aria-hidden="true"></i> Upload
              </button>
            </div>
          </div>

          {isAlbumsMode ? (
            <div className="albums-grid">
              {albums.map(album => (
                <div key={album.id} className="album-card">
                  <div className="album-cover" aria-hidden="true">
                    {photos.slice(0, 1).map(p => (
                      <img key={p.id} src={p.url} alt="" />
                    ))}
                  </div>
                  <div className="album-meta">
                    <strong>{album.title}</strong>
                    <span>{album.count.toLocaleString()} media items</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredPhotos.length === 0 ? (
                <div className="photos-no-results">No photos match “{query}”.</div>
              ) : (
                <div className="photos-grid">
                  {visiblePhotos.map((photo, idx) => (
                    <button
                      key={photo.id}
                      className="photo-tile"
                      onClick={() => openLightbox(idx)}
                      title={photo.name}
                    >
                      <img
                        src={photo.url}
                        alt={photo.name}
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="photo-overlay">
                        <span className="photo-name">{photo.name}</span>
                        {photo.birthYear && (
                          <span className="photo-year">{photo.birthYear}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {visibleCount < filteredPhotos.length && (
                <div ref={sentinelRef} className="photos-sentinel" aria-hidden="true" />
              )}
            </>
          )}
        </section>
      </div>

      {lightboxIndex >= 0 && (
        <PhotoLightbox
          photos={filteredPhotos.length ? filteredPhotos : photos}
          lightboxIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={nextPhoto}
          onPrev={prevPhoto}
          onSelectPerson={onSelectPerson}
        />
      )}
    </div>
  )
}

export default GalleryView
