import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Installer } from './pages/Installer'
import { AccuracyPage } from './sp/AccuracyPage'
import { CleaningTab } from './sp/CleaningTab'
import { Frame } from './sp/Frame'
import { HomeTab } from './sp/HomeTab'
import { ImpactTab } from './sp/ImpactTab'
import { InstallerTab } from './sp/InstallerTab'
import { Launch } from './sp/Launch'
import { ProShell } from './sp/ProShell'
import { JobPage } from './sp/pro/JobPage'
import { ProJobs, ProRecord, ProVisits } from './sp/ProTabs'
import { Shell } from './sp/Shell'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/r/:token" element={<Installer />} />
        <Route element={<Frame />}>
          <Route path="/" element={<Launch />} />
          <Route path="/app" element={<Shell />}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<HomeTab />} />
            <Route path="installer" element={<InstallerTab />} />
            <Route path="cleaning" element={<CleaningTab />} />
            <Route path="impact" element={<ImpactTab />} />
            <Route path="accuracy" element={<AccuracyPage />} />
          </Route>
          <Route path="/pro" element={<ProShell />}>
            <Route index element={<Navigate to="jobs" replace />} />
            <Route path="jobs" element={<ProJobs />} />
            <Route path="jobs/:id" element={<JobPage />} />
            <Route path="visits" element={<ProVisits />} />
            <Route path="record" element={<ProRecord />} />
          </Route>
          <Route path="/accuracy" element={<Navigate to="/app/accuracy" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
