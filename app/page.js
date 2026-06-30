'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { HABITS, GROUP_ORDER, GROUP_COLORS, toDateStr, getStreakCount } from '@/lib/habits';

const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const GROUP_CSS = {
  Morning:'morning', Active:'active', Afternoon:'afternoon',
  Evening:'evening', 'All Day':'allday', Night:'night',
};

const LS_KEY = 'mee_custom_habits';

function loadHabits() {
  if (typeof window === 'undefined') return HABITS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return HABITS;
}

function buildGroups(habitList) {
  const groups = {};
  GROUP_ORDER.forEach(g => { groups[g] = []; });
  habitList.forEach(h => {
    const g = h.group || 'All Day';
    if (!groups[g]) groups[g] = [];
    groups[g].push(h);
  });
  return groups;
}

export default function TodayPage() {
  const [dateStr,    setDateStr]    = useState('');
  const [dateLabel,  setDateLabel]  = useState('');
  const [completed,  setCompleted]  = useState({});
  const [saving,     setSaving]     = useState({});
  const [loading,    setLoading]    = useState(true);
  const [streak,     setStreak]     = useState(0);
  const [toast,      setToast]      = useState(null);

  // Custom habits (from localStorage)
  const [habits,     setHabits]     = useState(HABITS);

  // Edit mode
  const [editMode,   setEditMode]   = useState(false);
  const [editHabits, setEditHabits] = useState([]);

  // Drag state
  const dragItem     = useRef(null);
  const dragOverItem = useRef(null);
  const [overIdx,    setOverIdx]    = useState(null);

  // Daily note
  const [note,       setNote]       = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved,  setNoteSaved]  = useState(false);
  const debounceRef  = useRef(null);

  // Load custom habits from localStorage on mount
  useEffect(() => {
    setHabits(loadHabits());
  }, []);

  // Init date client-side only
  useEffect(() => {
    const now = new Date();
    setDateStr(toDateStr(now));
    setDateLabel(`${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
  }, []);

  const fetchToday = useCallback(async () => {
    if (!supabase || !dateStr) return;
    setLoading(true);
    const { data } = await supabase.from('habit_logs').select('habit_key, completed').eq('date', dateStr);
    const map = {};
    (data || []).forEach(r => { map[r.habit_key] = r.completed; });
    setCompleted(map);
    setLoading(false);
  }, [dateStr]);

  const fetchNote = useCallback(async () => {
    if (!supabase || !dateStr) return;
    const { data } = await supabase.from('daily_notes').select('note').eq('date', dateStr).maybeSingle();
    setNote(data?.note || '');
  }, [dateStr]);

  const fetchStreak = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('habit_logs').select('date, completed').eq('completed', true).order('date', { ascending: false });
    if (!data) return;
    const dateMap = {};
    data.forEach(r => { dateMap[r.date] = (dateMap[r.date] || 0) + 1; });
    const logs = Object.entries(dateMap).map(([date, completed_count]) => ({ date, completed_count }));
    setStreak(getStreakCount(logs));
  }, []);

  useEffect(() => { fetchToday(); },  [fetchToday]);
  useEffect(() => { fetchNote(); },   [fetchNote]);
  useEffect(() => { fetchStreak(); }, [fetchStreak]);

  async function toggleHabit(habitKey) {
    if (!supabase || !dateStr) return;
    const newVal = !completed[habitKey];
    setCompleted(prev => ({ ...prev, [habitKey]: newVal }));
    setSaving(prev => ({ ...prev, [habitKey]: true }));
    const { error } = await supabase.from('habit_logs').upsert(
      { date: dateStr, habit_key: habitKey, completed: newVal, updated_at: new Date().toISOString() },
      { onConflict: 'date,habit_key' }
    );
    setSaving(prev => ({ ...prev, [habitKey]: false }));
    if (error) {
      setCompleted(prev => ({ ...prev, [habitKey]: !newVal }));
      showToast('Failed to save ✗', 'error');
    } else { fetchStreak(); }
  }

  function handleNoteChange(val) {
    setNote(val); setNoteSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(val), 1200);
  }

  async function saveNote(text) {
    if (!supabase || !dateStr) return;
    setNoteSaving(true);
    await supabase.from('daily_notes').upsert({ date: dateStr, note: text, updated_at: new Date().toISOString() }, { onConflict: 'date' });
    setNoteSaving(false); setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // ── EDIT MODE ──
  function enterEdit() {
    setEditHabits(habits.map(h => ({ ...h })));
    setEditMode(true);
  }
  function cancelEdit() { setEditMode(false); setOverIdx(null); }

  function saveEdit() {
    const cleaned = editHabits.filter(h => h.label.trim());
    localStorage.setItem(LS_KEY, JSON.stringify(cleaned));
    setHabits(cleaned);
    setEditMode(false);
    setOverIdx(null);
    showToast('Habits saved ✓');
  }

  function updateHabit(idx, field, val) {
    setEditHabits(prev => prev.map((h, i) => i === idx ? { ...h, [field]: val } : h));
  }

  function addHabit() {
    setEditHabits(prev => [...prev, {
      key: `custom_${Date.now()}`,
      label: '',
      emoji: '✨',
      group: 'All Day',
      desc: '',
    }]);
  }

  function removeHabit(idx) {
    setEditHabits(prev => prev.filter((_, i) => i !== idx));
  }

  function moveUp(idx) {
    if (idx === 0) return;
    setEditHabits(prev => {
      const a = [...prev];
      [a[idx-1], a[idx]] = [a[idx], a[idx-1]];
      return a;
    });
  }

  function moveDown(idx) {
    setEditHabits(prev => {
      if (idx === prev.length - 1) return prev;
      const a = [...prev];
      [a[idx], a[idx+1]] = [a[idx+1], a[idx]];
      return a;
    });
  }

  // Drag handlers
  function onDragStart(e, idx) {
    dragItem.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
    e.dataTransfer.setData('text/plain', idx);
  }
  function onDragEnter(idx) {
    if (dragItem.current === idx) return;
    dragOverItem.current = idx;
    setOverIdx(idx);
  }
  function onDragOver(e) { e.preventDefault(); }
  function onDrop(e) {
    e.preventDefault();
    const from = dragItem.current;
    const to   = dragOverItem.current;
    if (from === null || to === null || from === to) return;
    setEditHabits(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    dragItem.current = null;
    dragOverItem.current = null;
    setOverIdx(null);
  }
  function onDragEnd() {
    dragItem.current = null;
    dragOverItem.current = null;
    setOverIdx(null);
  }

  // View mode derived values
  const doneCount  = habits.filter(h => completed[h.key]).length;
  const totalCount = habits.length;
  const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const grouped    = buildGroups(habits);
  const hour       = new Date().getHours();
  const greet      = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const skipped    = habits.filter(h => !completed[h.key]);

  return (
    <>
      <Navbar />
      <main className="page">
        <div className="container">

          {/* ── PROGRESS CARD ── */}
          <div className="progress-card">
            <div className="progress-top">
              <div className="progress-greeting">
                {greet}, Mokesh 👋
                <span>{dateLabel}</span>
              </div>
              <div className="progress-count">
                <div className="big">{doneCount}<span>/{totalCount}</span></div>
                <div className="sub">habits done</div>
              </div>
            </div>
            <div className="progress-bar-wrap">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-bar-labels">
                <span>0%</span>
                <span style={{ color: pct === 100 ? '#00b894' : undefined }}>
                  {pct === 100 ? '🎉 Perfect day!' : `${pct}% complete`}
                </span>
                <span>100%</span>
              </div>
            </div>
            {streak >= 2 && <div className="streak-badge">🔥 {streak} day streak!</div>}
          </div>

          {/* ── HABITS SECTION HEADER ── */}
          <div className="habits-section-header">
            <div className="habits-section-title">
              {editMode ? '✏️ Edit Habits' : "Today's Habits"}
            </div>
            {!loading && (
              editMode ? (
                <div style={{ display:'flex', gap:8 }}>
                  <button className="edit-cancel-btn" onClick={cancelEdit}>✕ Cancel</button>
                  <button className="edit-save-btn"   onClick={saveEdit}>✓ Save</button>
                </div>
              ) : (
                <button className="edit-toggle-btn" onClick={enterEdit}>✏️ Edit</button>
              )
            )}
          </div>

          {/* ── LOADING ── */}
          {loading && (
            <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)', fontSize:'0.9rem' }}>
              Loading your habits…
            </div>
          )}

          {/* ── VIEW MODE ── */}
          {!loading && !editMode && (
            GROUP_ORDER.map(group => {
              const list = grouped[group];
              if (!list || list.length === 0) return null;
              const colors = GROUP_COLORS[group];
              return (
                <div key={group}>
                  <div className={`section-label ${GROUP_CSS[group]}`}>{group}</div>
                  {list.map(habit => {
                    const isDone   = !!completed[habit.key];
                    const isSaving = !!saving[habit.key];
                    return (
                      <div
                        key={habit.key}
                        id={`habit-${habit.key}`}
                        className={`habit-card ${isDone ? 'done' : ''}`}
                        onClick={() => !isSaving && toggleHabit(habit.key)}
                        role="checkbox" aria-checked={isDone}
                      >
                        <div className="habit-emoji-wrap" style={{ background: colors.bg, border: `1.5px solid ${colors.border}20` }}>
                          {habit.emoji}
                        </div>
                        <div className="habit-info">
                          <div className="habit-label">{habit.label}</div>
                          <div className="habit-desc">{habit.desc}</div>
                        </div>
                        {isSaving
                          ? <div className="habit-saving" />
                          : <div className="habit-check">{isDone ? '✓' : ''}</div>
                        }
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}

          {/* ── EDIT MODE ── */}
          {!loading && editMode && (
            <div className="edit-list">
              {editHabits.map((h, idx) => (
                <div
                  key={h.key}
                  className={`edit-row ${overIdx === idx ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={e => onDragStart(e, idx)}
                  onDragEnter={() => onDragEnter(idx)}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                >
                  {/* Drag handle */}
                  <div className="drag-handle" title="Drag to reorder">⠿</div>

                  {/* Emoji */}
                  <input
                    className="edit-emoji-input"
                    value={h.emoji}
                    onChange={e => updateHabit(idx, 'emoji', e.target.value)}
                    maxLength={4}
                    title="Emoji"
                  />

                  {/* Label */}
                  <input
                    className="edit-label-input"
                    value={h.label}
                    placeholder="Habit name…"
                    onChange={e => updateHabit(idx, 'label', e.target.value)}
                  />

                  {/* Move up/down (mobile friendly) */}
                  <div className="move-btns">
                    <button className="move-btn" onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">↑</button>
                    <button className="move-btn" onClick={() => moveDown(idx)} disabled={idx === editHabits.length - 1} title="Move down">↓</button>
                  </div>

                  {/* Delete */}
                  <button className="delete-habit-btn" onClick={() => removeHabit(idx)} title="Remove habit">✕</button>
                </div>
              ))}

              {/* Add new habit */}
              <button className="add-habit-btn" onClick={addHabit}>
                + Add Habit
              </button>

              {/* Save / Cancel at bottom too */}
              <div className="edit-bottom-actions">
                <button className="edit-cancel-btn" onClick={cancelEdit}>✕ Cancel</button>
                <button className="edit-save-btn"   onClick={saveEdit}>✓ Save Changes</button>
              </div>
            </div>
          )}

          {/* Perfect day */}
          {!loading && !editMode && doneCount === totalCount && totalCount > 0 && (
            <div className="perfect-banner">
              <div style={{ fontSize:'2rem', marginBottom:'0.4rem' }}>🏆</div>
              <div style={{ fontWeight:800, color:'var(--success)', fontSize:'1.05rem' }}>Perfect Day!</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.8rem', marginTop:'4px' }}>All {totalCount} habits done. Killing it, Mokesh!</div>
            </div>
          )}

          {/* ── TODAY'S NOTE ── */}
          {!loading && !editMode && (
            <div className="note-card">
              <div className="note-card-header">
                <div className="note-card-title">
                  📝 Today's Note
                  {skipped.length > 0 && <span className="note-skipped-count">{skipped.length} skipped</span>}
                </div>
                <div className="note-save-status">
                  {noteSaving && <span className="note-saving-text">saving…</span>}
                  {noteSaved  && <span className="note-saved-text">✓ saved</span>}
                </div>
              </div>
              {skipped.length > 0 && (
                <div className="note-skipped-chips">
                  {skipped.map(h => <span key={h.key} className="note-chip">{h.emoji} {h.label}</span>)}
                </div>
              )}
              <textarea
                id="today-note"
                className="note-textarea"
                placeholder={
                  skipped.length > 0
                    ? `Why did you skip ${skipped.map(h => h.label).join(', ')}? Any reason…`
                    : 'Write anything about today — how you felt, what went well…'
                }
                value={note}
                onChange={e => handleNoteChange(e.target.value)}
                rows={4}
              />
              <div className="note-hint">Auto-saves as you type</div>
            </div>
          )}

        </div>
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
