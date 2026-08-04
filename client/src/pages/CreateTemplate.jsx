import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { fetchWithAuth } from '../apiClient';
import { toBaseKg, toDisplayWeight } from '../utils/unitConverter';

export default function CreateTemplate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const userUnit = (localStorage.getItem('preferredUnit') || 'lbs').toLowerCase();
  const weightUnitLabel = userUnit === 'kg' ? 'Kg' : 'Lbs';

  const templateToEdit = location.state?.templateToEdit;
  const isEditMode = !!id && !!templateToEdit;

  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState([]);

  // Adding an exercise – these inputs are global (they fill the "Add Exercise" bar)
  const [exerciseInput, setExerciseInput] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [tagInputs, setTagInputs] = useState({}); // key: `${blockIndex}-${exIndex}`

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableExercises, setAvailableExercises] = useState([]);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [expandedExerciseId, setExpandedExerciseId] = useState(null);

  // Load exercise library for modal
  useEffect(() => {
    if (isModalOpen && availableExercises.length === 0) {
      fetchWithAuth('/api/v1/exercises')
        .then(res => res.json())
        .then(data => setAvailableExercises(Array.isArray(data) ? data : []))
        .catch(err => console.error("Error fetching exercises:", err));
    }
  }, [isModalOpen, availableExercises.length]);

  // Load existing template into blocks
  useEffect(() => {
    if (isEditMode && templateToEdit) {
      setName(templateToEdit.name);
      if (templateToEdit.blocks) {
        // Map each block from backend
        const loadedBlocks = templateToEdit.blocks.map(block => ({
          id: block.id, // keep original ID for server
          block_type: block.block_type,
          rounds: block.rounds || 1,
          round_rest_seconds: block.round_rest_seconds || 0,
          auto_advance_round: block.auto_advance_round || false,
          exercises: (block.exercises || []).map(ex => ({
            exercise_id: ex.exercise_id || ex.id,
            name: ex.name,
            tracking_type: ex.tracking_type || 'weight_reps',
            tags: ex.tags || [],
            rest_seconds: ex.rest_seconds ?? 90,
            auto_advance: ex.auto_advance || false,
            work_seconds: ex.work_seconds || null,
            timer_mode: ex.timer_mode || 'manual',
            sets: (ex.sets || []).map(set => ({
              weight: set.weight !== 0 && set.weight != null ? String(toDisplayWeight(set.weight, userUnit)) : '',
              reps: set.reps !== 0 && set.reps != null ? String(set.reps) : '',
              time_minutes: set.time_minutes !== 0 && set.time_minutes != null ? String(set.time_minutes) : '',
              time_seconds: set.time_seconds !== 0 && set.time_seconds != null ? String(set.time_seconds) : '',
              distance: set.distance !== 0 && set.distance != null ? String(set.distance) : ''
            }))
          }))
        }));
        setBlocks(loadedBlocks);
      }
    }
  }, [isEditMode, templateToEdit, userUnit]);

  // Helpers for filtering library
  const uniqueBodyParts = [...new Set(availableExercises.map(ex => ex.body_part).filter(Boolean))].sort();
  const uniqueEquipment = [...new Set(availableExercises.map(ex => ex.equipment).filter(Boolean))].sort();
  const filteredLibrary = availableExercises.filter(ex => {
    const matchesSearch = ex.title.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
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
  };

  // -- Block management --
  const handleAddBlock = (type = 'single') => {
    const newBlock = {
      id: Date.now().toString(), // local ID until saved
      block_type: type,
      rounds: 1,
      round_rest_seconds: 0,
      auto_advance_round: false,
      exercises: []
    };
    setBlocks([...blocks, newBlock]);
  };

  const handleRemoveBlock = (blockIndex) => {
    setBlocks(blocks.filter((_, i) => i !== blockIndex));
  };

  // Add an exercise to a specific block (default: last block)
  const handleAddExerciseToBlock = (e, blockIndex = blocks.length - 1) => {
    e.preventDefault();
    if (!exerciseInput.trim()) return;
    if (blockIndex < 0) {
      // If no blocks exist, create a single block first
      handleAddBlock('single');
      return;
    }

    let exerciseIdToSubmit = selectedExerciseId;
    let exerciseNameToSubmit = exerciseInput;
    let trackingTypeToSubmit = 'weight_reps';
    const exactMatch = availableExercises.find(ex => ex.title.toLowerCase() === exerciseInput.trim().toLowerCase());
    if (exactMatch) {
      exerciseIdToSubmit = exactMatch.id;
      exerciseNameToSubmit = exactMatch.title;
      trackingTypeToSubmit = exactMatch.tracking_type || 'weight_reps';
    }

    const newExercise = {
      exercise_id: exerciseIdToSubmit,
      name: exerciseNameToSubmit,
      tracking_type: trackingTypeToSubmit,
      rest_seconds: 90,
      auto_advance: false,
      work_seconds: null,
      timer_mode: 'manual',
      sets: [{ weight: '', reps: '', time_minutes: '', time_seconds: '', distance: '' }],
      tags: []
    };

    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises.push(newExercise);
    setBlocks(newBlocks);
    setExerciseInput('');
    setSelectedExerciseId(null);
  };

  // -- Exercise-level helpers (within a block) --
  const handleRemoveExercise = (blockIndex, exIndex) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises = newBlocks[blockIndex].exercises.filter((_, i) => i !== exIndex);
    setBlocks(newBlocks);
  };

  const handleMoveExercise = (blockIndex, exIndex, direction) => {
    const newBlocks = [...blocks];
    const exercises = newBlocks[blockIndex].exercises;
    if (direction === 'up' && exIndex === 0) return;
    if (direction === 'down' && exIndex === exercises.length - 1) return;
    const swapIndex = direction === 'up' ? exIndex - 1 : exIndex + 1;
    [exercises[exIndex], exercises[swapIndex]] = [exercises[swapIndex], exercises[exIndex]];
    setBlocks(newBlocks);
  };

  const handleChangeTrackingType = (blockIndex, exIndex, newType) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exIndex].tracking_type = newType;
    setBlocks(newBlocks);
  };

  const handleAddTag = (blockIndex, exIndex) => {
    const key = `${blockIndex}-${exIndex}`;
    const currentInput = (tagInputs[key] || '').trim();
    if (!currentInput) return;
    const newBlocks = [...blocks];
    const ex = newBlocks[blockIndex].exercises[exIndex];
    if (!ex.tags) ex.tags = [];
    if (!ex.tags.includes(currentInput)) ex.tags.push(currentInput);
    setBlocks(newBlocks);
    setTagInputs({ ...tagInputs, [key]: '' });
  };

  const handleRemoveTag = (blockIndex, exIndex, tagIndex) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exIndex].tags = newBlocks[blockIndex].exercises[exIndex].tags.filter((_, i) => i !== tagIndex);
    setBlocks(newBlocks);
  };

  const handleAddSet = (blockIndex, exIndex) => {
    const newBlocks = [...blocks];
    const ex = newBlocks[blockIndex].exercises[exIndex];
    const previousSet = ex.sets.slice(-1)[0];
    ex.sets.push({
      weight: previousSet ? previousSet.weight : '',
      reps: previousSet ? previousSet.reps : '',
      time_minutes: previousSet ? previousSet.time_minutes : '',
      time_seconds: previousSet ? previousSet.time_seconds : '',
      distance: previousSet ? previousSet.distance : ''
    });
    setBlocks(newBlocks);
  };

  const handleRemoveSet = (blockIndex, exIndex, setIndex) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exIndex].sets = newBlocks[blockIndex].exercises[exIndex].sets.filter((_, i) => i !== setIndex);
    setBlocks(newBlocks);
  };

  const handleUpdateSet = (blockIndex, exIndex, setIndex, field, value) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exIndex].sets[setIndex][field] = value;
    setBlocks(newBlocks);
  };

  const handleUpdateExerciseField = (blockIndex, exIndex, field, value) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exIndex][field] = value;
    setBlocks(newBlocks);
  };

  // Save
  const handleSaveTemplate = async () => {
    if (!name.trim() || blocks.length === 0) {
      alert("Please provide a name and at least one block with exercises.");
      return;
    }
    // Validate each block has at least one exercise with at least one set
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      if (b.exercises.length === 0) {
        alert(`Block ${bi + 1} has no exercises. Add at least one exercise or remove the block.`);
        return;
      }
      for (let ei = 0; ei < b.exercises.length; ei++) {
        if (b.exercises[ei].sets.length === 0) {
          alert(`Exercise "${b.exercises[ei].name}" in block ${bi + 1} has no sets.`);
          return;
        }
      }
    }

    // Sanitize for API
    const sanitizedBlocks = blocks.map(block => ({
      block_type: block.block_type,
      rounds: block.rounds || 1,
      round_rest_seconds: block.round_rest_seconds || 0,
      auto_advance_round: block.auto_advance_round || false,
      exercises: block.exercises.map(ex => ({
        ...ex,
        rest_seconds: ex.rest_seconds ?? 90,
        auto_advance: ex.auto_advance || false,
        work_seconds: ex.work_seconds || null,
        timer_mode: ex.timer_mode || 'manual',
        sets: ex.sets.map(set => ({
          weight: set.weight === '' || set.weight == null ? 0 : toBaseKg(set.weight, userUnit),
          reps: set.reps === '' || set.reps == null ? 0 : Number(set.reps),
          time_minutes: set.time_minutes === '' || set.time_minutes == null ? 0 : Number(set.time_minutes),
          time_seconds: set.time_seconds === '' || set.time_seconds == null ? 0 : Number(set.time_seconds),
          distance: set.distance === '' || set.distance == null ? 0 : Number(set.distance)
        }))
      }))
    }));

    const endpoint = isEditMode ? `/api/v1/routines/${id}` : `/api/v1/routines`;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetchWithAuth(endpoint, {
        method,
        body: JSON.stringify({ name, blocks: sanitizedBlocks })
      });
      if (response.ok) {
        navigate('/templates');
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to save template.");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      alert("A network error occurred.");
    }
  };

  return (
    <div className="app-container" style={{ position: 'relative', paddingBottom: '40px' }}>
      <header>
        <button onClick={() => navigate('/templates')} style={{ background: 'transparent', color: '#888', padding: '0', marginBottom: '10px', border: 'none', fontSize: '1rem', cursor: 'pointer' }}>← Back to Workouts</button>
        <h1>{isEditMode ? 'Edit Workout Template' : 'Create Workout'}</h1>
      </header>

      <div style={{ marginBottom: '20px' }}>
        <input type="text" placeholder="Routine Name (e.g., Heavy Push Day)" value={name} onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', fontSize: '1.2rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
        {blocks.map((block, blockIndex) => (
          <div key={block.id} style={{ background: block.block_type === 'circuit' ? '#1a1a2e' : '#1e1e1e', border: `1px solid ${block.block_type === 'circuit' ? '#eab308' : '#2d2d2d'}`, borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#fff', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                {block.block_type === 'circuit' ? `🔄 Circuit Block ${blockIndex + 1}` : `📋 Single Exercise Block ${blockIndex + 1}`}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {block.block_type === 'circuit' && (
                  <>
                    <label style={{ color: '#ccc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Rounds
                      <input type="number" min="1" value={block.rounds} onChange={(e) => {
                        const newBlocks = [...blocks];
                        newBlocks[blockIndex].rounds = Number(e.target.value) || 1;
                        setBlocks(newBlocks);
                      }} style={{ width: '50px', padding: '2px', background: '#111', color: '#fff', border: '1px solid #2d2d2d', borderRadius: '4px', textAlign: 'center' }} />
                    </label>
                    <label style={{ color: '#ccc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Round Rest (s)
                      <input type="number" min="0" value={block.round_rest_seconds} onChange={(e) => {
                        const newBlocks = [...blocks];
                        newBlocks[blockIndex].round_rest_seconds = Number(e.target.value) || 0;
                        setBlocks(newBlocks);
                      }} style={{ width: '60px', padding: '2px', background: '#111', color: '#fff', border: '1px solid #2d2d2d', borderRadius: '4px', textAlign: 'center' }} />
                    </label>
                    <label style={{ color: '#ccc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Auto‑advance rounds
                      <input
                        type="checkbox"
                        checked={block.auto_advance_round || false}
                        onChange={(e) => {
                          const newBlocks = [...blocks];
                          newBlocks[blockIndex].auto_advance_round = e.target.checked;
                          setBlocks(newBlocks);
                        }}
                      />
                    </label>
                  </>
                )}
                <button onClick={() => handleRemoveBlock(blockIndex)} style={{ background: 'transparent', color: '#ef4444', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            {/* Exercises inside block */}
            {block.exercises.map((ex, exIndex) => (
              <div key={exIndex} style={{ background: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                {/* Exercise header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>{ex.name}</h4>
                      <select value={ex.tracking_type || 'weight_reps'} onChange={(e) => handleChangeTrackingType(blockIndex, exIndex, e.target.value)}
                        style={{ background: '#111', color: '#ccc', border: '1px solid #333', borderRadius: '6px', padding: '2px 6px', fontSize: '0.75rem', outline: 'none' }}>
                        <option value="weight_reps">Weight & Reps</option>
                        <option value="bodyweight_reps">Reps Only</option>
                        <option value="time">Time Only</option>
                        <option value="time_weight">Weight & Time</option>
                        <option value="distance_time">Distance & Time</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {(ex.tags || []).map((tag, ti) => (
                        <span key={ti} style={{ background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {tag}
                          <button onClick={() => handleRemoveTag(blockIndex, exIndex, ti)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                        </span>
                      ))}
                      <input type="text" placeholder="+ tag" value={tagInputs[`${blockIndex}-${exIndex}`] || ''}
                        onChange={(e) => setTagInputs({ ...tagInputs, [`${blockIndex}-${exIndex}`]: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(blockIndex, exIndex); }}
                        style={{ background: '#111', border: '1px dashed #444', color: '#ccc', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', outline: 'none', width: '80px' }} />
                      {tagInputs[`${blockIndex}-${exIndex}`] && (
                        <button onClick={() => handleAddTag(blockIndex, exIndex)} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '12px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}>Add</button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {exIndex > 0 && <button onClick={() => handleMoveExercise(blockIndex, exIndex, 'up')} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer' }}>↑</button>}
                    {exIndex < block.exercises.length - 1 && <button onClick={() => handleMoveExercise(blockIndex, exIndex, 'down')} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer' }}>↓</button>}
                    <button onClick={() => handleRemoveExercise(blockIndex, exIndex)} style={{ background: 'transparent', color: '#ef4444', border: 'none', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>

                {/* Timer & Auto-advance controls per exercise */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #2d2d2d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ color: '#ccc', fontSize: '0.8rem' }}>Rest (s)</label>
                    <input type="number" min="0" value={ex.rest_seconds ?? 90} onChange={(e) => handleUpdateExerciseField(blockIndex, exIndex, 'rest_seconds', Number(e.target.value) || 0)}
                      style={{ width: '60px', padding: '4px', background: '#111', color: '#fff', border: '1px solid #2d2d2d', borderRadius: '4px', textAlign: 'center' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ color: '#ccc', fontSize: '0.8rem' }}>Timer</label>
                    <select value={ex.timer_mode || 'manual'} onChange={(e) => handleUpdateExerciseField(blockIndex, exIndex, 'timer_mode', e.target.value)}
                      style={{ background: '#111', color: '#ccc', border: '1px solid #333', borderRadius: '4px', padding: '4px', fontSize: '0.8rem' }}>
                      <option value="manual">Manual</option>
                      <option value="countdown">Countdown</option>
                      <option value="stopwatch">Stopwatch</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ color: '#ccc', fontSize: '0.8rem' }}>Auto‑adv</label>
                    <input
                      type="checkbox"
                      checked={ex.auto_advance || false}
                      onChange={(e) => handleUpdateExerciseField(blockIndex, exIndex, 'auto_advance', e.target.checked)}
                    />
                  </div>
                  {ex.timer_mode === 'countdown' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ color: '#ccc', fontSize: '0.8rem' }}>Work (s)</label>
                      <input type="number" min="1" value={ex.work_seconds || ''} onChange={(e) => handleUpdateExerciseField(blockIndex, exIndex, 'work_seconds', e.target.value === '' ? null : Number(e.target.value))}
                        style={{ width: '60px', padding: '4px', background: '#111', color: '#fff', border: '1px solid #2d2d2d', borderRadius: '4px', textAlign: 'center' }} />
                    </div>
                  )}
                </div>

                {/* Sets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ex.sets.map((set, setIndex) => (
                    <div key={setIndex} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: '#888', width: '25px', fontWeight: 'bold' }}>{setIndex + 1}</span>
                      {ex.tracking_type === 'time' ? (
                        <>
                          <input type="number" placeholder="Min" value={set.time_minutes} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'time_minutes', e.target.value)} style={setInputStyle} />
                          <input type="number" placeholder="Sec" value={set.time_seconds} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'time_seconds', e.target.value)} style={setInputStyle} />
                        </>
                      ) : ex.tracking_type === 'bodyweight_reps' ? (
                        <input type="number" placeholder="Reps" value={set.reps} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'reps', e.target.value)} style={setInputStyle} />
                      ) : ex.tracking_type === 'time_weight' ? (
                        <>
                          <input type="number" placeholder={weightUnitLabel} step="0.1" value={set.weight} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'weight', e.target.value)} style={setInputStyle} />
                          <input type="number" placeholder="Min" value={set.time_minutes} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'time_minutes', e.target.value)} style={setInputStyle} />
                          <input type="number" placeholder="Sec" value={set.time_seconds} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'time_seconds', e.target.value)} style={setInputStyle} />
                        </>
                      ) : ex.tracking_type === 'distance_time' ? (
                        <>
                          <input type="number" placeholder="Miles" step="0.1" value={set.distance} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'distance', e.target.value)} style={setInputStyle} />
                          <input type="number" placeholder="Min" value={set.time_minutes} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'time_minutes', e.target.value)} style={setInputStyle} />
                          <input type="number" placeholder="Sec" value={set.time_seconds} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'time_seconds', e.target.value)} style={setInputStyle} />
                        </>
                      ) : (
                        <>
                          <input type="number" placeholder={weightUnitLabel} step="0.1" value={set.weight} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'weight', e.target.value)} style={setInputStyle} />
                          <input type="number" placeholder="Reps" value={set.reps} onChange={(e) => handleUpdateSet(blockIndex, exIndex, setIndex, 'reps', e.target.value)} style={setInputStyle} />
                        </>
                      )}
                      <button onClick={() => handleRemoveSet(blockIndex, exIndex, setIndex)} style={{ background: 'transparent', color: '#666', border: 'none', padding: '10px', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => handleAddSet(blockIndex, exIndex)} style={{ width: '100%', padding: '8px', background: '#111', color: '#4ade80', border: '1px dashed #2d2d2d', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ Add Set</button>
                </div>
              </div>
            ))}

            {/* Add exercise to this block */}
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={(e) => { handleAddExerciseToBlock(e, blockIndex); }}
                disabled={!exerciseInput.trim()}
                style={{
                  background: exerciseInput.trim() ? '#2563eb' : '#333',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',   // slightly larger
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: exerciseInput.trim() ? 'pointer' : 'not-allowed',
                  width: '100%',
                  fontSize: '0.95rem'
                }}
              >
                Add to Block
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Global Add Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Type custom or pick..." value={exerciseInput} onChange={(e) => { setExerciseInput(e.target.value); setSelectedExerciseId(null); }}
          style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', fontSize: '1rem', outline: 'none' }} />
        <button onClick={() => setIsModalOpen(true)} style={{ background: '#1e1e1e', border: '1px solid #2d2d2d', color: '#fff', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Browse</button>
        <button onClick={handleAddExerciseToBlock} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Add Exercise</button>
        <button onClick={() => handleAddBlock('single')} style={{ background: '#333', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>+ Single Block</button>
        <button onClick={() => handleAddBlock('circuit')} style={{ background: '#eab308', color: '#111', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>+ Circuit</button>
      </div>

      <button onClick={handleSaveTemplate} style={{ width: '100%', padding: '20px', background: '#4ade80', color: '#111', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
        {isEditMode ? 'Save Changes' : 'Save Template'}
      </button>

      {/* Exercise Library Modal (unchanged) */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#1e1e1e', width: '100%', maxWidth: '480px', maxHeight: '85vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #2d2d2d' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #2d2d2d', background: '#111' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input type="text" placeholder="Search by name..." value={modalSearchTerm} onChange={(e) => setModalSearchTerm(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', outline: 'none' }} autoFocus />
                <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', color: '#ef4444', padding: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select value={selectedBodyPart} onChange={(e) => setSelectedBodyPart(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', outline: 'none' }}>
                  <option value="">All Body Parts</option>
                  {uniqueBodyParts.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                </select>
                <select value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #2d2d2d', background: '#1e1e1e', color: '#fff', outline: 'none' }}>
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
                    <div onClick={() => handleSelectFromModal(ex)} style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

const setInputStyle = {
  flex: 1,
  minWidth: 0,
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #2d2d2d',
  background: '#111',
  color: '#fff',
  textAlign: 'center'
};