'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { HABITS, toDateStr } from '@/lib/habits';

const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TOTAL = HABITS.length;

export default function CalendarPage() {
  const [todayStr,   setTodayStr]   = useState('');
  const [viewYear,   setViewYear]   = useState(new Date().getFullYear());
  const [viewMonth,  setViewMonth]  = useState(new Date().getMonth());
  const [selected,   setSelected]   = useState('');
  const [monthData,  setMonthData]  = useState({}); // { date: { key: bool } }
  const [selectedLog,setSelectedLog]= useState({}); // { key: bool } for selected date
  const [saving,     setSaving]     = useState({});
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null);
  const [note,       setNote]       = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved,  setNoteSaved]  = useState(false);
  const debounceRef  = useRef(null);

  useEffect(() => {
    const now = new Date();
    const s = toDateStr(now);
    setTodayStr(s);
    setSelected(s);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  }, []);

  // Fetch all logs for the viewed month
  const fetchMonth = useCallback(async () => {
    if (!supabase) return setLoading(false);
    setLoading(true);
    const mm = String(viewMonth + 1).padStart(2, '0');
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const { data } = await supabase
      .from('habit_logs')
      .select('date, habit_key, completed')
      .gte('date', `${viewYear}-${mm}-01`)
      .lte('date', `${viewYear}-${mm}-${lastDay}`);

    // Build map: { date: { habit_key: bool } }
    const map = {};
    (data || []).forEach(row => {
      if (!map[row.date]) map[row.date] = {};
      map[row.date][row.habit_key] = row.completed;
    });
    setMonthData(map);
    setLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  // When selected date changes, sync selectedLog from monthData
  useEffect(() => {
    setSelectedLog(monthData[selected] || {});
  }, [selected, monthData]);

  // Fetch note for selected date
  const fetchNote = useCallback(async () => {
    if (!supabase || !selected) return;
    setNote('');
    const { data } = await supabase.from('daily_notes').select('note').eq('date', selected).maybeSingle();
    setNote(data?.note || '');
  }, [selected]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  function handleNoteChange(val) {
    setNote(val); setNoteSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(val), 1200);
  }

  async function saveNote(text) {
    if (!supabase || !selected) return;
    setNoteSaving(true);
    await supabase.from('daily_notes').upsert(
      { date: selected, note: text, updated_at: new Date().toISOString() },
      { onConflict: 'date' }
    );
    setNoteSaving(false); setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  async function toggleHabit(habitKey) {
    if (!supabase || !selected) return;
    const newVal = !selectedLog[habitKey];

    // Optimistic update
    setSelectedLog(prev => ({ ...prev, [habitKey]: newVal }));
    setMonthData(prev => ({
      ...prev,
      [selected]: { ...(prev[selected] || {}), [habitKey]: newVal }
    }));
    setSaving(prev => ({ ...prev, [habitKey]: true }));

    const { error } = await supabase
      .from('habit_logs')
      .upsert(
        { date: selected, habit_key: habitKey, completed: newVal, updated_at: new Date().toISOString() },
        { onConflict: 'date,habit_key' }
      );

    setSaving(prev => ({ ...prev, [habitKey]: false }));

    if (error) {
      setSelectedLog(prev => ({ ...prev, [habitKey]: !newVal }));
      showToast('Save failed ✗', 'error');
    }
  }

  function showToast(msg, type='success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11); }
    else setViewMonth(m => m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0); }
    else setViewMonth(m => m+1);
  }

  // Build calendar cells
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDay     = firstOfMonth.getDay();
  const daysInMonth  = new Date(viewYear, viewMonth+1, 0).getDate();
  const daysInPrev   = new Date(viewYear, viewMonth, 0).getDate();
  const cells = [];
  for (let i = startDay-1; i >= 0; i--) cells.push({ day: daysInPrev-i, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length-startDay-daysInMonth+1, current: false });

  // Count completed habits per date
  function doneCount(dateS) {
    const log = monthData[dateS] || {};
    return Object.values(log).filter(Boolean).length;
  }

  // Month stats
  const daysWithData = Object.keys(monthData).filter(d => doneCount(d) > 0);
  const avgPct = daysWithData.length > 0
    ? Math.round(daysWithData.reduce((s,d) => s + doneCount(d), 0) / (daysWithData.length * TOTAL) * 100)
    : 0;
  const perfectDays = daysWithData.filter(d => doneCount(d) === TOTAL).length;

  const selectedDateObj = selected ? new Date(selected + 'T00:00:00') : null;
  const selectedLabel = selectedDateObj
    ? selectedDateObj.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })
    : 'Select a date';
  const selDone  = doneCount(selected);

  return (
    <>
      <Navbar />
      <main className="page">
        <div className="container">

          <div style={{ padding:'1.1rem 0 0.5rem' }}>
            <h1 style={{ fontSize:'clamp(1.2rem,5vw,1.7rem)', fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
              📅 Habit Calendar
            </h1>
            <p style={{ color:'var(--text-muted)', marginTop:4, fontSize:'0.8rem' }}>
              Tap any date to view or edit habits
            </p>
          </div>

          {/* ── MONTH STATS ── */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Days Tracked</div>
              <div className={`stat-value ${daysWithData.length > 0 ? 'good' : ''}`}>{daysWithData.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Completion</div>
              <div className={`stat-value ${avgPct >= 70 ? 'good' : avgPct >= 40 ? 'warn' : ''}`}>{avgPct}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Perfect Days 🏆</div>
              <div className={`stat-value ${perfectDays > 0 ? 'good' : ''}`}>{perfectDays}</div>
            </div>
          </div>

          {/* ── CALENDAR + DAY PANEL ── */}
          <div className="cal-layout" style={{ alignItems:'start' }}>

            {/* Calendar */}
            <div className="cal-wrapper">
              <div className="cal-nav">
                <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
                <div className="cal-nav-title">{MONTHS_FULL[viewMonth]} {viewYear}</div>
                <button className="cal-nav-btn" onClick={nextMonth}>›</button>
              </div>
              <div className="cal-grid">
                <div className="cal-weekdays">
                  {WEEKDAYS_SHORT.map(d => <div className="cal-weekday" key={d}>{d}</div>)}
                </div>
                <div className="cal-days">
                  {cells.map((cell, idx) => {
                    if (!cell.current) return <div key={idx} className="cal-day other-month"><span>{cell.day}</span></div>;
                    const ds = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`;
                    const isToday    = ds === todayStr;
                    const isSelected = ds === selected;
                    const done = doneCount(ds);
                    const pipClass = done === TOTAL ? 'pip-full' : done >= Math.ceil(TOTAL/2) ? 'pip-partial' : done > 0 ? 'pip-low' : '';
                    return (
                      <div
                        key={idx}
                        className={`cal-day ${isToday?'today':''} ${isSelected?'selected':''}`}
                        onClick={() => setSelected(ds)}
                        id={`cal-${ds}`}
                      >
                        <span style={{ fontWeight: isToday||isSelected ? 800 : 500, fontSize:'0.82rem' }}>{cell.day}</span>
                        {pipClass && <div className={`cal-pip ${pipClass}`} title={`${done}/${TOTAL} done`} />}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Legend */}
              <div style={{ display:'flex', gap:16, padding:'0.6rem 1rem', borderTop:'1px solid var(--border)', flexWrap:'wrap' }}>
                {[
                  { cls:'pip-full',    label:`All ${TOTAL}` },
                  { cls:'pip-partial', label:'Half+' },
                  { cls:'pip-low',     label:'Some' },
                ].map(l => (
                  <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.65rem', color:'var(--text-muted)', fontWeight:600 }}>
                    <div className={`cal-pip ${l.cls}`} style={{ width:20 }} />{l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Day Panel */}
            <div className="day-panel">
              <div className="day-panel-header">
                <div>
                  <div className="day-panel-title">{selectedLabel}</div>
                  <div className="day-panel-sub">
                    {selDone > 0 ? `${selDone} / ${TOTAL} done` : 'Nothing tracked yet'}
                  </div>
                </div>
                {selDone === TOTAL && (
                  <div style={{ fontSize:'1.3rem' }}>🏆</div>
                )}
              </div>

              {loading ? (
                <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem' }}>Loading…</div>
              ) : (
                HABITS.map(habit => {
                  const isDone = !!selectedLog[habit.key];
                  const isSaving = !!saving[habit.key];
                  return (
                    <div
                      key={habit.key}
                      className={`mini-habit-row ${isDone ? 'done' : ''}`}
                      onClick={() => !isSaving && toggleHabit(habit.key)}
                      id={`cal-habit-${habit.key}`}
                    >
                      <span className="mini-emoji">{habit.emoji}</span>
                      <span className="mini-label">{habit.label}</span>
                      {isSaving ? (
                        <div className="habit-saving" style={{ width:22, height:22 }} />
                      ) : (
                        <div className="mini-check">{isDone ? '✓' : ''}</div>
                      )}
                    </div>
                  );
                })
              )}

              {/* ── DAY NOTE ── */}
              {!loading && (
                <div className="day-note-section">
                  <div className="day-note-header">
                    <span>📝 Note</span>
                    <span className="day-note-status">
                      {noteSaving && <span style={{ color:'var(--text-muted)', fontSize:'0.7rem' }}>saving…</span>}
                      {noteSaved  && <span style={{ color:'var(--success)',    fontSize:'0.7rem' }}>✓ saved</span>}
                    </span>
                  </div>
                  <textarea
                    className="day-note-textarea"
                    placeholder="Any note for this day…"
                    value={note}
                    onChange={e => handleNoteChange(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
