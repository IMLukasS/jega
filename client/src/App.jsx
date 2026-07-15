import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'               // ---> NEW: Replaces WorkoutList
import TemplatesPage from './pages/TemplatesPage'       // ---> NEW: Dedicated blueprint portal
import WorkoutDetail from './pages/WorkoutDetail'
import FocusWorkout from './components/FocusWorkout'
import CreateTemplate from './pages/CreateTemplate'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The landing page now points directly to your modern consistency dashboard */}
        <Route path="/" element={<Dashboard />} />
        
        {/* The new dedicated channel for viewing and managing blueprint configurations */}
        <Route path="/templates" element={<TemplatesPage />} />
        
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
        <Route path="/focus/:routineId" element={<FocusWorkout />} />
        <Route path="/create-template" element={<CreateTemplate />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App