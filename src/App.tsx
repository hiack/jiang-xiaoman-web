import { CharacterHero } from './components/CharacterHero'
import { ChatPanel } from './components/ChatPanel'
import { SafetyInfo } from './components/SafetyInfo'

export default function App() {
  return (
    <main className="app-shell" aria-label="江小满对话空间">
      <div className="experience-card">
        <CharacterHero />
        <div className="conversation-column">
          <ChatPanel />
          <SafetyInfo />
        </div>
      </div>
    </main>
  )
}
