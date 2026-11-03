import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { cleanName } from '../utils/cleanName'
import { photoUrl } from '../utils/photoUrl'
import PhotoLightbox from './PhotoLightbox'

function GalleryView({ individuals, onSelectPerson }) {
  const [viewMode, setViewMode] = useState('masonry')
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [filter, setFilter] = useState('photos')
  const [loadedMap, setLoadedMap] = useState({})
  const observerRef = useRef(null)

  const photos = useMemo(() => {
    const list = []
    for (const [, p] of individuals) {
      const url = photoUrl(p)
      if (filter === 'photos' && !url) continue
      list.push({
        id: p.id,
        name: cleanName(p.name),
        url,
        birthYear: p.birthYear || '',
        deathYear: p.deathDate || '',
        gender: p.gender || 'unknown',
      })
    }
    list.sort((a, b) => (a.birthYear || 'zzzz').localeCompare(b.birthYear || 'zzzz'))
    return list
  }, [individuals, filter])

  const decades = useMemo(() => {
    if (viewMode !== 'timeline') return []
    const groups = {}
    for (const p of photos) {
      const m = (p.birthYear || '').match(/(\d{3})0/)
      const decade = m ? `${m[1]}0s` : 'Unknown'
      if (!groups[decade]) groups[decade] = []
      groups[decade].push(p)
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [photos, viewMode])

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const id = e.target.dataset.photoId
          if (id) setLoadedMap(prev => ({ ...prev, [id]: true }))
          observerRef.current.unobserve(e.target)
        }
      })
    }, { rootMargin: '200px' })
    return () => observerRef.current?.disconnect()
  }, [])

  const observedRef = useCallback((node) => {
    if (node && observerRef.current) observerRef.current.observe(node)
  }, [])

  const openLightbox = (index) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(-1)
  const nextPhoto = () => setLightboxIndex(i => Math.min(i + 1, photos.length - 1))
  const prevPhoto = () => setLightboxIndex(i => Math.max(i - 1, 0))

  const photoCount = useMemo(() => {
    let c = 0
    for (const p of individuals.values()) if (p.photo) c++
    return c
  }, [individuals])

  const totalCount = individuals.size

  if (individuals.size === 0) {
    return (
      <div className="gallery-container">
        <div className="gallery-header">
          <h2><i className="fas fa-images"></i> Photo Gallery</h2>
        </div>
        <div className="empty-state">
          <i className="fas fa-images"></i>
          <h2>No photos</h2>
          <p>Import a GEDCOM file to see photos</p>
        </div>
      </div>
    )
  }

  const renderGalleryItem = (photo, globalIndex) => {
    const isLoaded = loadedMap[photo.id] || !photo.url
    return (
      <div
        key={photo.id}
        data-photo-id={photo.id}
        ref={observedRef}
        className={`gallery-item ${isLoaded ? 'loaded' : 'loading'}`}
        onClick={() => openLightbox(globalIndex)}
      >
        {photo.url ? (
          isLoaded ? (
            <img src={photo.url} alt={photo.name} loading="lazy" />
          ) : (
            <div className="gallery-skeleton">
              <div className="skeleton-shimmer"></div>
            </div>
          )
        ) : (
          <div className={`gallery-placeholder gender-${photo.gender}`}>
            <i className="fas fa-user"></i>
          </div>
        )}
        <div className="gallery-item-overlay">
          <span className="gallery-item-name">{photo.name}</span>
          {photo.birthYear && <span className="gallery-item-dates">{photo.birthYear}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <div className="gallery-header-left">
          <h2><i className="fas fa-images"></i> Photo Gallery</h2>
          <span className="gallery-count">
            {filter === 'photos' ? `${photoCount} photos` : `${totalCount} people`}
          </span>
        </div>
        <div className="gallery-controls">
          <div className="gallery-filter-group">
            <button
              className={`btn btn-sm ${filter === 'photos' ? 'btn-primary' : ''}`}
              onClick={() => setFilter('photos')}
            >
              <i className="fas fa-camera"></i> With Photos
            </button>
            <button
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}`}
              onClick={() => setFilter('all')}
            >
              <i className="fas fa-users"></i> All People
            </button>
          </div>
          <div className="gallery-view-group">
            <button
              className={`btn btn-icon ${viewMode === 'masonry' ? 'active' : ''}`}
              onClick={() => setViewMode('masonry')}
              title="Masonry view"
            >
              <i className="fas fa-th-large"></i>
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <i className="fas fa-th"></i>
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
              title="Timeline view"
            >
              <i className="fas fa-stream"></i>
            </button>
            <button
              className={`btn btn-icon ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <i className="fas fa-list"></i>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <div className="gallery-timeline">
          {decades.map(([decade, items]) => (
            <div key={decade} className="timeline-decade">
              <h3 className="timeline-decade-label">{decade}</h3>
              <div className="timeline-decade-items">
                {items.map((photo, i) => {
                  const globalIndex = photos.indexOf(photo)
                  return renderGalleryItem(photo, globalIndex)
                })}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="gallery-list">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="gallery-list-item"
              onClick={() => openLightbox(i)}
            >
              <div className={`gallery-list-avatar gender-${photo.gender}`}>
                {photo.url ? (
                  <img src={photo.url} alt={photo.name} loading="lazy" />
                ) : (
                  <i className="fas fa-user"></i>
                )}
              </div>
              <div className="gallery-list-info">
                <span className="gallery-list-name">{photo.name}</span>
                <span className="gallery-list-dates">
                  {photo.birthYear || 'Unknown'}
                  {photo.deathYear ? ` — ${photo.deathYear}` : ''}
                </span>
              </div>
              <div className="gallery-list-action">
                <i className="fas fa-chevron-right"></i>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`gallery-grid gallery-${viewMode}`}>
          {photos.map((photo, i) => renderGalleryItem(photo, i))}
        </div>
      )}

      {lightboxIndex >= 0 && (
        <PhotoLightbox
          photos={photos}
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
