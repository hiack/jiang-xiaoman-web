import { siteContent } from '../config/content'

export function SafetyInfo() {
  return (
    <details className="safety-info">
      <summary>关于江小满与隐私</summary>
      <div>
        <p>{siteContent.isAiDisclosure}</p>
        <p>{siteContent.privacyNotice}</p>
        <p>{siteContent.emergencyNotice}</p>
      </div>
    </details>
  )
}
