import { dateKey } from './streak.js';
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

function card(habit) {
  const li = document.createElement('li');
  li.className = 'habit';
  li.dataset.habit = habit.id;

  const name = document.createElement('h2');
  // textContent, never innerHTML: the name is user input.
  name.textContent = habit.name;

  const cadence = document.createElement('p');
  cadence.className = 'cadence';
  cadence.textContent = cadenceLabel(habit);

  li.append(name, cadence);
  return li;
}

// Today is recomputed here rather than held in a constant, so re-rendering is
// all it takes to roll over at midnight.
function render() {
  const now = new Date();
  todayLabel.textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });
  list.replaceChildren(...state.habits.map(card));
}

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
