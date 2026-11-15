import React from 'react'
import '../styles/feature.css'

const FEATURES = {
  colorize: {
    icon: 'fa-palette',
    title: 'Colorize photos',
    subtitle: 'Bring black & white photos to life with AI',
    description: 'Automatically apply realistic colors to black-and-white photos, preserving faces and clothing while adding rich details.',
    bullets: [
      'Upload any black and white photo',
      'AI generates realistic color palettes',
      'Save the result to your tree',
    ],
    cta: 'Colorize a photo',
  },
  enhance: {
    icon: 'fa-magic',
    title: 'Enhance photos',
    subtitle: 'Improve clarity and lighting instantly',
    description: 'Remove blur, reduce noise, adjust lighting and restore faded or damaged photos with a single click.',
    bullets: [
      'Increase resolution and sharpness',
      'Repair scratches and faded tones',
      'Batch enhance multiple photos',
    ],
    cta: 'Enhance a photo',
  },
  nostalgia: {
    icon: 'fa-film',
    title: 'Deep Nostalgia™',
    subtitle: 'Bring faces to life with subtle animation',
    description: 'Turn static portraits into short, moving clips that gently bring ancestors to life in family memories.',
    bullets: [
      'Face detection and motion synthesis',
      'Short video output for you to save or share',
      'Best for portrait photos',
    ],
    cta: 'Animate a portrait',
  },
  livememory: {
    icon: 'fa-video',
    title: 'LiveMemory™',
    subtitle: 'Turn photos into short video memories',
    description: 'Automatically create cinematic short videos from your photos—complete with music, captions and transitions.',
    bullets: [
      'Automatic scene detection and pacing',
      'Curated music and transitions',
      'Perfect for sharing with family',
    ],
    cta: 'Create a memory',
  },
  scribeai: {
    icon: 'fa-pen-nib',
    title: 'Scribe AI',
    subtitle: 'Generate captions and family stories from photos',
    description: 'Scribe AI writes descriptions, captions and stories from photo context to make your archive searchable and meaningful.',
    bullets: [
      'Auto-caption and tag people and places',
      'Build searchable, structured archives',
      'Keep family history while it stays fresh',
    ],
    cta: 'Generate descriptions',
  },
}

export default function FeatureView({ featureKey, onSwitchView }) {
  const content = FEATURES[featureKey] || FEATURES.colorize

  return (
    <div className="view-page">
      <div className="view-container">
        <div className="view-header">
          <div>
            <h1>{content.title}</h1>
            <p className="view-sub">{content.subtitle}</p>
          </div>
          <button className="btn btn-primary" onClick={() => onSwitchView('gallery')}>
            <i className="fas fa-images"></i> My photos
          </button>
        </div>

        <div className="view-card">
          <div className="feature-hero">
            <div className="feature-hero-icon">
              <i className={`fas ${content.icon}`}></i>
            </div>
            <div className="feature-hero-body">
              <h2>{content.title}</h2>
              <p>{content.description}</p>
              <ul className="feature-bullets">
                {content.bullets.map((b, i) => (
                  <li key={i}><i className="fas fa-check"></i> {b}</li>
                ))}
              </ul>
              <button className="btn btn-accent" onClick={() => onSwitchView('gallery')}>
                {content.cta}
              </button>
            </div>
          </div>
        </div>

        <div className="view-card">
          <div className="view-card-header">
            <h2>How it works</h2>
          </div>
          <div className="view-grid">
            <div className="view-tile">
              <i className="fas fa-upload"></i>
              <strong>1. Upload</strong>
              <span>Pick a photo from your gallery</span>
            </div>
            <div className="view-tile">
              <i className="fas fa-cogs"></i>
              <strong>2. Process</strong>
              <span>AI handles the heavy lifting</span>
            </div>
            <div className="view-tile">
              <i className="fas fa-save"></i>
              <strong>3. Save</strong>
              <span>Keep the result in your tree</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}