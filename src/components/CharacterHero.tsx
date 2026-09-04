import { siteContent } from '../config/content'

export function CharacterHero() {
  return (
    <section className="character-hero" aria-labelledby="hero-title">
      <img
        className="character-hero__image"
        src={siteContent.portraitUrl}
        alt="江小满站在雨天的满糖甜品店门口"
      />
      <div className="character-hero__scrim" />
      <p className="character-hero__brand">{siteContent.brand}</p>
      <div className="character-hero__copy">
        <p className="character-hero__scene">{siteContent.scene}</p>
        <h1 id="hero-title">{siteContent.headline}</h1>
        <p>{siteContent.subline}</p>
      </div>
    </section>
  )
}
