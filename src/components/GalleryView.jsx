import React, { useMemo, useState, useEffect } from 'react'
import { cleanName } from '../utils/cleanName'
import { photoUrl } from '../utils/photoUrl'
import PhotoLightbox from './PhotoLightbox'

function GalleryView({ individuals, onSelectPerson }) {
  const [viewMode, setViewMode] = useState('grid')
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [filter, setFilter] = useState('photos')
  const [visibleCount, setVisibleCount] = useState(24)

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

  const visiblePhotos = photos.slice(0, visibleCount)

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

  useEffect(() => { setVisibleCount(24) }, [filter, viewMode])

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
    return (
      <div
        key={photo.id}
        className="gallery-item loaded"
        onClick={() => openLightbox(globalIndex)}
      >
        {photo.url ? (
          <img src={photo.url} alt={photo.name} loading={globalIndex < 12 ? 'eager' : 'lazy'} decoding="async" fetchPriority={globalIndex < 4 ? 'high' : 'auto'} />
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
    <div className="gallery-layout">
      <aside className="gallery-sidebar">
        <h3 className="gallery-sidebar-title">Media</h3>
        <button className={`gallery-side-item ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          <i className="fas fa-th-large"></i> All media items
        </button>
        <button className={`gallery-side-item ${filter === 'photos' ? 'active' : ''}`} onClick={() => setFilter('photos')}>
          <i className="fas fa-user"></i> People
        </button>
        <button className="gallery-side-item" onClick={() => setFilter('photos')}>
          <i className="fas fa-folder"></i> Albums
        </button>
      </aside>
      <div className="gallery-container gallery-main">
      <div className="gallery-header">
        <div className="gallery-header-left">
          <h2><i className="fas fa-images"></i> Photos</h2>
          <span className="gallery-count">
            Showing {filter === 'photos' ? photoCount : totalCount} media items
          </span>
        </div>
        <button className="btn btn-primary" title="Upload (coming soon)" disabled>
          <i className="fas fa-upload"></i> Upload
        </button>
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
          {visiblePhotos.map((photo, i) => (
            <div
              key={photo.id}
              className="gallery-list-item"
              onClick={() => openLightbox(i)}
            >
              <div className={`gallery-list-avatar gender-${photo.gender}`}>
                {photo.url ? (
                  <img src={photo.url} alt={photo.name} loading={i < 12 ? 'eager' : 'lazy'} decoding="async" fetchPriority={i < 4 ? 'high' : 'auto'} />
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
        <>
          <div className={`gallery-grid gallery-${viewMode}`}>
            {visiblePhotos.map((photo, i) => renderGalleryItem(photo, i))}
          </div>
          {visibleCount < photos.length && (
            <div className="gallery-loadmore">
              <button className="btn btn-primary" onClick={() => setVisibleCount(c => c + 24)}>
                Load more ({photos.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>

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
