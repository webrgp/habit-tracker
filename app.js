import { dateKey, lastNDays } from './streak.js';
import { load, save, storageAvailable } from './store.js';

const state = load();
const canStore = storageAvailable();

const todayLabel = document.getElementById('today-label');
const form = document.getElementById('add-habit');
const nameInput = document.getElementById('habit-name');
const cadenceInput = document.getElementById('habit-cadence');
const targetField = document.getElementById('target-field');
const targetInput = document.getElementById('habit-target');
const list = document.getElementById('habits');

function cadenceLabel(habit) {
  return habit.cadence === 'daily' ? 'Every day' : `${habit.target}× per week`;
}

const WINDOW = 7;

function done(habitId, date) {
  return Boolean(state.entries[habitId]?.[date]);
}

function strip(habit, today) {
  const wrap = document.createElement('div');
  wrap.className = 'strip';

  for (const date of lastNDays(today, WINDOW)) {
    const [y, m, d] = date.split('-').map(Number);
    const when = new Date(y, m - 1, d);
    const isDone = done(habit.id, date);

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
  const li = document.createElement('li');
  li.className = 'habit';
  li.dataset.habit = habit.id;

  const name = document.createElement('h2');
  // textContent, never innerHTML: the name is user input.
  name.textContent = habit.name;

  const cadence = document.createElement('p');
  cadence.className = 'cadence';
  cadence.textContent = cadenceLabel(habit);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.dataset.delete = '';
  remove.textContent = 'Delete';
  remove.setAttribute('aria-label', `Delete ${habit.name}`);

  li.append(name, cadence, remove, strip(habit, today));
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

if (!canStore) form.querySelectorAll('input, select, button').forEach((el) => { el.disabled = true; });

render();
