import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CreateTemplate() {
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState([]); 
  
  const [exerciseInput, setExerciseInput] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [tagInputs, setTagInputs] = useState({});

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
    let trackingTypeToSubmit = 'weight_reps'; 

    const exactMatch = availableExercises.find(
      ex => ex.title.toLowerCase() === exerciseInput.trim().toLowerCase()
    );
    
    if (exactMatch) {
      exerciseIdToSubmit = exactMatch.id;
      exerciseNameToSubmit = exactMatch.title;
      trackingTypeToSubmit = exactMatch.tracking_type || 'weight_reps';
    }

    setExercises([
      ...exercises, 
      { 
        exercise_id: exerciseIdToSubmit, 
        name: exerciseNameToSubmit, 
        tracking_type: trackingTypeToSubmit, 
        sets: [{ weight: '', reps: '', time_minutes: '', time_seconds: '', distance: '' }],
        tags: [] 
      }
    ]);

    setExerciseInput('');
    setSelectedExerciseId(null);
  };

  const handleRemoveExercise = (indexToRemove) => {
    setExercises(exercises.filter((_, index) => index !== indexToRemove));
  };
  const handleChangeTrackingType = (exerciseIndex, newType) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].tracking_type = newType;
    setExercises(newExercises);
  };

  const handleAddTag = (exerciseIndex) => {
    const currentInput = (tagInputs[exerciseIndex] || '').trim();
    if (!currentInput) return;

    const newExercises = [...exercises];
    if (!newExercises[exerciseIndex].tags) newExercises[exerciseIndex].tags = [];
    
    if (!newExercises[exerciseIndex].tags.includes(currentInput)) {
      newExercises[exerciseIndex].tags.push(currentInput);
    }

    setExercises(newExercises);
    setTagInputs({ ...tagInputs, [exerciseIndex]: '' });
  };

  const handleRemoveTag = (exerciseIndex, tagIndex) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].tags = newExercises[exerciseIndex].tags.filter((_, i) => i !== tagIndex);
    setExercises(newExercises);
  };

  const handleAddSet = (exerciseIndex) => {
    const newExercises = [...exercises];
    const previousSet = newExercises[exerciseIndex].sets.slice(-1)[0];
    newExercises[exerciseIndex].sets.push({
      weight: previousSet ? previousSet.weight : '',
      reps: previousSet ? previousSet.reps : '',
      time_minutes: previousSet ? previousSet.time_minutes : '',
      time_seconds: previousSet ? previousSet.time_seconds : '',
      distance: previousSet ? previousSet.distance : ''
    });
    setExercises(newExercises);
  };

  const handleRemoveSet = (exerciseIndex, setIndex) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets = newExercises[exerciseIndex].sets.filter((_, i) => i !== setIndex);
    setExercises(newExercises);
  };

  const handleUpdateSet = (exerciseIndex, setIndex, field, value) => {
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets[setIndex][field] = value;
    setExercises(newExercises);
  };

  const handleSaveTemplate = async () => {
    if (!name.trim() || exercises.length === 0) {
      alert("Please provide a name and at least one exercise.");
      return;
    }

    const hasEmptyExercises = exercises.some(ex => ex.sets.length === 0);
    if (hasEmptyExercises) {
      alert("Please ensure all exercises have at least one set, or remove the empty exercises.");
      return;
    }

    // ---> FIX: Sanitize empty fields to 0 numbers right before posting
    const sanitizedExercises = exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map(set => ({
        weight: set.weight === '' || set.weight == null ? 0 : Number(set.weight),
        reps: set.reps === '' || set.reps == null ? 0 : Number(set.reps),
        time_minutes: set.time_minutes === '' || set.time_minutes == null ? 0 : Number(set.time_minutes),
        time_seconds: set.time_seconds === '' || set.time_seconds == null ? 0 : Number(set.time_seconds),
        distance: set.distance === '' || set.distance == null ? 0 : Number(set.distance)
      }))
    }));

    try {
      const response = await fetch('http://localhost:3000/api/v1/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, exercises: sanitizedExercises }) // Send the sanitized list!
      });

      if (response.ok) {
        navigate('/'); 
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to save template. Please try again.");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      alert("A network error occurred. Please check if the server is running.");
    }
  };

  return (
    <div className="app-container" style={{ position: 'relative', paddingBottom: '40px' }}>
      <header>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'transparent', color: '#888', padding: '0', marginBottom: '10px', border: 'none', fontSize: '1rem', cursor: 'pointer' }}
        >
          ← Cancel
        </button>
        <h1>Create Template</h1>
      </header>

      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" placeholder="Routine Name (e.g., Heavy Push Day)" value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', fontSize: '1.2rem', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
        {exercises.map((ex, exIndex) => (
          <div key={exIndex} style={{ background: '#1e1e1e', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '16px' }}>
            
            {/* Exercise Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ margin: '0', fontSize: '1.1rem', color: '#fff' }}>
                    {exIndex + 1}. {ex.name} {!ex.exercise_id && <span style={{ color: '#007bff', fontSize: '0.8rem' }}>(Custom)</span>}
                  </h3>
                  
                  <select 
                    value={ex.tracking_type || 'weight_reps'}
                    onChange={(e) => handleChangeTrackingType(exIndex, e.target.value)}
                    style={{ background: '#111', color: '#ccc', border: '1px solid #333', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="weight_reps">Weight & Reps</option>
                    <option value="bodyweight_reps">Reps Only</option>
                    <option value="time">Time Only</option>
                    <option value="time_weight">Weight & Time</option>
                    <option value="distance_time">Distance & Time</option>
                  </select>
                </div>
                
                {/* Tag Bubbles and Input UI */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {(ex.tags || []).map((tag, tagIndex) => (
                    <span key={tagIndex} style={{ background: '#2563eb', color: '#fff', padding: '4px 10px', borderRadius: '16px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                      {tag}
                      <button 
                        onClick={() => handleRemoveTag(exIndex, tagIndex)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '0', fontSize: '0.75rem' }}
                      >✕</button>
                    </span>
                  ))}
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input 
                      type="text" 
                      placeholder="+ Add tag..."
                      value={tagInputs[exIndex] || ''}
                      onChange={(e) => setTagInputs({ ...tagInputs, [exIndex]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(exIndex); }}
                      style={{ background: '#111', border: '1px dashed #444', color: '#ccc', padding: '4px 10px', borderRadius: '16px', fontSize: '0.75rem', outline: 'none', width: '110px' }}
                    />
                    {tagInputs[exIndex] && (
                      <button 
                        onClick={() => handleAddTag(exIndex)}
                        style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '16px', padding: '0 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                      >Add</button>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleRemoveExercise(exIndex)}
                style={{ background: 'transparent', color: '#ef4444', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              >✕</button>
            </div>

            {/* Dynamic Set Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              {ex.sets.map((set, setIndex) => (
                <div key={setIndex} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#888', width: '25px', fontWeight: 'bold' }}>{setIndex + 1}</span>
                  
                  {ex.tracking_type === 'time' ? (
                    <>
                      <input type="number" placeholder="Min" value={set.time_minutes} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'time_minutes', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                      <input type="number" placeholder="Sec" value={set.time_seconds} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'time_seconds', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                    </>
                  ) : ex.tracking_type === 'bodyweight_reps' ? (
                    <input type="number" placeholder="Reps" value={set.reps} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'reps', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                  ) : ex.tracking_type === 'time_weight' ? (
                    <>
                      <input type="number" placeholder="Lbs" step="0.1" value={set.weight} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'weight', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                      <input type="number" placeholder="Min" value={set.time_minutes} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'time_minutes', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                      <input type="number" placeholder="Sec" value={set.time_seconds} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'time_seconds', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                    </>
                  ) : ex.tracking_type === 'distance_time' ? (
                    <>
                      <input type="number" placeholder="Miles" step="0.1" value={set.distance} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'distance', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                      <input type="number" placeholder="Min" value={set.time_minutes} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'time_minutes', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                      <input type="number" placeholder="Sec" value={set.time_seconds} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'time_seconds', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                    </>
                  ) : (
                    <>
                      <input type="number" placeholder="Lbs" step="0.1" value={set.weight} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'weight', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                      <input type="number" placeholder="Reps" value={set.reps} onChange={(e) => handleUpdateSet(exIndex, setIndex, 'reps', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #2d2d2d', background: '#111', color: '#fff', textAlign: 'center' }} />
                    </>
                  )}

                  <button 
                    onClick={() => handleRemoveSet(exIndex, setIndex)}
                    style={{ background: 'transparent', color: '#666', border: 'none', padding: '10px', cursor: 'pointer' }}
                  >✕</button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => handleAddSet(exIndex)}
              style={{ width: '100%', marginTop: '12px', padding: '10px', background: '#111', color: '#4ade80', border: '1px dashed #2d2d2d', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              + Add Set
            </button>

          </div>
        ))}
      </div>

      {/* Add Exercise Search Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <input 
          type="text" placeholder="Type custom or pick..."
          value={exerciseInput} onChange={(e) => { setExerciseInput(e.target.value); setSelectedExerciseId(null); }}
          style={{ flex: 1, padding: '16px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', fontSize: '1rem', outline: 'none' }}
        />
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ background: '#1e1e1e', border: '1px solid #2d2d2d', color: '#fff', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >Browse</button>
        <button 
          onClick={handleAddExerciseToRoutine} 
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >Add</button>
      </div>

      <button 
        onClick={handleSaveTemplate}
        style={{ width: '100%', padding: '20px', background: '#4ade80', color: '#111', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
      >
        Save Template
      </button>

      {/* Exercise Selection Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#1e1e1e', width: '100%', maxWidth: '480px', maxHeight: '85vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #2d2d2d' }}>
            
            <div style={{ padding: '16px', borderBottom: '1px solid #2d2d2d', background: '#111' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input 
                  type="text" placeholder="Search by name..." value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', outline: 'none' }} autoFocus
                />
                <button 
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: 'transparent', color: '#ef4444', padding: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >Close</button>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <select 
                  value={selectedBodyPart} 
                  onChange={(e) => setSelectedBodyPart(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', outline: 'none' }}
                >
                  <option value="">All Body Parts</option>
                  {uniqueBodyParts.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                </select>

                <select 
                  value={selectedEquipment} 
                  onChange={(e) => setSelectedEquipment(e.target.value)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', outline: 'none' }}
                >
                  <option value="">All Equipment</option>
                  {uniqueEquipment.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '10px' }}>
              {availableExercises.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading library...</p>
              ) : filteredLibrary.length > 0 ? (
                filteredLibrary.map(ex => (
                  <div key={ex.id} style={{ borderBottom: '1px solid #2d2d2d' }}>
                    <div 
                      onClick={() => handleSelectFromModal(ex)}
                      style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <span style={{ fontWeight: 'bold', color: '#fff', display: 'block' }}>{ex.title}</span>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          {ex.body_part && <span style={{ background: '#333', color: '#ccc', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}>{ex.body_part}</span>}
                          {ex.equipment && <span style={{ background: '#333', color: '#ccc', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}>{ex.equipment}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No exercises found.</p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}