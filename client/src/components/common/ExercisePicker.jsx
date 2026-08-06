import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { fetchWithAuth } from '../../apiClient';

// Shared dark-theme tokens, matching CreateTemplate.jsx / WorkoutDetail.jsx
const C = {
  bg: '#111',
  panel: '#1e1e1e',
  border: '#2d2d2d',
  text: '#fff',
  muted: '#888',
  badge: '#333',
  badgeText: '#ccc',
  accent: '#2563eb',
  green: '#4ade80',
  red: '#ef4444',
};

/**
 * ExercisePicker
 *
 * Two ways in:
 *  1. Textbox — autocompletes against the priority pile. Typing a name
 *     and pressing Enter confirms it (creates or matches server-side).
 *  2. Browse button -> modal with My Exercises / All Exercises tabs,
 *     search, and body-part/equipment filters (same as the old library
 *     modal).
 *
 * Selecting from either path calls onSelect(exercise) and populates the
 * textbox with the selected title (so it visibly reflects the current
 * pick), rather than clearing it — pass clearAfterSelect to restore the
 * old "clear after adding" behavior for flows like the template builder
 * where you add several different exercises in a row.
 *
 * Exposes a ref API — resolveCurrent() — for parents whose "confirm"
 * action is a separate submit button rather than the picker itself.
 * Calling it resolves whatever is currently typed (even if the user never
 * pressed Enter or clicked a suggestion) into a real exercise, creating
 * or matching it server-side as needed, and returns it (or null if the
 * box is empty). See WorkoutDetail.jsx for the calling pattern.
 */
const ExercisePicker = forwardRef(function ExercisePicker({
  onSelect,
  apiBase = '/api/v1/exercises', // must match how your router is mounted
  placeholder = 'Type custom or pick…',
  trackUsageOnSelect = true,
  clearAfterSelect = false,
}, ref) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The last exercise we actually confirmed (via selection or create/match),
  // and the exact title string that confirmation corresponds to. Lets
  // resolveCurrent() skip a redundant network round-trip when the box
  // still shows what was last confirmed (e.g. logging a 2nd/3rd set of
  // the same exercise in a row).
  const [lastConfirmed, setLastConfirmed] = useState(null); // { title, exercise }

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('mine'); // 'mine' | 'all'
  const [libraryCache, setLibraryCache] = useState({ mine: null, all: null });
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');

  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // --- Autocomplete (priority pile) --------------------------------------

  const fetchSuggestions = useCallback(async (query) => {
    try {
      const url = query
        ? `${apiBase}/priority?q=${encodeURIComponent(query)}`
        : `${apiBase}/priority`;
      const res = await fetchWithAuth(url);
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data);
    } catch {
      // autocomplete is a nice-to-have, fail silently
    }
  }, [apiBase]);

  function handleInputChange(e) {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 200);
  }

  async function trackUsage(exerciseId) {
    if (!trackUsageOnSelect) return;
    try {
      await fetchWithAuth(`${apiBase}/${exerciseId}/track-usage`, { method: 'POST' });
    } catch {
      // non-critical
    }
  }

  function selectExercise(exercise) {
    onSelect(exercise);
    trackUsage(exercise.id);
    setInputValue(clearAfterSelect ? '' : exercise.title);
    setLastConfirmed({ title: exercise.title, exercise });
    setSuggestions([]);
    setShowSuggestions(false);
    setModalOpen(false);
  }

  // Creates a custom exercise for the typed title, or matches an existing
  // one (case-insensitive) server-side. Returns the exercise, or null on
  // failure/empty input.
  async function handleSubmitCustom() {
    const title = inputValue.trim();
    if (!title || submitting) return null;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(apiBase, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to create exercise');
      const exercise = await res.json();
      selectExercise(exercise);
      return exercise;
    } catch {
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exact = suggestions.find(
        (s) => s.title.toLowerCase() === inputValue.trim().toLowerCase()
      );
      if (exact) {
        selectExercise(exact);
      } else {
        handleSubmitCustom();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  // Imperative API for parents with a separate confirm/submit button
  // (e.g. WorkoutDetail's "Log Set"). Resolves whatever is currently
  // typed into a real exercise — via cache, an exact suggestion match, or
  // create-or-match — regardless of whether the user ever pressed Enter.
  useImperativeHandle(ref, () => ({
    async resolveCurrent() {
      const title = inputValue.trim();
      if (!title) return null;

      if (lastConfirmed && lastConfirmed.title.toLowerCase() === title.toLowerCase()) {
        return lastConfirmed.exercise;
      }

      const exact = suggestions.find(
        (s) => s.title.toLowerCase() === title.toLowerCase()
      );
      if (exact) {
        selectExercise(exact);
        return exact;
      }

      return await handleSubmitCustom();
    },
  }));

  // --- Library modal ------------------------------------------------------

  const loadLibraryTab = useCallback(async (tab) => {
    if (libraryCache[tab]) return;
    setLibraryLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBase}/library?scope=${tab}`);
      if (!res.ok) return;
      const data = await res.json();
      setLibraryCache((prev) => ({ ...prev, [tab]: data }));
    } finally {
      setLibraryLoading(false);
    }
  }, [apiBase, libraryCache]);

  function openModal() {
    setModalOpen(true);
    loadLibraryTab(activeTab);
  }

  function switchTab(tab) {
    setActiveTab(tab);
    setModalSearchTerm('');
    setSelectedBodyPart('');
    setSelectedEquipment('');
    loadLibraryTab(tab);
  }

  function handleSelectFromModal(ex) {
    selectExercise(ex);
    setModalSearchTerm('');
    setSelectedBodyPart('');
    setSelectedEquipment('');
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentList = libraryCache[activeTab] || [];
  const uniqueBodyParts = [...new Set(currentList.map((ex) => ex.body_part).filter(Boolean))].sort();
  const uniqueEquipment = [...new Set(currentList.map((ex) => ex.equipment).filter(Boolean))].sort();
  const filteredLibrary = currentList
    .filter((ex) => {
      const matchesSearch =
        ex.title.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        ex.body_part?.toLowerCase().includes(modalSearchTerm.toLowerCase());
      const matchesBodyPart = selectedBodyPart === '' || ex.body_part === selectedBodyPart;
      const matchesEquipment = selectedEquipment === '' || ex.equipment === selectedEquipment;
      return matchesSearch && matchesBodyPart && matchesEquipment;
    })
    .slice(0, 100);

  // --- Shared inline styles -----------------------------------------------

  const inputStyle = {
    flex: 1,
    minWidth: '200px',
    padding: '12px',
    borderRadius: '8px',
    border: `1px solid ${C.border}`,
    background: C.panel,
    color: C.text,
    fontSize: '1rem',
    outline: 'none',
  };

  const browseBtnStyle = {
    background: C.panel,
    border: `1px solid ${C.border}`,
    color: C.text,
    padding: '0 20px',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  };

  function tabStyle(active) {
    return {
      flex: 1,
      textAlign: 'center',
      padding: '10px',
      background: 'transparent',
      border: 'none',
      borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
      color: active ? C.text : C.muted,
      fontWeight: active ? 'bold' : 'normal',
      fontSize: '0.9rem',
      cursor: 'pointer',
    };
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={submitting}
            style={{ ...inputStyle, width: '100%', minWidth: 0, boxSizing: 'border-box' }}
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                maxHeight: '240px',
                overflowY: 'auto',
                zIndex: 50,
                listStyle: 'none',
                margin: 0,
                padding: '4px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
            >
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selectExercise(s)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: C.text,
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.95rem',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{s.title}</span>
                    {s.is_custom && (
                      <span style={{ color: C.muted, fontSize: '0.7rem' }}>custom</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" onClick={openModal} style={browseBtnStyle}>
          Browse
        </button>
      </div>

      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.panel,
              width: '100%',
              maxWidth: '480px',
              maxHeight: '85vh',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
            }}
          >
            <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
              {/* Tabs */}
              <div style={{ display: 'flex', marginBottom: '12px', borderBottom: `1px solid ${C.border}` }}>
                <button type="button" onClick={() => switchTab('mine')} style={tabStyle(activeTab === 'mine')}>
                  My Exercises
                </button>
                <button type="button" onClick={() => switchTab('all')} style={tabStyle(activeTab === 'all')}>
                  All Exercises
                </button>
              </div>

              {/* Search + close */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  autoFocus
                  style={{ ...inputStyle, minWidth: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ background: 'transparent', color: C.red, padding: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={selectedBodyPart}
                  onChange={(e) => setSelectedBodyPart(e.target.value)}
                  style={{ ...inputStyle, minWidth: 0 }}
                >
                  <option value="">All Body Parts</option>
                  {uniqueBodyParts.map((bp) => (
                    <option key={bp} value={bp}>{bp}</option>
                  ))}
                </select>
                <select
                  value={selectedEquipment}
                  onChange={(e) => setSelectedEquipment(e.target.value)}
                  style={{ ...inputStyle, minWidth: 0 }}
                >
                  <option value="">All Equipment</option>
                  {uniqueEquipment.map((eq) => (
                    <option key={eq} value={eq}>{eq}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '10px' }}>
              {libraryLoading && !libraryCache[activeTab] ? (
                <p style={{ textAlign: 'center', padding: '20px', color: C.muted }}>Loading…</p>
              ) : filteredLibrary.length > 0 ? (
                filteredLibrary.map((ex) => (
                  <div key={ex.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <div
                      onClick={() => handleSelectFromModal(ex)}
                      style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <span style={{ fontWeight: 'bold', color: C.text, display: 'block' }}>{ex.title}</span>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {ex.body_part && (
                            <span style={{ background: C.badge, color: C.badgeText, fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}>
                              {ex.body_part}
                            </span>
                          )}
                          {ex.equipment && (
                            <span style={{ background: C.badge, color: C.badgeText, fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}>
                              {ex.equipment}
                            </span>
                          )}
                          {activeTab === 'all' && ex.is_custom && (
                            <span style={{ background: C.accent, color: '#fff', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}>
                              custom
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', padding: '20px', color: C.muted }}>
                  {activeTab === 'mine' ? "You haven't created any custom exercises yet." : 'No exercises found.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ExercisePicker;