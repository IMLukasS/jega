import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function FocusWorkout() {
  // 1. Grab the specific routine ID from the URL
  const { routineId } = useParams(); 
  const navigate = useNavigate();

  const [routine, setRoutine] = useState(null);
  const [workoutId, setWorkoutId] = useState(null); 
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [completedSets, setCompletedSets] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/v1/routines')
      .then((res) => res.json())
      .then(async (data) => {
        // 2. Search your fetched blueprints for the one that matches the URL
        const selectedRoutine = data.find((r) => r.id === routineId);
        
        // Safety check in case the ID in the URL is invalid
        if (!selectedRoutine) {
          console.error("Routine not found!");
          return;
        }

        setRoutine(selectedRoutine);

        // Start a live session in the database
        const startSessionRes = await fetch('http://localhost:3000/api/v1/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `${selectedRoutine.name} Session` })
        });
        
        const sessionData = await startSessionRes.json();
        setWorkoutId(sessionData.id);
      });
  }, [routineId]); // 3. Re-run this effect if the URL changes

  if (!routine || !workoutId) {
    return <div className="p-8 text-center text-gray-500">Initializing your session...</div>;
  }

  const activeExercise = routine.exercises[activeExerciseIndex];
  const isLastExercise = activeExerciseIndex === routine.exercises.length - 1;

  const handleLogSet = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`http://localhost:3000/api/v1/workouts/${workoutId}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Keeping the ID that successfully passed through
          exercise_id: activeExercise.exercise_id || activeExercise.id, 
          
          // Automatically calculate the set number (if 0 completed, this is set 1)
          set_number: completedSets.length + 1, 
          
          // Match the exact keys your backend is asking for
          actual_weight_kg: Number(weight), 
          actual_reps: Number(reps)
        })
      });

      if (response.ok) {
        setCompletedSets([...completedSets, { weight, reps }]);
        setWeight('');
        setReps('');
      } else {
        console.error("Server rejected the set.");
      }
    } catch (error) {
      console.error("Failed to log set", error);
    }
  };

  const handleNextExercise = () => {
    if (!isLastExercise) {
      setActiveExerciseIndex(activeExerciseIndex + 1);
      setCompletedSets([]); 
    } else {
      // Send the user directly to their summary page!
      navigate(`/workouts/${workoutId}`);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">{routine.name}</h2>
        <span className="text-sm font-medium text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
          {activeExerciseIndex + 1} of {routine.exercises.length}
        </span>
      </div>

      {/* Focus Area */}
      <div className="text-center mb-8">
        <h3 className="text-3xl font-black text-gray-900 mb-2">
          {activeExercise.name}
        </h3>
        <p className="text-gray-500">Target: {activeExercise.target_sets} Sets</p>
      </div>

      {/* Previously Logged Sets */}
      <div className="mb-6 space-y-2">
        {completedSets.map((set, i) => (
          <div key={i} className="flex justify-between bg-green-50 p-3 rounded text-green-800 font-medium">
            <span>Set {i + 1}</span>
            <span>{set.weight} lbs × {set.reps} reps ✓</span>
          </div>
        ))}
      </div>

      {/* Logging Form */}
      <form onSubmit={handleLogSet} className="flex gap-2 mb-8">
        <input 
          type="number" placeholder="Lbs" required
          value={weight} onChange={(e) => setWeight(e.target.value)}
          className="w-1/2 p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-black outline-none"
        />
        <input 
          type="number" placeholder="Reps" required
          value={reps} onChange={(e) => setReps(e.target.value)}
          className="w-1/2 p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-black outline-none"
        />
        <button type="submit" className="bg-black text-white px-6 rounded-lg font-bold hover:bg-gray-800">
          Log
        </button>
      </form>

      {/* Navigation */}
      <button 
        onClick={handleNextExercise}
        className="w-full border-2 border-black text-black font-bold py-4 rounded-lg hover:bg-black hover:text-white transition-colors"
      >
        {isLastExercise ? "Finish Workout" : "Next Exercise ➔"}
      </button>
      
    </div>
  );
}