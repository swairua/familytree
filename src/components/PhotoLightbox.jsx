import React, { useEffect, useRef } from 'react'

function PhotoLightbox({ photos, lightboxIndex, onClose, onNext, onPrev, onSelectPerson }) {
  const photo = photos[lightboxIndex]
  const imgRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNext()
      if (e.key === 'ArrowLeft') onPrev()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNext, onPrev])

  useEffect(() => {
    if (lightboxIndex >= 0) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [lightboxIndex])

  useEffect(() => {
    if (lightboxIndex > 0) {
      const img = new Image()
      img.src = photos[lightboxIndex - 1].url
    }
    if (lightboxIndex < photos.length - 1) {
      const img = new Image()
      img.src = photos[lightboxIndex + 1].url
    }
  }, [lightboxIndex, photos])

  if (!photo) return null

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} title="Close (Esc)">
          <i className="fas fa-times"></i>
        </button>

        <div className="lightbox-counter">
          {lightboxIndex + 1} / {photos.length}
        </div>

        {lightboxIndex > 0 && (
          <button className="lightbox-nav lightbox-prev" onClick={onPrev} title="Previous (←)">
            <i className="fas fa-chevron-left"></i>
          </button>
        )}

        <div className="lightbox-image-container">
          <img
            ref={imgRef}
            src={photo.url}
            alt={photo.name}
            className="lightbox-image"
          />
        </div>

        {lightboxIndex < photos.length - 1 && (
          <button className="lightbox-nav lightbox-next" onClick={onNext} title="Next (→)">
            <i className="fas fa-chevron-right"></i>
          </button>
        )}

        <div className="lightbox-info">
          <h3>{photo.name}</h3>
          <p className="lightbox-dates">
            {photo.birthYear || 'Unknown'}
            {photo.deathYear ? ` — ${photo.deathYear}` : ''}
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { onSelectPerson(photo.id); onClose() }}
          >
            <i className="fas fa-user"></i> View Profile
          </button>
        </div>
      </div>
    </div>
  )
}

export default PhotoLightbox
