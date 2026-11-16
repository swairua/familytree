import React from 'react'
import '../styles/feature.css'
import '../styles/viewpages.css'
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
    title: 'Deep Nostalgiaâ„¢',
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
    title: 'LiveMemoryâ„¢',
    subtitle: 'Turn photos into short video memories',
    description: 'Automatically create cinematic short videos from your photosâ€”complete with music, captions and transitions.',
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
  dna: {
    icon: 'fa-dna',
    title: 'DNA Matching',
    subtitle: 'Find family connections across your DNA',
    description: 'Order a MyHeritage DNA, AncestryDNA or 23andMe kit and discover relatives â€” then see how the Wairua branches connect, with your privacy protected.',
    bullets: [
      'Connect DNA relatives to your family tree',
      'Estimate shared ethnicity and origin regions',
      'Confirm uncertain branches with matches',
    ],
    cta: 'Learn about DNA testing',
    ctaTarget: 'dna-learn',
    headerCta: { icon: 'fa-book-open', label: 'Read the guide', view: 'dna-learn' },
    extraAction: { icon: 'fa-people-arrows', label: 'Family matches', view: 'dna-matches' },
    howItWorks: [
      { icon: 'fa-truck', title: '1. Order', text: 'Pick a provider; the kit ships to your door' },
      { icon: 'fa-vial', title: '2. Swab', text: 'Cheek swab at home in a couple of minutes' },
      { icon: 'fa-chart-pie', title: '3. Results', text: 'About 4â€“8 weeks: ethnicity + DNA matches' },
    ],
  },
}

export default function FeatureView({ featureKey, onSwitchView }) {
  const content = FEATURES[featureKey] || FEATURES.colorize
  const ctaTarget = content.ctaTarget || 'gallery'
  const headerCta = content.headerCta || { icon: 'fa-images', label: 'My photos', view: 'gallery' }
  const howItWorks = content.howItWorks || [
    { icon: 'fa-upload', title: '1. Upload', text: 'Pick a photo from your gallery' },
    { icon: 'fa-cogs', title: '2. Process', text: 'AI handles the heavy lifting' },
    { icon: 'fa-save', title: '3. Save', text: 'Keep the result in your tree' },
  ]

  return (
    <div className="view-page">
      <div className="view-container">
        <div className="view-header">
          <div>
            <h1>{content.title}</h1>
            <p className="view-sub">{content.subtitle}</p>
          </div>
          <button className="btn btn-primary" onClick={() => onSwitchView(headerCta.view)}>
            <i className={`fas ${headerCta.icon}`}></i> {headerCta.label}
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
              <div className="feature-ctas">
                <button className="btn btn-accent" onClick={() => onSwitchView(ctaTarget)}>
                  {content.cta}
                </button>
                {content.extraAction && (
                  <button className="btn btn-primary" onClick={() => onSwitchView(content.extraAction.view)}>
                    <i className={`fas ${content.extraAction.icon}`} aria-hidden="true"></i> {content.extraAction.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="view-card">
          <div className="view-card-header">
            <h2>How it works</h2>
          </div>
          <div className="view-grid">
            {howItWorks.map((step, i) => (
              <div className="view-tile" key={i}>
                <i className={`fas ${step.icon}`}></i>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
