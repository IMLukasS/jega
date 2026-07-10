import { BrowserRouter, Routes, Route } from 'react-router-dom'
import WorkoutList from './pages/WorkoutList'
import WorkoutDetail from './pages/WorkoutDetail'
import FocusWorkout from './components/FocusWorkout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkoutList />} />
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
        
        {/* Add this new line to create a dedicated page for your wizard! */}
        <Route path="/focus/:routineId" element={<FocusWorkout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App