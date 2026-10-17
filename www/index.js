const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const jsDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// kis din kaun sa warm up (warmup.json ke naam)
const warmupType = {
  Mon: "upper",
  Tue: "pull",
  Wed: "lower",
  Fri: "upper",
  Sat: "lower"
};

const tabsBox = document.getElementById("day-tabs");
const workoutArea = document.getElementById("workout-area");

let workoutData = {};
let warmupData = {};
let currentDay = "";
let chosen = {};
let setTicks = [];
let timerId = null;
let saved = {};
let wakeLock = null;
let countedThisWorkout = false;

// ---------- Save / Load (localStorage) ----------
const SAVE_KEY = "gymAppSave";

function loadSaved() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    saved = text ? JSON.parse(text) : {};
  } catch (e) {
    saved = {};
  }
  if (!saved.choices) saved.choices = {};
  if (!saved.weights) saved.weights = {};
  if (!saved.lastDone) saved.lastDone = {};
  if (!saved.history) saved.history = [];
  if (!saved.totals) saved.totals = {};
  if (!saved.totals.workouts) saved.totals.workouts = 0;
  if (!saved.totals.exercises) saved.totals.exercises = 0;
  if (!saved.totals.sets) saved.totals.sets = 0;
  if (!saved.totals.reps) saved.totals.reps = 0;
}

function saveNow() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch (e) {
    console.log("Save nahi hua", e);
  }
}

function getWeight(dayName, variant) {
  const key = dayName + "|" + variant.name;
  return saved.weights[key] || variant.weight;
}

function getNumber(text) {
  if (/\d\s*-\s*\d/.test(text)) return null;
  const match = text.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function replaceNumber(text, newNum) {
  return text.replace(/\d+(\.\d+)?/, String(newNum));
}

function canUpgrade(weightText) {
  return getNumber(weightText) !== null;
}

function upgradeWeight(dayName, variant) {
  const current = getWeight(dayName, variant);
  const num = getNumber(current);
  if (num === null) return;
  saved.weights[dayName + "|" + variant.name] = replaceNumber(current, num + 2.5);
  saveNow();
}

function getChosen(dayName) {
  if (!chosen[dayName]) {
    const exercises = workoutData[dayName].exercises;
    const old = saved.choices[dayName];
    chosen[dayName] = exercises.map(function (ex, idx) {
      if (old && old[idx] !== undefined && ex.variants[old[idx]]) {
        return old[idx];
      }
      return 0;
    });
  }
  return chosen[dayName];
}

// ---------- Date helpers ----------
function dateToString(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

function todayString() {
  return dateToString(new Date());
}

function todayName() {
  return jsDayNames[new Date().getDay()];
}

function daysAgoText(dateString) {
  const then = new Date(dateString + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((now - then) / 86400000);
  if (diff <= 0) return "aaj";
  if (diff === 1) return "kal";
  return diff + " din pehle";
}

// ---------- Weekly stats + streak ----------
function weekStartString() {
  const d = new Date();
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return dateToString(d);
}

function workoutDaysPerWeek() {
  let count = 0;
  days.forEach(function (d) {
    if (!workoutData[d].rest) count++;
  });
  return count;
}

function weekCount() {
  const start = weekStartString();
  return saved.history.filter(function (d) {
    return d >= start;
  }).length;
}

function streakCount() {
  let streak = 0;
  const d = new Date();
  const todayStr = todayString();

  for (let back = 0; back < 365; back++) {
    const ds = dateToString(d);
    const dayName = jsDayNames[d.getDay()];

    if (!workoutData[dayName].rest) {
      if (saved.history.indexOf(ds) !== -1) {
        streak++;
      } else if (ds !== todayStr) {
        break;
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function statsHtml() {
  let html = '<div class="stats">';
  html += '<div class="stat-box"><span class="stat-num">' + weekCount() + "/" + workoutDaysPerWeek() + '</span><span class="stat-label">Is hafte</span></div>';
  html += '<div class="stat-box"><span class="stat-num">' + streakCount() + '</span><span class="stat-label">Streak</span></div>';
  html += "</div>";
  return html;
}

// ---------- Lifetime totals (ab tak ka total) ----------
function addToTotals() {
  const exercises = workoutData[currentDay].exercises;

  exercises.forEach(function (ex, i) {
    let doneSets = 0;
    setTicks[i].forEach(function (d) {
      if (d) doneSets++;
    });

    saved.totals.sets += doneSets;
    saved.totals.reps += doneSets * ex.reps;
    if (doneSets === ex.sets) {
      saved.totals.exercises++;
    }
  });

  saved.totals.workouts++;
}

function lifetimeHtml() {
  const t = saved.totals;
  let html = '<h3 class="sub-title">Ab tak ka total</h3>';
  html += '<div class="life-grid">';
  html += '<div class="stat-box"><span class="stat-num">' + t.workouts + '</span><span class="stat-label">Workouts</span></div>';
  html += '<div class="stat-box"><span class="stat-num">' + t.exercises + '</span><span class="stat-label">Exercises</span></div>';
  html += '<div class="stat-box"><span class="stat-num">' + t.sets + '</span><span class="stat-label">Sets</span></div>';
  html += '<div class="stat-box"><span class="stat-num">' + t.reps + '</span><span class="stat-label">Reps</span></div>';
  html += "</div>";
  return html;
}

// ---------- Screen on rakhna (Wake Lock) ----------
async function keepAwake() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) {
    console.log("Wake lock nahi mila", e);
  }
}

function releaseAwake() {
  try {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {
    wakeLock = null;
  }
}

// ---------- Timer ke helper ----------
function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function beep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log("Beep nahi baja", e);
  }
  if (navigator.vibrate) {
    navigator.vibrate([300, 150, 300]);
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function startRest(seconds) {
  stopTimer();

  const box = document.getElementById("timer-box");
  let left = seconds;

  function draw() {
    box.innerHTML =
      '<p class="timer-label">Aaram karo</p>' +
      '<p class="timer-num">' + formatTime(left) + "</p>" +
      '<div class="timer-btns">' +
      '<button id="add-btn" class="small-btn">+15 sec</button>' +
      '<button id="skip-btn" class="small-btn">Skip</button>' +
      "</div>";

    document.getElementById("add-btn").addEventListener("click", function () {
      left += 15;
      draw();
    });
    document.getElementById("skip-btn").addEventListener("click", function () {
      stopTimer();
      box.innerHTML = "";
    });
  }

  draw();

  timerId = setInterval(function () {
    left--;
    if (left <= 0) {
      stopTimer();
      box.innerHTML = '<p class="timer-done">Aaram khatam! Agla set shuru karo</p>';
      beep();
    } else {
      box.querySelector(".timer-num").textContent = formatTime(left);
    }
  }, 1000);
}

// ---------- Screen 1: din ki exercise list ----------
function showDay(dayName) {
  stopTimer();
  releaseAwake();
  currentDay = dayName;
  const dayInfo = workoutData[dayName];

  let html = statsHtml();
  html += lifetimeHtml();
  html += '<h2 class="day-title title-gap">' + dayInfo.title + "</h2>";

  if (dayInfo.rest) {
    html += '<div class="rest-card">';
    html += '<div class="rest-emoji">😴</div>';
    html += "<h3>Aaj aaram ka din hai</h3>";
    html += '<ul class="rest-tips">';
    html += "<li>Protein lo: daal, paneer, eggs, soya, milk</li>";
    html += "<li>Paani khub piyo</li>";
    html += "<li>7-8 ghante ki neend lo</li>";
    html += "<li>Muscle gym mein nahi, aaram mein badhta hai</li>";
    html += "</ul>";
    html += "</div>";
    workoutArea.innerHTML = html;
    return;
  }

  if (saved.lastDone[dayName]) {
    html += '<p class="hint">Last done: ' + daysAgoText(saved.lastDone[dayName]) + "</p>";
  }

  const picks = getChosen(dayName);

  dayInfo.exercises.forEach(function (ex, index) {
    const current = ex.variants[picks[index]];

    html += '<div class="exercise-card">';
    html += "<h3>" + ex.name + "</h3>";

    html += '<select data-index="' + index + '">';
    ex.variants.forEach(function (v, vIndex) {
      const selected = vIndex === picks[index] ? " selected" : "";
      html += '<option value="' + vIndex + '"' + selected + ">" + v.name + "</option>";
    });
    html += "</select>";

    html += "<p>" + ex.sets + " sets x " + ex.reps + " reps</p>";
    html += '<p class="weight-line">Weight: ' + getWeight(dayName, current) + "</p>";
    html += "<p>Rest: " + ex.restSec + " sec</p>";
    html += "</div>";
  });

  html += '<button id="start-btn" class="big-btn">Warm up shuru karo</button>';

  workoutArea.innerHTML = html;
  addDropdownEvents();
  document.getElementById("start-btn").addEventListener("click", showWarmup);
}

function addDropdownEvents() {
  const dropdowns = workoutArea.querySelectorAll("select");
  const picks = getChosen(currentDay);

  dropdowns.forEach(function (dropdown) {
    dropdown.addEventListener("change", function () {
      const exIndex = Number(dropdown.getAttribute("data-index"));
      const variantIndex = Number(dropdown.value);

      picks[exIndex] = variantIndex;
      saved.choices[currentDay] = picks.slice();
      saveNow();

      const chosenVariant = workoutData[currentDay].exercises[exIndex].variants[variantIndex];
      const card = dropdown.parentElement;
      card.querySelector(".weight-line").textContent =
        "Weight: " + getWeight(currentDay, chosenVariant);
    });
  });
}

// ---------- Screen 2: warm up ----------
function showWarmup() {
  const items = warmupData[warmupType[currentDay]];

  let html = '<h2 class="day-title">Warm Up</h2>';
  html += '<p class="hint">Har warm up karke tick karo</p>';

  items.forEach(function (item, index) {
    html += '<label class="warm-item">';
    html += '<input type="checkbox" data-warm="' + index + '">';
    html += "<span><strong>" + item.name + "</strong><br>" + item.detail + "</span>";
    html += "</label>";
  });

  html += '<button id="go-btn" class="big-btn" disabled>Workout shuru karo</button>';
  html += '<button id="back-btn" class="back-btn">Wapas</button>';

  workoutArea.innerHTML = html;

  const checkboxes = workoutArea.querySelectorAll('input[type="checkbox"]');
  const goBtn = document.getElementById("go-btn");

  checkboxes.forEach(function (box) {
    box.addEventListener("change", function () {
      let allDone = true;
      checkboxes.forEach(function (b) {
        if (!b.checked) {
          allDone = false;
        }
      });
      goBtn.disabled = !allDone;
    });
  });

  goBtn.addEventListener("click", startWorkout);
  document.getElementById("back-btn").addEventListener("click", function () {
    showDay(currentDay);
  });
}

// ---------- Screen 3: workout ----------
function startWorkout() {
  setTicks = workoutData[currentDay].exercises.map(function (ex) {
    const list = [];
    for (let i = 0; i < ex.sets; i++) {
      list.push(false);
    }
    return list;
  });

  countedThisWorkout = false;
  keepAwake();
  showExercise(0);
}

function progressPercent() {
  let total = 0;
  let done = 0;
  setTicks.forEach(function (list) {
    list.forEach(function (d) {
      total++;
      if (d) done++;
    });
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function showExercise(i) {
  stopTimer();
  const exercises = workoutData[currentDay].exercises;

  if (i >= exercises.length) {
    showFinished();
    return;
  }

  const ex = exercises[i];
  const v = ex.variants[getChosen(currentDay)[i]];
  const isLast = i === exercises.length - 1;

  let html = '<div class="progress"><div id="progress-fill" class="progress-fill" style="width:' + progressPercent() + '%"></div></div>';
  html += '<p class="hint">Exercise ' + (i + 1) + " / " + exercises.length + "</p>";
  html += '<h2 class="day-title">' + v.name + "</h2>";
  html += '<div class="exercise-card">';
  html += '<p class="weight-big">' + getWeight(currentDay, v) + "</p>";
  html += "<p>Rest: " + ex.restSec + " sec</p>";
  html += "</div>";

  setTicks[i].forEach(function (done, setNo) {
    const checked = done ? " checked" : "";
    html += '<label class="set-row">';
    html += '<input type="checkbox" data-set="' + setNo + '"' + checked + ">";
    html += "<span>Set " + (setNo + 1) + " &mdash; " + ex.reps + " reps</span>";
    html += "</label>";
  });

  html += '<div id="timer-box" class="timer-box"></div>';

  const nextText = isLast ? "Workout poora karo" : "Agli exercise";
  html += '<button id="next-btn" class="big-btn" disabled>' + nextText + "</button>";

  if (i > 0) {
    html += '<button id="prev-btn" class="back-btn">Pichli exercise</button>';
  }
  html += '<button id="quit-btn" class="back-btn">Workout chhodo</button>';

  workoutArea.innerHTML = html;

  const nextBtn = document.getElementById("next-btn");
  const boxes = workoutArea.querySelectorAll('input[type="checkbox"]');

  function allSetsDone() {
    let all = true;
    setTicks[i].forEach(function (d) {
      if (!d) {
        all = false;
      }
    });
    return all;
  }

  function updateNextButton() {
    nextBtn.disabled = !allSetsDone();
  }

  boxes.forEach(function (box) {
    box.addEventListener("change", function () {
      const setNo = Number(box.getAttribute("data-set"));
      setTicks[i][setNo] = box.checked;
      updateNextButton();
      document.getElementById("progress-fill").style.width = progressPercent() + "%";

      if (box.checked && !allSetsDone()) {
        startRest(ex.restSec);
      } else {
        stopTimer();
        document.getElementById("timer-box").innerHTML = "";
      }
    });
  });

  updateNextButton();

  nextBtn.addEventListener("click", function () {
    showExercise(i + 1);
  });

  if (i > 0) {
    document.getElementById("prev-btn").addEventListener("click", function () {
      showExercise(i - 1);
    });
  }

  document.getElementById("quit-btn").addEventListener("click", function () {
    showDay(currentDay);
  });
}

// ---------- Screen 4: workout complete + weight upgrade ----------
function showFinished() {
  stopTimer();
  releaseAwake();

  const today = todayString();
  saved.lastDone[currentDay] = today;
  if (saved.history.indexOf(today) === -1) {
    saved.history.push(today);
  }

  if (!countedThisWorkout) {
    addToTotals();
    countedThisWorkout = true;
  }
  saveNow();

  const exercises = workoutData[currentDay].exercises;
  const picks = getChosen(currentDay);

  let html = '<h2 class="day-title">Shabash! Workout complete</h2>';
  html += '<div class="rest-message">Aaj ka kaam ho gaya. Protein lo, paani piyo, aur neend poori karo.</div>';
  html += statsHtml();
  html += lifetimeHtml();

  let upgradeHtml = "";
  exercises.forEach(function (ex, index) {
    const v = ex.variants[picks[index]];
    const w = getWeight(currentDay, v);
    if (canUpgrade(w)) {
      upgradeHtml += '<div class="upgrade-row">';
      upgradeHtml += "<span><strong>" + v.name + "</strong><br>" + w + "</span>";
      upgradeHtml += '<button class="small-btn upg-btn" data-ex="' + index + '">Easy tha: +2.5kg</button>';
      upgradeHtml += "</div>";
    }
  });

  if (upgradeHtml !== "") {
    html += '<h3 class="sub-title">Saare reps easily ho gaye?</h3>';
    html += '<p class="hint">Easy tha dabao, agli baar weight 2.5kg badh jayega. Mushkil tha to kuch mat dabao.</p>';
    html += upgradeHtml;
  }

  html += '<button id="home-btn" class="big-btn">Wapas home</button>';
  workoutArea.innerHTML = html;

  workoutArea.querySelectorAll(".upg-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const index = Number(btn.getAttribute("data-ex"));
      const v = exercises[index].variants[picks[index]];
      upgradeWeight(currentDay, v);
      btn.textContent = "Done: " + getWeight(currentDay, v);
      btn.disabled = true;
    });
  });

  document.getElementById("home-btn").addEventListener("click", function () {
    showDay(currentDay);
  });
}

// ---------- Tabs ----------
function selectDay(dayName) {
  const allButtons = tabsBox.querySelectorAll("button");

  allButtons.forEach(function (btn) {
    btn.classList.remove("active");
    if (btn.textContent === dayName) {
      btn.classList.add("active");
    }
  });

  showDay(dayName);
}

function makeTabs() {
  const today = todayName();

  days.forEach(function (day) {
    const btn = document.createElement("button");
    btn.textContent = day;
    if (day === today) {
      btn.classList.add("today");
    }
    btn.addEventListener("click", function () {
      selectDay(day);
    });
    tabsBox.appendChild(btn);
  });
}

// ---------- Data load ----------
loadSaved();

Promise.all([
  fetch("exercises.json").then(function (r) { return r.json(); }),
  fetch("warmup.json").then(function (r) { return r.json(); })
])
  .then(function (results) {
    workoutData = results[0];
    warmupData = results[1];
    makeTabs();
    selectDay(todayName());
  })
  .catch(function (error) {
    workoutArea.innerHTML = "<p>Data load nahi hua. Console check karo.</p>";
    console.error(error);
  });
  // ---------- VK about popup ----------
const aboutModal = document.getElementById("about-modal");

document.getElementById("vk-btn").addEventListener("click", function () {
  aboutModal.classList.remove("hidden");
});

document.getElementById("about-close").addEventListener("click", function () {
  aboutModal.classList.add("hidden");
});

aboutModal.addEventListener("click", function (e) {
  if (e.target === aboutModal) {
    aboutModal.classList.add("hidden");
  }
});