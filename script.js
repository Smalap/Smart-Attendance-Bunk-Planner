// ==========================================================
//  SMART ATTENDANCE & BUNK PLANNER — Application Logic
//
//  This file handles:
//   1. Core attendance formulas (percentage, safe bunks, recovery)
//   2. Subject management (add, update, delete, clear)
//   3. UI rendering (subject cards, aggregate overview, empty state)
//
//  No external libraries — pure vanilla JavaScript.
// ==========================================================


// ----------------------------------------------------------
//  DATA
// ----------------------------------------------------------

// All subjects are stored here as an array of objects.
// Each object looks like: { id: 1, name: "DSP", total: 40, attended: 32 }
var subjects = [];

// Auto-incrementing counter to give each subject a unique ID
var nextId = 1;


// ----------------------------------------------------------
//  FORMULA 1: Attendance Percentage
//
//  Formula:  (attended / total) × 100
//  Returns 0 if total is 0 (no lectures conducted yet).
// ----------------------------------------------------------
function getPercentage(attended, total) {
    if (total === 0) return 0;
    return (attended / total) * 100;
}


// ----------------------------------------------------------
//  FORMULA 2: Safe Bunks
//
//  How many more lectures can the student skip and still
//  stay at or above 75%?
//
//  Formula:  floor( attended − 0.75 × total )
//
//  This gives the number of "surplus" lectures above the
//  75% line. If the student is below 75%, the result is
//  negative, so we return 0.
// ----------------------------------------------------------
function getSafeBunks(attended, total) {
    var surplus = Math.floor(attended - 0.75 * total);
    return surplus > 0 ? surplus : 0;
}


// ----------------------------------------------------------
//  FORMULA 3: Lectures Needed to Recover to 75%
//
//  If the student is below 75%, how many consecutive
//  lectures must they attend (without missing any) to
//  reach exactly 75%?
//
//  We solve the inequality:
//      (attended + x) / (total + x) >= 0.75
//
//  Step-by-step:
//      attended + x >= 0.75 × (total + x)
//      attended + x >= 0.75 × total + 0.75 × x
//      x − 0.75x >= 0.75 × total − attended
//      0.25x >= 0.75 × total − attended
//      x >= (0.75 × total − attended) / 0.25
//      x >= 3 × total − 4 × attended
//
//  We ceil() because you can only attend whole lectures.
//  If x <= 0, the student is already at or above 75%.
// ----------------------------------------------------------
function getLecturesToRecover(attended, total) {
    var needed = Math.ceil(3 * total - 4 * attended);
    return needed > 0 ? needed : 0;
}


// ----------------------------------------------------------
//  ADD SUBJECT
//  Reads form inputs, validates, pushes to array, re-renders.
// ----------------------------------------------------------
function addSubject() {
    var nameEl     = document.getElementById("inp-name");
    var totalEl    = document.getElementById("inp-total");
    var attendedEl = document.getElementById("inp-attended");

    var name     = nameEl.value.trim();
    var total    = parseInt(totalEl.value, 10);
    var attended = parseInt(attendedEl.value, 10);

    // --- Validation ---
    if (name === "") {
        shakeField(nameEl);
        return;
    }
    if (isNaN(total) || total < 0) {
        shakeField(totalEl);
        return;
    }
    if (isNaN(attended) || attended < 0) {
        shakeField(attendedEl);
        return;
    }
    if (attended > total) {
        alert("Attended lectures cannot exceed total lectures.");
        shakeField(attendedEl);
        return;
    }

    // Push new subject
    subjects.push({
        id: nextId++,
        name: name,
        total: total,
        attended: attended
    });

    // Clear inputs and refocus for next entry
    nameEl.value = "";
    totalEl.value = "";
    attendedEl.value = "";
    nameEl.focus();

    // Save to localStorage and refresh UI
    saveData();
    renderAll();
}


// ----------------------------------------------------------
//  UPDATE SUBJECT (inline editing on subject card)
// ----------------------------------------------------------
function updateSubject(id) {
    var subj = subjects.find(function(s) { return s.id === id; });
    if (!subj) return;

    var totalEl    = document.getElementById("t-" + id);
    var attendedEl = document.getElementById("a-" + id);

    var newTotal    = parseInt(totalEl.value, 10);
    var newAttended = parseInt(attendedEl.value, 10);

    // Silently ignore invalid entries; revert on impossible values
    if (isNaN(newTotal) || newTotal < 0) return;
    if (isNaN(newAttended) || newAttended < 0) return;

    if (newAttended > newTotal) {
        alert("Attended cannot exceed total lectures.");
        attendedEl.value = subj.attended;
        return;
    }

    subj.total = newTotal;
    subj.attended = newAttended;

    saveData();
    renderAll();
}


// ----------------------------------------------------------
//  DELETE SUBJECT
// ----------------------------------------------------------
function deleteSubject(id) {
    subjects = subjects.filter(function(s) { return s.id !== id; });
    saveData();
    renderAll();
}


// ----------------------------------------------------------
//  CLEAR ALL
// ----------------------------------------------------------
function clearAll() {
    if (subjects.length === 0) return;
    if (!confirm("Remove all subjects? This cannot be undone.")) return;
    subjects = [];
    saveData();
    renderAll();
}


// ----------------------------------------------------------
//  RENDERING — Master
// ----------------------------------------------------------
function renderAll() {
    renderSubjects();
    renderAggregate();
    renderEmptyState();
}


// ----------------------------------------------------------
//  RENDERING — Subject Cards
// ----------------------------------------------------------
function renderSubjects() {
    var container = document.getElementById("subjects");
    container.innerHTML = "";

    for (var i = 0; i < subjects.length; i++) {
        var s = subjects[i];

        var pct      = getPercentage(s.attended, s.total);
        var safe     = pct >= 75;
        var bunks    = getSafeBunks(s.attended, s.total);
        var recover  = getLecturesToRecover(s.attended, s.total);

        // Build the advice text
        var advice = "";
        if (s.total === 0) {
            advice = "No lectures conducted yet.";
        } else if (safe) {
            advice = "You can safely skip <strong>" + bunks + " more lecture" +
                     (bunks !== 1 ? "s" : "") + "</strong> and stay \u2265 75%.";
        } else {
            advice = "Attend the next <strong>" + recover + " lecture" +
                     (recover !== 1 ? "s" : "") + "</strong> without fail to recover to 75%.";
        }

        // Status class strings
        var cls    = safe ? "safe" : "risk";
        var status = safe ? "SAFE"  : "AT RISK";

        // Build HTML string for this subject card
        var html = ''
            + '<div class="subj" style="animation-delay:' + (i * 0.05) + 's">'
            +   '<div class="subj__top">'
            +     '<span class="subj__name">' + escapeHtml(s.name) + '</span>'
            +     '<button class="btn btn--delete" onclick="deleteSubject(' + s.id + ')" title="Remove">'
            +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            +     '</button>'
            +   '</div>'
            +   '<div class="subj__fields">'
            +     '<div class="field">'
            +       '<label for="t-' + s.id + '">Total Lectures</label>'
            +       '<input type="number" id="t-' + s.id + '" value="' + s.total + '" min="0" onchange="updateSubject(' + s.id + ')">'
            +     '</div>'
            +     '<div class="field">'
            +       '<label for="a-' + s.id + '">Attended</label>'
            +       '<input type="number" id="a-' + s.id + '" value="' + s.attended + '" min="0" onchange="updateSubject(' + s.id + ')">'
            +     '</div>'
            +   '</div>'
            +   '<div class="subj__result subj__result--' + cls + '">'
            +     '<div class="subj__pct subj__pct--' + cls + '">' + pct.toFixed(1) + '%</div>'
            +     '<span class="subj__badge subj__badge--' + cls + '">' + status + '</span>'
            +     '<div class="subj__advice">' + advice + '</div>'
            +   '</div>'
            +   '<div class="subj__track">'
            +     '<div class="track">'
            +       '<div class="track__fill" style="width:' + Math.min(pct, 100) + '%; background:var(--' + cls + ')"></div>'
            +       '<div class="track__marker"><span>75%</span></div>'
            +     '</div>'
            +   '</div>'
            + '</div>';

        container.insertAdjacentHTML("beforeend", html);
    }
}


// ----------------------------------------------------------
//  RENDERING — Aggregate Overview
// ----------------------------------------------------------
function renderAggregate() {
    var card = document.getElementById("agg-card");

    if (subjects.length === 0) {
        card.style.display = "none";
        return;
    }
    card.style.display = "";

    // Sum totals across all subjects
    var totalAll    = 0;
    var attendedAll = 0;
    for (var i = 0; i < subjects.length; i++) {
        totalAll    += subjects[i].total;
        attendedAll += subjects[i].attended;
    }

    var pct  = getPercentage(attendedAll, totalAll);
    var safe = pct >= 75;

    document.getElementById("agg-total").textContent    = totalAll;
    document.getElementById("agg-attended").textContent  = attendedAll;
    document.getElementById("agg-pct").textContent       = pct.toFixed(1) + "%";

    var statusEl = document.getElementById("agg-status");
    statusEl.textContent = safe ? "\u2713 Safe" : "\u26A0 At Risk";
    statusEl.style.color = safe ? "var(--safe)" : "var(--risk)";

    // Update progress bar
    var bar = document.getElementById("agg-bar");
    bar.style.width      = Math.min(pct, 100) + "%";
    bar.style.background = safe ? "var(--safe)" : "var(--risk)";
}


// ----------------------------------------------------------
//  RENDERING — Empty State
// ----------------------------------------------------------
function renderEmptyState() {
    document.getElementById("empty").style.display =
        subjects.length === 0 ? "" : "none";
}


// ----------------------------------------------------------
//  LOCAL STORAGE — persist data across page reloads
// ----------------------------------------------------------
function saveData() {
    try {
        localStorage.setItem("att_subjects", JSON.stringify(subjects));
        localStorage.setItem("att_nextId", String(nextId));
    } catch (e) {
        // localStorage unavailable — data will persist only during this session
    }
}

function loadData() {
    try {
        var stored = localStorage.getItem("att_subjects");
        if (stored) {
            subjects = JSON.parse(stored);
        }
        var storedId = localStorage.getItem("att_nextId");
        if (storedId) {
            nextId = parseInt(storedId, 10);
        }
    } catch (e) {
        subjects = [];
        nextId = 1;
    }
}


// ----------------------------------------------------------
//  UTILITIES
// ----------------------------------------------------------

// Prevent XSS by escaping user-entered text before inserting into HTML
function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Quick shake animation on invalid input field
function shakeField(el) {
    el.style.animation = "none";
    // Force reflow so the animation restarts
    void el.offsetWidth;
    el.style.animation = "shake 0.4s ease";
    el.focus();
}


// ----------------------------------------------------------
//  KEYBOARD SHORTCUT — Enter key adds a subject
// ----------------------------------------------------------
document.addEventListener("keydown", function(e) {
    if (e.key !== "Enter") return;
    var tag = document.activeElement;
    var isFormInput = (tag.id === "inp-name" ||
                      tag.id === "inp-total" ||
                      tag.id === "inp-attended");
    if (isFormInput) {
        e.preventDefault();
        addSubject();
    }
});


// ----------------------------------------------------------
//  CSS KEYFRAMES injected via JS (for the shake animation)
// ----------------------------------------------------------
(function injectShakeKeyframes() {
    var style = document.createElement("style");
    style.textContent = "@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}";
    document.head.appendChild(style);
})();


// ----------------------------------------------------------
//  INIT — load saved data and render on page load
// ----------------------------------------------------------
(function init() {
    loadData();
    renderAll();
})();
