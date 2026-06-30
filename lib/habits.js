// All habits in order — morning to night
// Each has: key (DB field), label, emoji, time-of-day group, description

export const HABITS = [
  { key: 'wake_breakfast', label: 'Wake Up & Breakfast',  emoji: '🌅', group: 'Morning',   desc: 'Start the day right' },
  { key: 'muesli',         label: 'Muesli',               emoji: '🥣', group: 'Morning',   desc: 'Healthy bowl' },
  { key: 'gym',            label: 'Gym',                  emoji: '🏋️', group: 'Active',    desc: 'Training session' },
  { key: 'protein',        label: 'Chicken / Egg',        emoji: '🍗', group: 'Active',    desc: 'Protein intake' },
  { key: 'lunch',          label: 'Lunch',                emoji: '🍽️', group: 'Afternoon', desc: 'Midday meal' },
  { key: 'banana_shake',   label: 'Banana Shake',         emoji: '🍌', group: 'Evening',   desc: 'Evening boost' },
  { key: 'rapido',         label: 'Rapido',               emoji: '🛵', group: 'Evening',   desc: 'Riding today' },
  { key: 'night_food',     label: 'Night Food',           emoji: '🌙', group: 'Night',     desc: 'Dinner' },
  { key: 'night_curd',     label: 'Night Curd',           emoji: '🥛', group: 'Night',     desc: 'Probiotic' },
  { key: 'face_care',      label: 'Face Care',            emoji: '🧴', group: 'All Day',   desc: 'Skincare routine' },
  { key: 'water',          label: 'Water — 3L',           emoji: '💧', group: 'All Day',   desc: 'Stay hydrated' },
];

export const HABIT_KEYS = HABITS.map(h => h.key);

export const GROUP_ORDER = ['Morning', 'Active', 'Afternoon', 'Evening', 'Night', 'All Day'];

export const GROUP_COLORS = {
  Morning:   { bg: '#fff8e6', border: '#f59f00', text: '#b37400', dot: '#f59f00' },
  Active:    { bg: '#ede8ff', border: '#6c63ff', text: '#4b44cc', dot: '#6c63ff' },
  Afternoon: { bg: '#e6f9f4', border: '#00b894', text: '#007a62', dot: '#00b894' },
  Evening:   { bg: '#fff0fa', border: '#e84393', text: '#a8005e', dot: '#e84393' },
  'All Day': { bg: '#e6f6ff', border: '#00b4d8', text: '#006e8a', dot: '#00b4d8' },
  Night:     { bg: '#eeeeff', border: '#4361ee', text: '#2c3ea6', dot: '#4361ee' },
};

export function groupHabits() {
  const groups = {};
  GROUP_ORDER.forEach(g => { groups[g] = []; });
  HABITS.forEach(h => { groups[h.group].push(h); });
  return groups;
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function getStreakCount(logs) {
  // logs: array of { date, completed_count } sorted desc
  if (!logs || logs.length === 0) return 0;
  let streak = 0;
  const today = toDateStr(new Date());
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = toDateStr(cursor);
    const log = logs.find(l => l.date === ds);
    // skip today if not yet done
    if (ds === today && (!log || log.completed_count === 0)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (log && log.completed_count > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
