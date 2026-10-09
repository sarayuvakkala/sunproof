import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { AccuracyPage } from './pages/AccuracyPage'
import { Installer } from './pages/Installer'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/accuracy" element={<AccuracyPage />} />
        <Route path="/r/:token" element={<Installer />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
