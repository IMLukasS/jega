import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CreateTemplate() {
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]); 
  
  const [exerciseInput, setExerciseInput] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  
  // ---> NEW: Added targetReps state <---
  const [targetSets, setTargetSets] = useState(3);
  const [targetReps, setTargetReps] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableExercises, setAvailableExercises] = useState([]);
  
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  
  const [expandedExerciseId, setExpandedExerciseId] = useState(null);

  useEffect(() => {
    if (isModalOpen && availableExercises.length === 0) {
      fetch('http://localhost:3000/api/v1/exercises')
        .then(res => res.json())
        .then(data => setAvailableExercises(data))
        .catch(err => console.error("Error fetching exercises:", err));
    }
  }, [isModalOpen, availableExercises.length]);

  const uniqueBodyParts = [...new Set(availableExercises.map(ex => ex.body_part).filter(Boolean))].sort();
  const uniqueEquipment = [...new Set(availableExercises.map(ex => ex.equipment).filter(Boolean))].sort();

  const filteredLibrary = availableExercises.filter(ex => {
    const matchesSearch = 
      ex.title.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
      ex.body_part?.toLowerCase().includes(modalSearchTerm.toLowerCase());
    
    const matchesBodyPart = selectedBodyPart === '' || ex.body_part === selectedBodyPart;
    const matchesEquipment = selectedEquipment === '' || ex.equipment === selectedEquipment;

    return matchesSearch && matchesBodyPart && matchesEquipment;
  }).slice(0, 100); 

  const handleSelectFromModal = (ex) => {
    setExerciseInput(ex.title);
    setSelectedExerciseId(ex.id);
    
    setIsModalOpen(false);
    setModalSearchTerm('');
    setSelectedBodyPart('');
    setSelectedEquipment('');
    setExpandedExerciseId(null);
  };

  const handleAddExerciseToRoutine = (e) => {
    e.preventDefault();
    if (!exerciseInput.trim()) return;

    let exerciseIdToSubmit = selectedExerciseId;
    let exerciseNameToSubmit = exerciseInput;

    const exactMatch = availableExercises.find(
      ex => ex.title.toLowerCase() === exerciseInput.trim().toLowerCase()
    );
    if (exactMatch) {
      exerciseIdToSubmit = exactMatch.id;
      exerciseNameToSubmit = exactMatch.title;
    }

    setExercises([
      ...exercises, 
      { 
        exercise_id: exerciseIdToSubmit, 
        name: exerciseNameToSubmit, 
        target_sets: Number(targetSets),
        target_reps: Number(targetReps) // ---> NEW: Pushing reps to the array <---
      }
    ]);

    // Reset inputs
    setExerciseInput('');
    setSelectedExerciseId(null);
    setTargetSets(3);
    setTargetReps(10);
  };

  const handleRemoveExercise = (indexToRemove) => {
    setExercises(exercises.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveTemplate = async () => {
    if (!name.trim() || exercises.length === 0) {
      alert("Please provide a name and at least one exercise.");
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/v1/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, exercises })
      });

      if (response.ok) {
        navigate('/'); 
      } else {
        console.error("Failed to save template");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const toggleDescription = (e, id) => {
    e.stopPropagation(); 
    setExpandedExerciseId(expandedExerciseId === id ? null : id);
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <header>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'transparent', color: '#888', padding: '0', marginBottom: '10px', border: 'none', cursor: 'pointer' }}
        >
          ← Cancel
        </button>
        <h1>Create Template</h1>
      </header>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Routine Name</label>
        <input 
          type="text" placeholder="e.g., Heavy Push Day" value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', color: '#000' }}
        />
      </div>

      <hr style={{ border: '0', borderTop: '1px solid #2d2d2d', margin: '20px 0' }} />

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px' }}>Exercises ({exercises.length})</h3>
        {exercises.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>No exercises added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {exercises.map((ex, index) => (
              <div key={index} className="workout-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#222', borderRadius: '6px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', display: 'block', color: '#fff' }}>
                    {index + 1}. {ex.name} {!ex.exercise_id && <span style={{ color: '#007bff', fontSize: '0.75rem', fontWeight: 'normal' }}>(Custom)</span>}
                  </span>
                  {/* ---> NEW: Showing Sets x Reps in the list <--- */}
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>{ex.target_sets} Sets × {ex.target_reps} Reps</span>
                </div>
                <button 
                  onClick={() => handleRemoveExercise(index)}
                  style={{ background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New/Custom Exercise Layout */}
      <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #2d2d2d' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#fff' }}>Add Exercise</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
          
          {/* Top Row: Search & Browse */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" placeholder="Type custom or select from library..."
              value={exerciseInput} onChange={(e) => { setExerciseInput(e.target.value); setSelectedExerciseId(null); }}
              style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#fff', color: '#000' }}
            />
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{ background: '#007bff', color: '#fff', padding: '0 15px', borderRadius: '4px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
            >
              🔍 Browse
            </button>
          </div>

          {/* Bottom Row: Sets & Reps */}
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>Sets</label>
              <input 
                type="number" min="1" value={targetSets} onChange={(e) => setTargetSets(e.target.value)}
                style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#fff', color: '#000', textAlign: 'center' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 'bold' }}>Reps</label>
              <input 
                type="number" min="1" value={targetReps} onChange={(e) => setTargetReps(e.target.value)}
                style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#fff', color: '#000', textAlign: 'center' }}
              />
            </div>
          </div>

        </div>

        <button 
          onClick={handleAddExerciseToRoutine} 
          style={{ width: '100%', background: '#333', color: '#fff', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', border: '1px solid #444' }}
        >
          + Add to Template List
        </button>
      </div>

      <button 
        onClick={handleSaveTemplate}
        style={{ width: '100%', padding: '15px', background: '#28a745', color: '#fff', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', border: 'none' }}
      >
        Save Template Routine
      </button>

      {/* --- THE ADVANCED BROWSE LIBRARY MODAL (Unchanged) --- */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '700px', maxHeight: '85vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '15px', borderBottom: '1px solid #ccc', background: '#f8f9fa' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input 
                  type="text" placeholder="Search by name..." value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }} autoFocus
                />
                <button 
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: '#ff4444', color: '#fff', padding: '10px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <select 
                  value={selectedBodyPart} 
                  onChange={(e) => setSelectedBodyPart(e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }}
                >
                  <option value="">All Body Parts</option>
                  {uniqueBodyParts.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                </select>

                <select 
                  value={selectedEquipment} 
                  onChange={(e) => setSelectedEquipment(e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }}
                >
                  <option value="">All Equipment</option>
                  {uniqueEquipment.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '10px' }}>
              {availableExercises.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading library...</p>
              ) : filteredLibrary.length > 0 ? (
                filteredLibrary.map(ex => (
                  <div key={ex.id} style={{ borderBottom: '1px solid #eee' }}>
                    <div 
                      onClick={() => handleSelectFromModal(ex)}
                      style={{ padding: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <span style={{ fontWeight: 'bold', color: '#333', display: 'block' }}>{ex.title}</span>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                          {ex.body_part && <span style={{ background: '#e0e0e0', color: '#333', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px' }}>{ex.body_part}</span>}
                          {ex.equipment && <span style={{ background: '#d0e8f2', color: '#333', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px' }}>{ex.equipment}</span>}
                        </div>
                      </div>
                      
                      {ex.short_description && (
                        <button 
                          onClick={(e) => toggleDescription(e, ex.id)}
                          style={{ background: 'transparent', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}
                        >
                          {expandedExerciseId === ex.id ? 'Hide Info' : 'ℹ️ Info'}
                        </button>
                      )}
                    </div>

                    {expandedExerciseId === ex.id && (
                      <div style={{ padding: '12px', background: '#f8f9fa', borderTop: '1px dashed #ddd', fontSize: '0.9rem', color: '#444' }}>
                        {ex.short_description}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No exercises found matching those filters.</p>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}