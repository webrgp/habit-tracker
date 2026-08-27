import {
  dateKey,
  lastNDays,
  weekStart,
  countInWeek,
  dailyStreak,
  weeklyStreak,
} from './streak.js';
import { load, save, storageAvailable } from './store.js';

const WINDOW = 7;

const state = load();
const canStore = storageAvailable();

const todayLabel = document.getElementById('today-label');
const form = document.getElementById('add-habit');
const nameInput = document.getElementById('habit-name');
const cadenceInput = document.getElementById('habit-cadence');
const targetField = document.getElementById('target-field');
const targetInput = document.getElementById('habit-target');
const list = document.getElementById('habits');

function doneDays(habitId) {
  return new Set(Object.keys(state.entries[habitId] ?? {}));
}

function cadenceLabel(habit) {
  return habit.cadence === 'daily' ? 'Every day' : `${habit.target}× per week`;
}

// The unit is part of the claim: a daily 5 and a weekly 5 are different things.
function streakLabel(habit, done, today) {
  const daily = habit.cadence === 'daily';
  const n = daily
    ? dailyStreak(done, today, habit.createdAt)
    : weeklyStreak(done, today, habit.createdAt, habit.target);

  if (n === 0) return { text: 'no streak', live: false };
  const unit = daily ? 'day' : 'week';
  return { text: `${n} ${unit}${n === 1 ? '' : 's'}`, live: true };
}

function meta(habit, done, today) {
  const row = document.createElement('p');
  row.className = 'meta';

  const cadence = document.createElement('span');
  cadence.textContent = cadenceLabel(habit);

  const streak = streakLabel(habit, done, today);
  const badge = document.createElement('span');
  badge.className = streak.live ? 'badge on' : 'badge';
  badge.textContent = streak.text;

  row.append(cadence, badge);

  if (habit.cadence === 'weekly') {
    const progress = document.createElement('span');
    progress.className = 'progress';
    progress.textContent =
      `${countInWeek(done, weekStart(today))} of ${habit.target} this week`;
    row.append(progress);
  }

  return row;
}

function strip(habit, done, today) {
  const wrap = document.createElement('div');
  wrap.className = 'strip';

  for (const date of lastNDays(today, WINDOW)) {
    const [y, m, d] = date.split('-').map(Number);
    const when = new Date(y, m - 1, d);
    const isDone = done.has(date);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day';
    cell.dataset.date = date;
    cell.setAttribute('aria-pressed', String(isDone));
    cell.setAttribute('aria-label', when.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    }));
    if (isDone) cell.classList.add('done');
    if (date === today) cell.classList.add('today');

    const initial = document.createElement('span');
    initial.className = 'initial';
    initial.textContent = when.toLocaleDateString(undefined, { weekday: 'narrow' });

    const number = document.createElement('span');
    number.className = 'number';
    number.textContent = String(d);

    cell.append(initial, number);
    wrap.append(cell);
  }

  return wrap;
}

function card(habit, today) {
  const done = doneDays(habit.id);

  const li = document.createElement('li');
  li.className = 'habit';
  li.dataset.habit = habit.id;

  const name = document.createElement('h2');
  // textContent, never innerHTML: the name is user input.
  name.textContent = habit.name;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.dataset.delete = '';
  remove.textContent = 'Delete';
  remove.setAttribute('aria-label', `Delete ${habit.name}`);

  li.append(name, meta(habit, done, today), remove, strip(habit, done, today));
  return li;
}

// Today is recomputed here rather than held in a constant, so re-rendering is
// all it takes to roll over at midnight.
function render() {
  const now = new Date();
  todayLabel.textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const today = dateKey(now);
  list.replaceChildren(...state.habits.map((habit) => card(habit, today)));
}

function toggle(habitId, date) {
  const days = state.entries[habitId] ??= {};
  if (days[date]) delete days[date];
  else days[date] = true;
  save(state);
  render();
}

// Delegated, so a re-render never has to reattach anything.
list.addEventListener('click', (event) => {
  const cell = event.target.closest('button[data-date]');
  if (cell) {
    toggle(cell.closest('.habit').dataset.habit, cell.dataset.date);
    return;
  }

  const button = event.target.closest('button[data-delete]');
  if (!button) return;

  const { habit: id } = button.closest('.habit').dataset;
  const habit = state.habits.find((h) => h.id === id);
  if (!confirm(`Delete “${habit.name}” and its history?`)) return;

  state.habits = state.habits.filter((h) => h.id !== id);
  // Drop the history too, or entries accumulates keys nothing points at.
  delete state.entries[id];
  save(state);
  render();
});

cadenceInput.addEventListener('change', () => {
  targetField.hidden = cadenceInput.value !== 'weekly';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  const weekly = cadenceInput.value === 'weekly';
  state.habits.push({
    id: crypto.randomUUID(),
    name,
    cadence: weekly ? 'weekly' : 'daily',
    target: weekly ? Number(targetInput.value) : 1,
    createdAt: dateKey(new Date()),
  });
  save(state);

  form.reset();
  targetField.hidden = true;
  render();
  nameInput.focus();
});

if (!canStore) {
  form.querySelectorAll('input, select, button').forEach((el) => { el.disabled = true; });
}

render();
