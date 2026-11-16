import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAlbums, fetchAlbum, createAlbum, updateAlbum, deleteAlbum,
  addPhotosToAlbum, removePhotoFromAlbum, setAlbumCover,
} from '../utils/api'
import { photoUrl } from '../utils/photoUrl'
import PhotoLightbox from './PhotoLightbox'

function AlbumsPanel({ photos, onSelectPerson, onAlbumCountChange }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // 'list' shows all albums; otherwise a detail id is open
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null) // { album, photos: [filenames] }
  const [detailLoading, setDetailLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelected, setPickerSelected] = useState(() => new Set())
  const [lightboxIndex, setLightboxIndex] = useState(-1)

  const showNotice = useCallback((text) => {
    setNotice(text)
    window.clearTimeout(showNotice._t)
    showNotice._t = window.setTimeout(() => setNotice(''), 4000)
  }, [])

  const refreshList = useCallback(async () => {
    try {
      const res = await fetchAlbums()
      if (!res.ok) {
        setError(res.error || 'Could not load albums')
        return
      }
      const list = res.albums || []
      setAlbums(list)
      setError('')
      if (onAlbumCountChange) onAlbumCountChange(list.length)
    } catch (err) {
      setError(err.message || 'Could not load albums')
    } finally {
      setLoading(false)
    }
  }, [onAlbumCountChange])

  const reloadDetail = useCallback(async (id) => {
    if (!id) return
    setDetailLoading(true)
    try {
      const res = await fetchAlbum(id)
      if (!res.ok) {
        setError(res.error || 'Could not open album')
        return
      }
      setDetail({ album: res.album, photos: res.photos || [] })
      setError('')
    } catch (err) {
      setError(err.message || 'Could not open album')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => { refreshList() }, [refreshList])

  const openDetail = useCallback((id) => {
    setOpenId(id)
    setDetail(null)
    setEditing(false)
    setPickerOpen(false)
    setPickerSelected(new Set())
    reloadDetail(id)
  }, [reloadDetail])

  const closeDetail = useCallback(() => {
    setOpenId(null)
    setDetail(null)
    setEditing(false)
    setPickerOpen(false)
    setPickerSelected(new Set())
    refreshList()
  }, [refreshList])

  const handleCreateSubmit = async (event) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    try {
      const res = await createAlbum(name, newDescription.trim())
      if (!res.ok) {
        setError(res.error || 'Could not create album')
        return
      }
      setNewName('')
      setNewDescription('')
      setShowCreate(false)
      showNotice(`Album "${name}" created.`)
      await refreshList()
    } catch (err) {
      setError(err.message || 'Could not create album')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => {
    if (!detail) return
    setEditName(detail.album.name)
    setEditDescription(detail.album.description || '')
    setEditing(true)
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    const name = editName.trim()
    if (!name || !detail) return
    setBusy(true)
    setError('')
    try {
      const res = await updateAlbum(detail.album.id, name, editDescription.trim())
      if (!res.ok) {
        setError(res.error || 'Could not save album')
        return
      }
      setEditing(false)
      showNotice('Album updated.')
      await reloadDetail(detail.album.id)
    } catch (err) {
      setError(err.message || 'Could not save album')
    } finally {
      setBusy(false)
    }
  }

  const removeAlbum = async () => {
    if (!detail) return
    if (!window.confirm(`Delete album "${detail.album.name}"? The photos themselves will not be deleted.`)) return
    setBusy(true)
    setError('')
    try {
      const res = await deleteAlbum(detail.album.id)
      if (!res.ok) {
        setError(res.error || 'Could not delete album')
        return
      }
      showNotice('Album deleted.')
      closeDetail()
    } catch (err) {
      setError(err.message || 'Could not delete album')
    } finally {
      setBusy(false)
    }
  }

  const addSelected = async () => {
    if (!detail || pickerSelected.size === 0) return
    setBusy(true)
    setError('')
    try {
      const res = await addPhotosToAlbum(detail.album.id, [...pickerSelected])
      if (!res.ok) {
        setError(res.error || 'Could not add photos')
        return
      }
      showNotice(`${res.added ?? pickerSelected.size} photo(s) added.`)
      setPickerSelected(new Set())
      setPickerOpen(false)
      await reloadDetail(detail.album.id)
    } catch (err) {
      setError(err.message || 'Could not add photos')
    } finally {
      setBusy(false)
    }
  }

  const removeFromAlbum = async (photo) => {
    if (!detail) return
    setError('')
    try {
      const res = await removePhotoFromAlbum(detail.album.id, photo)
      if (!res.ok) {
        setError(res.error || 'Could not remove photo')
        return
      }
      await reloadDetail(detail.album.id)
    } catch (err) {
      setError(err.message || 'Could not remove photo')
    }
  }

  const makeCover = async (photo) => {
    if (!detail) return
    setError('')
    try {
      const res = await setAlbumCover(detail.album.id, photo)
      if (!res.ok) {
        setError(res.error || 'Could not set the cover')
        return
      }
      showNotice('Cover photo updated.')
      await reloadDetail(detail.album.id)
    } catch (err) {
      setError(err.message || 'Could not set the cover')
    }
  }

  const poolByPhoto = useMemo(() => new Map((photos || []).map((p) => [p.photo, p])), [photos])

  const detailPhotos = useMemo(() => {
    if (!detail) return []
    return detail.photos.map((fn) => {
      const known = poolByPhoto.get(fn)
      if (known) return known
      return {
        id: fn,
        photo: fn,
        name: fn,
        url: photoUrl({ photo: fn }),
        birthYear: '',
        deathYear: '',
        gender: 'unknown',
        isPerson: false,
      }
    })
  }, [detail, poolByPhoto])

  const pickerPhotos = useMemo(() => {
    if (!detail) return []
    const inAlbum = new Set(detail.photos)
    return (photos || []).filter((p) => p.photo && !inAlbum.has(p.photo))
  }, [photos, detail])

  const togglePicker = (fn) => {
    setPickerSelected((prev) => {
      const next = new Set(prev)
      if (next.has(fn)) next.delete(fn)
      else next.add(fn)
      return next
    })
  }

  // ------------------------------------------------------------------ render

  if (openId !== null) {
    const album = detail?.album
    const canManage = !!album?.can_manage
    return (
      <div className="album-detail">
        <button type="button" className="album-back" onClick={closeDetail}>
          <i className="fas fa-arrow-left" aria-hidden="true"></i> Albums
        </button>

        {error && <p className="album-error" role="alert">{error}</p>}
        {notice && <p className="album-notice" role="status">{notice}</p>}

        {detailLoading && !detail ? (
          <div className="sm-empty"><i className="fas fa-spinner fa-spin"></i> Opening album...</div>
        ) : album ? (
          <>
            <div className="album-detail-head">
              <div className="album-detail-title">
                <h2>{album.name}</h2>
                <p className="album-detail-meta">
                  {album.photo_count.toLocaleString()} photo{album.photo_count === 1 ? '' : 's'}
                  {album.created_name ? <> &middot; by {album.created_name}</> : null}
                </p>
                {album.description && <p className="album-detail-desc">{album.description}</p>}
              </div>
              <div className="album-detail-actions">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setPickerOpen((v) => !v)} disabled={busy}>
                  <i className="fas fa-plus" aria-hidden="true"></i> Add photos
                </button>
                {canManage && (
                  <button type="button" className="btn btn-sm" onClick={startEdit} disabled={busy}>
                    <i className="fas fa-pen" aria-hidden="true"></i> Edit
                  </button>
                )}
                {canManage && (
                  <button type="button" className="btn btn-sm btn-reject" onClick={removeAlbum} disabled={busy}>
                    <i className="fas fa-trash" aria-hidden="true"></i> Delete
                  </button>
                )}
              </div>
            </div>

            {editing && (
              <form className="album-form" onSubmit={saveEdit}>
                <label>
                  Name
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={120} required />
                </label>
                <label>
                  Description (optional)
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={500} rows={2} />
                </label>
                <div className="album-form-actions">
                  <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !editName.trim()}>Save</button>
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            )}

            {pickerOpen && (
              <div className="picker">
                <div className="picker-head">
                  <strong>Add photos to this album</strong>
                  <div className="picker-actions">
                    <button type="button" className="btn btn-sm" onClick={() => setPickerSelected(new Set(pickerPhotos.map((p) => p.photo)))}>
                      Select all ({pickerPhotos.length})
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setPickerSelected(new Set())} disabled={pickerSelected.size === 0}>
                      Clear
                    </button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={addSelected} disabled={busy || pickerSelected.size === 0}>
                      Add {pickerSelected.size} photo{pickerSelected.size === 1 ? '' : 's'}
                    </button>
                  </div>
                </div>
                {pickerPhotos.length === 0 ? (
                  <p className="picker-empty">Every available photo is already in this album.</p>
                ) : (
                  <div className="picker-grid">
                    {pickerPhotos.map((p) => {
                      const selected = pickerSelected.has(p.photo)
                      return (
                        <button
                          key={p.photo}
                          type="button"
                          className={`picker-tile ${selected ? 'selected' : ''}`}
                          onClick={() => togglePicker(p.photo)}
                          aria-pressed={selected}
                          title={p.name}
                        >
                          <img src={p.url} alt={p.name} loading="lazy" decoding="async" />
                          <span className="picker-check"><i className={`fas fa-${selected ? 'check-circle' : 'circle'}`}></i></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {detailPhotos.length === 0 ? (
              <div className="photos-empty">
                <i className="fas fa-images"></i>
                <h2>No photos in this album yet</h2>
                <p>Click <strong>Add photos</strong> to pick from the family photo pool.</p>
              </div>
            ) : (
              <div className="photos-grid">
                {detailPhotos.map((photo, idx) => (
                  <div key={photo.photo || idx} className="album-tile">
                    <button type="button" className="photo-tile" onClick={() => setLightboxIndex(idx)} title={photo.name}>
                      <img src={photo.url} alt={photo.name} loading="lazy" decoding="async" />
                      <div className="photo-overlay">
                        <span className="photo-name">{photo.name}</span>
                        {photo.birthYear && <span className="photo-year">{photo.birthYear}</span>}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="album-tile-btn album-tile-remove"
                      onClick={() => removeFromAlbum(photo.photo)}
                      title="Remove from album"
                      aria-label={`Remove ${photo.name} from album`}
                    >
                      <i className="fas fa-times" aria-hidden="true"></i>
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        className={`album-tile-btn album-tile-cover ${album.cover_photo === photo.photo ? 'is-cover' : ''}`}
                        onClick={() => makeCover(photo.photo)}
                        title={album.cover_photo === photo.photo ? 'Current cover' : 'Set as album cover'}
                        aria-label={`Set ${photo.name} as album cover`}
                        aria-pressed={album.cover_photo === photo.photo}
                      >
                        <i className={`fas fa-star`} aria-hidden="true"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="sm-empty"><i className="fas fa-triangle-exclamation"></i> Could not open this album.</div>
        )}

        {lightboxIndex >= 0 && detailPhotos.length > 0 && (
          <PhotoLightbox
            photos={detailPhotos}
            lightboxIndex={lightboxIndex}
            onClose={() => setLightboxIndex(-1)}
            onNext={() => setLightboxIndex((i) => Math.min(i + 1, detailPhotos.length - 1))}
            onPrev={() => setLightboxIndex((i) => Math.max(i - 1, 0))}
            onSelectPerson={onSelectPerson}
          />
        )}
      </div>
    )
  }

  // ---- list mode
  return (
    <div className="albums-panel">
      {error && <p className="album-error" role="alert">{error}</p>}
      {notice && <p className="album-notice" role="status">{notice}</p>}

      <div className="albums-panel-head">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowCreate((v) => !v)}>
          <i className="fas fa-plus" aria-hidden="true"></i> New album
        </button>
      </div>

      {showCreate && (
        <form className="album-form" onSubmit={handleCreateSubmit}>
          <label>
            Name
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={120}
              placeholder="e.g. Safari 2024, Grandma's 90th birthday"
              autoFocus
              required
            />
          </label>
          <label>
            Description (optional)
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} maxLength={500} rows={2} />
          </label>
          <div className="album-form-actions">
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !newName.trim()}>Create album</button>
            <button type="button" className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="sm-empty"><i className="fas fa-spinner fa-spin"></i> Loading albums...</div>
      ) : albums.length === 0 ? (
        <div className="photos-empty">
          <i className="fas fa-images"></i>
          <h2>No albums yet</h2>
          <p>Create your first album to organise the family photo pool — wedding albums, reunions, travel.</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="fas fa-plus" aria-hidden="true"></i> Create the first album
          </button>
        </div>
      ) : (
        <div className="albums-grid">
          {albums.map((album) => (
            <button type="button" key={album.id} className="album-card" onClick={() => openDetail(album.id)}>
              <span className="album-cover" aria-hidden="true">
                {album.cover_photo ? (
                  <img src={photoUrl({ photo: album.cover_photo })} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="album-cover-empty"><i className="fas fa-images"></i></span>
                )}
              </span>
              <span className="album-meta">
                <strong>{album.name}</strong>
                <span>{album.photo_count.toLocaleString()} photo{album.photo_count === 1 ? '' : 's'}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AlbumsPanel
