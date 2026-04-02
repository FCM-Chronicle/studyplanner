// script.js

// --- Constants & State ---
const STORAGE_KEY = 'toss_study_planner_v2';

function getVirtualToday() {
    const now = new Date();
    const virtualDate = new Date(now.getTime() - (3 * 60 * 60 * 1000) - (1 * 60 * 1000));
    const offset = virtualDate.getTimezoneOffset() * 60000;
    return new Date(virtualDate.getTime() - offset).toISOString().split('T')[0];
}
const TODAY = getVirtualToday();

// 격려 문구 데이터
const MESSAGES_100 = [
    "완벽해요! 이 느낌 그대로 계속 해요! 🚀",
    "오늘 계획을 모두 끝냈어요! 정말 대단해요 👏",
    "성실함이 빛을 발하는 순간이에요 ✨",
    "내일도 오늘처럼만 하면 목표 달성 확실해요!"
];

const MESSAGES_PARTIAL = [
    "더 노력해서 100% 꼭 채워 봐요! 💪",
    "조금만 더 힘내면 완벽할 수 있어요 🔥",
    "시작이 반이에요, 내일은 더 잘할 수 있어요!",
    "오늘의 노력이 내일의 실력이 될 거예요."
];

// 기본 데이터 구조
let data = {
    lastDate: TODAY,
    streak: 0,
    coins: 0,
    history: [],
    tasks: [],
    soundEnabled: true,
    timerHistory: [],
    savedSessionTime: 0,
    timerRunningState: false,
    inventory: ['default'],
    currentTheme: 'default',
    customSubjects: []
};
let isEditMode = false;

// --- DOM Elements ---
const taskListEl = document.getElementById('task-list');
const streakCountEl = document.getElementById('streak-count');
const coinCountEl = document.getElementById('coin-count');
const modalAdd = document.getElementById('modal-add');
const modalEdit = document.getElementById('modal-edit');
const modalProgress = document.getElementById('modal-progress');
const modalDaily = document.getElementById('modal-daily-report');
const modalWeekly = document.getElementById('modal-weekly-report');
const sideMenu = document.getElementById('side-menu');
let timerViewEl, plannerViewEl;
let timerInterval = null;
let isTimerRunning = false;
let currentSessionTime = 0;

// ─────────────────────────────────────────────
// 커스텀 다이얼로그 유틸
// ─────────────────────────────────────────────
function showAlert({ icon = '✅', title = '', message = '', onOk = null } = {}) {
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = message;
    const modal = document.getElementById('modal-alert');
    modal.classList.remove('hidden');

    const btn = document.getElementById('btn-alert-ok');
    const handler = () => {
        modal.classList.add('hidden');
        btn.removeEventListener('click', handler);
        if (onOk) onOk();
    };
    btn.addEventListener('click', handler);
}

function showConfirm({ icon = '❓', title = '', message = '', onOk = null, onCancel = null } = {}) {
    document.getElementById('confirm-icon').innerText = icon;
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    const modal = document.getElementById('modal-confirm');
    modal.classList.remove('hidden');

    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    const cleanup = () => {
        modal.classList.add('hidden');
        btnOk.removeEventListener('click', okHandler);
        btnCancel.removeEventListener('click', cancelHandler);
    };
    const okHandler = () => { cleanup(); if (onOk) onOk(); };
    const cancelHandler = () => { cleanup(); if (onCancel) onCancel(); };

    btnOk.addEventListener('click', okHandler);
    btnCancel.addEventListener('click', cancelHandler);
}

// ─────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────
function init() {
    loadData();
    checkDateChange();
    setupUIStructure();
    renderHeader();
    renderTasks();
    renderOverallProgress();
    setupEventListeners();
    updateTodayTotalTime();
    
    if (data.timerRunningState) {
        if (data.savedSessionTime > 0) {
            const earnedCoins = recordSession(data.savedSessionTime);
            let msg = '앱이 종료되어 집중 시간이 기록되었습니다.';
            if (earnedCoins > 0) msg += ` (+${earnedCoins}코인)`;
            showAlert({ icon: '⏱️', title: '집중 기록', message: msg });
        }
        data.savedSessionTime = 0;
        data.timerRunningState = false;
        saveData();
        currentSessionTime = 0;
        updateTimerDisplay();
        renderStats();
    } else if (data.savedSessionTime > 0) {
        currentSessionTime = data.savedSessionTime;
        updateTimerDisplay();
        pauseTimerUI();
    }
}

// ─────────────────────────────────────────────
// Data Management
// ─────────────────────────────────────────────
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        data = JSON.parse(stored);
        if (data.soundEnabled === undefined) data.soundEnabled = true;
        if (!data.timerHistory) data.timerHistory = [];
        if (!data.savedSessionTime) data.savedSessionTime = 0;
        if (data.timerRunningState === undefined) data.timerRunningState = false;
        if (!data.inventory) data.inventory = ['default'];
        if (!data.currentTheme) data.currentTheme = 'default';
        if (!data.customSubjects) data.customSubjects = [];
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function exportData() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study_planner_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const newData = JSON.parse(event.target.result);
                if (newData.tasks && Array.isArray(newData.tasks)) {
                    showConfirm({
                        icon: '📥',
                        title: '데이터 복구',
                        message: '현재 데이터를 덮어쓰고 불러오시겠습니까?',
                        onOk: () => {
                            data = newData;
                            saveData();
                            renderHeader();
                            renderTasks();
                            renderOverallProgress();
                            showAlert({ icon: '✅', title: '완료', message: '데이터를 성공적으로 불러왔습니다.' });
                            sideMenu.classList.add('hidden');
                        }
                    });
                } else {
                    showAlert({ icon: '⚠️', title: '오류', message: '올바르지 않은 데이터 파일입니다.' });
                }
            } catch (err) {
                showAlert({ icon: '⚠️', title: '오류', message: '파일을 읽는 중 오류가 발생했습니다.' });
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ─────────────────────────────────────────────
// Date & Logic
// ─────────────────────────────────────────────
function checkDateChange() {
    if (data.lastDate !== TODAY) {
        processDailyRecap(data.lastDate);
        data.lastDate = TODAY;
        data.tasks.forEach(task => {
            task.current = 0;
            task.completed = false;
        });
        saveData();
    }
}

function processDailyRecap(yesterdayDate) {
    if (data.tasks.length === 0) return;

    let totalGoal = 0;
    let totalDone = 0;
    let completedTodos = 0; // 100% 달성한 todo 수

    data.tasks.forEach(task => {
        let ratio = task.goal === 0 ? 0 : (task.current / task.goal);
        if (ratio > 1) ratio = 1;
        totalDone += ratio;
        totalGoal += 1;
        if (ratio >= 1) completedTodos++;
    });

    const percent = totalGoal === 0 ? 0 : Math.floor((totalDone / totalGoal) * 100);
    const isPerfect = (percent === 100);

    // 스트릭
    if (percent > 0) {
        data.streak += 1;
    } else {
        data.streak = 0;
    }

    // ── 새 코인 시스템 ──
    // 기본: 달성률 퍼센트만큼 (기존과 동일)
    const baseCoins = percent;
    // 보너스: 완료한 todo 1개당 5코인, todo 수에 비례하는 배율 보너스
    // 예) 3개 완료 시: 5*3 = 15코인 + 3개 전부 완료면 추가 10코인
    const todoBonus = completedTodos * 5 + (completedTodos === totalGoal && completedTodos > 0 ? 10 : 0);
    const earnedCoins = baseCoins + todoBonus;
    data.coins += earnedCoins;

    data.history.push({
        date: yesterdayDate,
        percent: percent,
        isPerfect: isPerfect,
        completedTodos: completedTodos,
        totalTodos: totalGoal
    });

    showDailyReport(percent, baseCoins, todoBonus);

    const todayDay = new Date().getDay();
    if (todayDay === 1) {
        checkWeeklyReport();
    }
}

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────
function renderHeader() {
    streakCountEl.innerText = `${data.streak}일 연속`;
    coinCountEl.innerText = `${data.coins}`;
}

function renderOverallProgress() {
    const wrap = document.getElementById('overall-progress-wrap');
    const bar = document.getElementById('overall-progress-bar');
    const pct = document.getElementById('overall-progress-pct');
    const label = document.getElementById('overall-progress-label');

    if (data.tasks.length === 0) {
        if (wrap) wrap.style.display = 'none';
        return;
    }
    if (wrap) wrap.style.display = 'block';

    let totalGoal = 0;
    let totalDone = 0;
    let completedTodos = 0;

    data.tasks.forEach(task => {
        let ratio = task.goal === 0 ? 0 : (task.current / task.goal);
        if (ratio > 1) ratio = 1;
        totalDone += ratio;
        totalGoal += 1;
        if (ratio >= 1) completedTodos++;
    });

    const percent = totalGoal === 0 ? 0 : Math.round((totalDone / totalGoal) * 100);

    if (pct) pct.innerText = `${percent}%`;
    if (label) label.innerText = `전체 달성률 (${completedTodos}/${totalGoal} 완료)`;
    if (bar) {
        bar.style.width = `${Math.min(percent, 100)}%`;
        // 색상 단계
        if (percent === 100) {
            bar.style.background = 'var(--green)';
        } else if (percent >= 50) {
            bar.style.background = 'var(--toss-blue)';
        } else {
            bar.style.background = 'var(--orange)';
        }
    }
}

function renderTasks() {
    taskListEl.innerHTML = '';
    
    if (data.tasks.length === 0) {
        taskListEl.innerHTML = `
            <div class="empty-state" style="text-align:center; padding: 40px; color: #8b95a1;">
                <p>오늘 할 공부를 추가해보세요!</p>
            </div>`;
        renderOverallProgress();
        return;
    }

    data.tasks.forEach(task => {
        const isDone = task.current >= task.goal;
        const isPartial = task.current > 0 && task.current < task.goal;
        
        let checkClass = '';
        if (isDone) checkClass = 'checked';
        else if (isPartial) checkClass = 'partial';
        
        const shakeClass = isEditMode ? 'shaking' : '';
        const card = document.createElement('div');
        card.className = `task-card ${shakeClass}`;
        card.dataset.id = task.id;

        // 진도 바 퍼센트 계산 (목표치 초과는 100%로 표시)
        const progressPct = task.goal === 0 ? 0 : Math.min((task.current / task.goal) * 100, 100);

        // 진도 바 색상
        let barColor = 'var(--toss-blue)';
        if (isDone) barColor = 'var(--green)';
        else if (isPartial) barColor = 'var(--orange)';

        // 편집 모드 버튼
        const editBtns = isEditMode ? `
            <div class="task-edit-btns">
                <button class="edit-btn edit-modify" data-id="${task.id}">✏️</button>
                <button class="edit-btn edit-delete" data-id="${task.id}">🗑</button>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="task-main">
                <div class="task-content" data-id="${task.id}">
                    <div class="task-top-row">
                        <h3>${task.subject}</h3>
                        <span class="task-progress-text" style="color:${barColor}; font-size:13px; font-weight:700;">${task.current}/${task.goal}${task.unit}</span>
                    </div>
                    <p class="task-workbook">${task.workbook}</p>
                    <div class="task-progress-bar-bg">
                        <div class="task-progress-bar-fill" style="width:${progressPct}%; background:${barColor};"></div>
                    </div>
                </div>
                ${editBtns}
                ${!isEditMode ? `
                <div class="task-check-area" data-id="${task.id}">
                    <div class="check-circle ${checkClass}"></div>
                </div>` : ''}
            </div>
        `;
        
        taskListEl.appendChild(card);
    });

    // 이벤트 위임
    taskListEl.querySelectorAll('.task-content').forEach(el => {
        el.addEventListener('click', () => {
            if (!isEditMode) openProgressModal(parseInt(el.dataset.id));
        });
    });
    taskListEl.querySelectorAll('.task-check-area').forEach(el => {
        el.addEventListener('click', () => {
            if (!isEditMode) openProgressModal(parseInt(el.dataset.id));
        });
    });
    taskListEl.querySelectorAll('.edit-modify').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(parseInt(el.dataset.id));
        });
    });
    taskListEl.querySelectorAll('.edit-delete').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteRequest(parseInt(el.dataset.id));
        });
    });

    renderOverallProgress();
}

// ─────────────────────────────────────────────
// Actions – Delete
// ─────────────────────────────────────────────
function handleDeleteRequest(id) {
    showConfirm({
        icon: '🗑️',
        title: '과목 삭제',
        message: '이 과목을 삭제할까요?',
        onOk: () => {
            if (data.soundEnabled) {
                const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/d/d9/Wilhelm_Scream.ogg');
                audio.volume = 1.0;
                audio.play().catch(e => console.log('Audio play failed', e));
                const fadeInterval = setInterval(() => {
                    if (audio.volume > 0.01) audio.volume -= 0.01;
                    else clearInterval(fadeInterval);
                }, 10);
            }

            const card = taskListEl.querySelector(`.task-card[data-id="${id}"]`);
            if (card) {
                card.classList.remove('shaking');
                setTimeout(() => {
                    card.classList.add('falling');
                    setTimeout(() => {
                        document.body.style.animation = 'screen-shake 0.5s';
                        setTimeout(() => {
                            document.body.style.animation = '';
                            deleteTask(id);
                        }, 500);
                    }, 1000);
                }, 500);
            } else {
                deleteTask(id);
            }
        }
    });
}

function deleteTask(id) {
    data.tasks = data.tasks.filter(t => t.id !== id);
    saveData();
    renderTasks();
}

// ─────────────────────────────────────────────
// 커스텀 과목 칩 관리
// ─────────────────────────────────────────────
const DEFAULT_SUBJECTS = ['국어', '영어', '수학', '과학', '기타'];

// 칩 컨테이너를 현재 data.customSubjects 기준으로 다시 렌더링
function renderSubjectChips(containerId, selectedVal) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 기존 커스텀 칩만 제거 (기본 칩 + ＋추가 버튼은 유지)
    container.querySelectorAll('.chip-custom').forEach(el => el.remove());

    // ＋추가 버튼 앞에 커스텀 칩 삽입
    const addBtn = container.querySelector('.chip-add');
    data.customSubjects.forEach(subj => {
        const chip = document.createElement('button');
        chip.className = 'chip chip-custom';
        chip.dataset.val = subj;
        chip.innerHTML = `${subj} <span class="chip-del" data-subj="${subj}">×</span>`;
        if (selectedVal === subj) chip.classList.add('selected');
        container.insertBefore(chip, addBtn);
    });

    // 선택 상태 동기화
    container.querySelectorAll('.chip:not(.chip-add)').forEach(chip => {
        chip.classList.toggle('selected', chip.dataset.val === selectedVal);
    });

    // 칩 클릭 이벤트 재바인딩
    bindChipEvents(containerId);
}

function bindChipEvents(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const isEdit = containerId === 'edit-subject-chips';

    container.querySelectorAll('.chip:not(.chip-add)').forEach(chip => {
        chip.onclick = (e) => {
            // × 버튼 클릭 시 과목 삭제
            if (e.target.classList.contains('chip-del')) {
                const subj = e.target.dataset.subj;
                deleteCustomSubject(subj, containerId, isEdit);
                return;
            }
            container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            if (isEdit) editSelectedSubject = chip.dataset.val;
            else selectedSubject = chip.dataset.val;
        };
    });
}

function deleteCustomSubject(subj, containerId, isEdit) {
    data.customSubjects = data.customSubjects.filter(s => s !== subj);
    saveData();
    // 삭제된 과목이 선택 중이었으면 첫 번째 기본 과목으로 리셋
    if (isEdit && editSelectedSubject === subj) {
        editSelectedSubject = DEFAULT_SUBJECTS[0];
    } else if (!isEdit && selectedSubject === subj) {
        selectedSubject = DEFAULT_SUBJECTS[0];
    }
    renderSubjectChips(containerId, isEdit ? editSelectedSubject : selectedSubject);
}

function setupCustomSubjectInput(inputWrapId, inputId, confirmBtnId, addBtnId, containerId, isEdit) {
    const wrap = document.getElementById(inputWrapId);
    const input = document.getElementById(inputId);
    const confirmBtn = document.getElementById(confirmBtnId);
    const addBtn = document.getElementById(addBtnId);

    addBtn.addEventListener('click', () => {
        wrap.classList.toggle('hidden');
        if (!wrap.classList.contains('hidden')) {
            input.value = '';
            input.focus();
        }
    });

    const confirm = () => {
        const val = input.value.trim();
        if (!val) return;
        if (DEFAULT_SUBJECTS.includes(val) || data.customSubjects.includes(val)) {
            showAlert({ icon: '⚠️', title: '중복', message: '이미 있는 과목 이름이에요.' });
            return;
        }
        data.customSubjects.push(val);
        saveData();
        if (isEdit) editSelectedSubject = val;
        else selectedSubject = val;
        wrap.classList.add('hidden');
        renderSubjectChips(containerId, isEdit ? editSelectedSubject : selectedSubject);
    };

    confirmBtn.addEventListener('click', confirm);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
}

// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Modals – Add Subject
// ─────────────────────────────────────────────
let selectedSubject = '국어';

// 기본 칩 이벤트 (초기 바인딩 - renderSubjectChips가 추후 갱신)
document.querySelectorAll('#subject-chips .chip:not(.chip-add)').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('#subject-chips .chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedSubject = chip.dataset.val;
    });
});

// 커스텀 과목 입력 셋업
setupCustomSubjectInput(
    'custom-subject-input-wrap', 'input-custom-subject', 'btn-confirm-custom-subject',
    'btn-add-custom-subject', 'subject-chips', false
);

document.getElementById('add-subject-btn').addEventListener('click', () => {
    // 모달 열 때 커스텀 칩 최신화
    document.getElementById('custom-subject-input-wrap').classList.add('hidden');
    renderSubjectChips('subject-chips', selectedSubject);
    modalAdd.classList.remove('hidden');
});

document.getElementById('btn-save-subject').addEventListener('click', () => {
    const workbook = document.getElementById('input-workbook').value.trim();
    const goal = parseInt(document.getElementById('input-goal').value);
    const unit = document.getElementById('input-unit').value;

    if (!workbook || !goal) {
        showAlert({ icon: '⚠️', title: '입력 확인', message: '모든 정보를 입력해주세요.' });
        return;
    }

    const newTask = {
        id: Date.now(),
        subject: selectedSubject,
        workbook: workbook,
        goal: goal,
        unit: unit,
        current: 0,
        completed: false
    };

    data.tasks.push(newTask);
    saveData();
    renderTasks();
    
    document.getElementById('input-workbook').value = '';
    document.getElementById('input-goal').value = '';
    modalAdd.classList.add('hidden');
});

// ─────────────────────────────────────────────
// Modals – Edit Subject
// ─────────────────────────────────────────────
let editingTaskId = null;
let editSelectedSubject = '국어';

// 기본 칩 이벤트 (초기 바인딩)
document.querySelectorAll('#edit-subject-chips .chip:not(.chip-add)').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('#edit-subject-chips .chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        editSelectedSubject = chip.dataset.val;
    });
});

// 커스텀 과목 입력 셋업
setupCustomSubjectInput(
    'custom-subject-input-wrap-edit', 'input-custom-subject-edit', 'btn-confirm-custom-subject-edit',
    'btn-add-custom-subject-edit', 'edit-subject-chips', true
);

function openEditModal(taskId) {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;
    editSelectedSubject = task.subject;

    // 커스텀 과목 포함해서 칩 최신화
    document.getElementById('custom-subject-input-wrap-edit').classList.add('hidden');
    renderSubjectChips('edit-subject-chips', task.subject);

    document.getElementById('edit-workbook').value = task.workbook;
    document.getElementById('edit-goal').value = task.goal;
    const unitSelect = document.getElementById('edit-unit');
    for (let opt of unitSelect.options) {
        opt.selected = opt.value === task.unit;
    }

    modalEdit.classList.remove('hidden');
}

document.getElementById('btn-save-edit').addEventListener('click', () => {
    const workbook = document.getElementById('edit-workbook').value.trim();
    const goal = parseInt(document.getElementById('edit-goal').value);
    const unit = document.getElementById('edit-unit').value;

    if (!workbook || !goal) {
        showAlert({ icon: '⚠️', title: '입력 확인', message: '모든 정보를 입력해주세요.' });
        return;
    }

    const task = data.tasks.find(t => t.id === editingTaskId);
    if (task) {
        task.subject = editSelectedSubject;
        task.workbook = workbook;
        task.goal = goal;
        task.unit = unit;
        saveData();
        renderTasks();
    }
    modalEdit.classList.add('hidden');
});

// ─────────────────────────────────────────────
// Modals – Progress
// ─────────────────────────────────────────────
let currentEditingTaskId = null;

function openProgressModal(taskId) {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;

    currentEditingTaskId = taskId;
    document.getElementById('progress-subject').innerText = task.subject;
    document.getElementById('progress-workbook').innerText = task.workbook;
    document.getElementById('current-progress').value = task.current;
    document.getElementById('goal-display').innerText = task.goal;
    document.getElementById('unit-display').innerText = task.unit;
    
    modalProgress.classList.remove('hidden');
    setTimeout(() => document.getElementById('current-progress').focus(), 100);
}

document.getElementById('btn-save-progress').addEventListener('click', () => {
    const val = parseInt(document.getElementById('current-progress').value);
    if (isNaN(val)) return;

    const task = data.tasks.find(t => t.id === currentEditingTaskId);
    if (task) {
        task.current = val;
        saveData();
        renderTasks();
    }
    modalProgress.classList.add('hidden');
});

// ─────────────────────────────────────────────
// Daily Report
// ─────────────────────────────────────────────
function showDailyReport(percent, baseCoins, todoBonus) {
    document.getElementById('daily-title').innerText = `어제는 ${percent}% 달성했어요!`;
    document.getElementById('daily-coin').innerText = `💰 +${baseCoins}`;

    const bonusBox = document.getElementById('daily-bonus-box');
    const bonusCoinEl = document.getElementById('daily-bonus-coin');
    if (todoBonus > 0) {
        bonusBox.style.display = 'flex';
        bonusCoinEl.innerText = `💰 +${todoBonus}`;
    } else {
        bonusBox.style.display = 'none';
    }

    const msgEl = document.getElementById('daily-message');
    const iconEl = document.getElementById('daily-icon');
    if (percent === 100) {
        msgEl.innerText = getRandomMessage(MESSAGES_100);
        iconEl.innerText = '🎉';
    } else {
        msgEl.innerText = getRandomMessage(MESSAGES_PARTIAL);
        iconEl.innerText = '💪';
    }

    modalDaily.classList.remove('hidden');
    renderHeader();
}

function getRandomMessage(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// ─────────────────────────────────────────────
// Weekly Report
// ─────────────────────────────────────────────
function checkWeeklyReport() {
    const last7Days = data.history.slice(-7);
    if (last7Days.length === 0) return;

    let allPerfect = true;
    let continuous = true;

    last7Days.forEach(day => {
        if (!day.isPerfect) allPerfect = false;
        if (day.percent === 0) continuous = false;
    });

    const badgeEl = document.getElementById('weekly-badge');
    const descEl = document.getElementById('weekly-desc');

    if (allPerfect && last7Days.length >= 5) {
        badgeEl.innerText = "Perfect Week! 🏆";
        descEl.innerText = "지난 1주일간 모든 과제를 100% 달성했어요. 정말 완벽해요!";
        modalWeekly.classList.remove('hidden');
    } else if (continuous && last7Days.length >= 5) {
        badgeEl.innerText = "Continuous Week 🔥";
        descEl.innerText = "100%는 아니지만 매일 꾸준히 공부했어요. 끈기가 대단해요!";
        modalWeekly.classList.remove('hidden');
    }
}

// ─────────────────────────────────────────────
// 히스토리 달력 뷰
// ─────────────────────────────────────────────
let calYear, calMonth;

function openCalendar() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth(); // 0-indexed
    renderCalendar();
    document.getElementById('modal-calendar').classList.remove('hidden');
    sideMenu.classList.add('hidden');
}

function renderCalendar() {
    const titleEl = document.getElementById('cal-title');
    const gridEl = document.getElementById('cal-grid');

    titleEl.innerText = `${calYear}년 ${calMonth + 1}월`;
    gridEl.innerHTML = '';

    // 해당 월의 1일 요일 & 마지막 날
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=일
    const lastDate = new Date(calYear, calMonth + 1, 0).getDate();

    // 히스토리 맵 생성 { 'YYYY-MM-DD': percent }
    const histMap = {};
    data.history.forEach(h => { histMap[h.date] = h.percent; });

    // 빈 칸 채우기
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-cell empty';
        gridEl.appendChild(empty);
    }

    for (let d = 1; d <= lastDate; d++) {
        const mm = String(calMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${calYear}-${mm}-${dd}`;

        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        cell.innerText = d;

        if (dateStr === TODAY) cell.classList.add('cal-today');

        if (histMap[dateStr] !== undefined) {
            const pct = histMap[dateStr];
            if (pct === 100) {
                cell.classList.add('cal-100');
            } else if (pct > 0) {
                cell.classList.add('cal-partial');
            } else {
                cell.classList.add('cal-zero');
            }
            cell.title = `${pct}% 달성`;
        }

        gridEl.appendChild(cell);
    }
}

document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
});

// ─────────────────────────────────────────────
// Timer & UI Structure
// ─────────────────────────────────────────────
function setupUIStructure() {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

    const style = document.createElement('style');
    style.innerHTML = `
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { height: 100%; width: 100%; overflow: hidden; margin: 0; position: fixed; top: 0; left: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        
        #bottom-nav { 
            position: fixed; bottom: 0; left: 0; width: 100%; 
            height: calc(60px + env(safe-area-inset-bottom)); 
            padding-bottom: env(safe-area-inset-bottom);
            background: #fff; border-top: 1px solid #eee; 
            display: flex; justify-content: space-around; align-items: center; z-index: 100; 
        }
        .nav-item { flex: 1; text-align: center; padding: 10px; color: #8b95a1; cursor: pointer; font-size: 14px; }
        .nav-item.active { color: #3182f6; font-weight: bold; }
        .nav-icon { display: block; font-size: 20px; margin-bottom: 4px; }
        
        .view-transition {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            overflow-y: auto; -webkit-overflow-scrolling: touch;
            transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
            box-sizing: border-box;
            background: transparent;
        }
        .app-container { margin: 0 auto; }
        
        #view-planner { padding-bottom: calc(90px + env(safe-area-inset-bottom)); transform: translateX(0); background: #f2f4f6; }
        #view-timer { padding: 20px; padding-bottom: calc(90px + env(safe-area-inset-bottom)); text-align: center; transform: translateX(100%); }
        #view-timer > * { max-width: 480px; margin-left: auto; margin-right: auto; }

        .timer-display { font-size: 15vw; font-weight: bold; margin: 5vh 0; font-variant-numeric: tabular-nums; }
        @media (min-width: 400px) { .timer-display { font-size: 60px; margin: 40px 0; } }

        .timer-controls { margin-top: 20px; }
        .btn-main { background: #3182f6; color: white; border: none; padding: 15px 40px; border-radius: 30px; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(49, 130, 246, 0.3); width: 80%; max-width: 300px; }
        .btn-sub { background: #f2f4f6; color: #4e5968; border: none; padding: 12px 24px; border-radius: 20px; font-size: 16px; font-weight: 600; cursor: pointer; margin: 0 5px; }
        
        .stats-container { margin-top: 40px; background: #f9fafb; padding: 20px; border-radius: 16px; text-align: left; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .stat-item h4 { font-size: 12px; color: #8b95a1; margin: 0 0 5px 0; }
        .stat-item p { font-size: 16px; font-weight: bold; color: #333; margin: 0; }
        .chart-box { height: 150px; display: flex; align-items: flex-end; justify-content: space-between; padding-top: 20px; }
        .bar-group { display: flex; flex-direction: column; align-items: center; width: 15%; }
        .bar { width: 100%; background: #3182f6; border-radius: 4px 4px 0 0; transition: height 0.3s; min-height: 4px; opacity: 0.3; }
        .bar.today { opacity: 1; }
        .bar-label { font-size: 10px; color: #8b95a1; margin-top: 6px; }
        .timer-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999; display: none; } 
        #add-subject-btn { bottom: calc(80px + env(safe-area-inset-bottom)) !important; right: 20px !important; position: fixed !important; }
        
        body { transition: background-color 0.5s; }
        body.focus-mode { background: linear-gradient(to bottom, #0f2027, #203a43, #2c5364); color: white; }
        body.focus-mode .timer-display { color: white; }
        body.focus-mode #timer-msg { color: #cbd5e1 !important; }
        body.focus-mode .btn-sub { background: rgba(255,255,255,0.2); color: white; }
        
        .coin-toast {
            position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.4); color: #fff; padding: 12px 24px; border-radius: 50px;
            font-size: 16px; font-weight: bold; pointer-events: none; opacity: 0; transition: opacity 0.8s; z-index: 2000; width: max-content;
        }
        .coin-toast.show { opacity: 1; }

        #star-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
        .star {
            position: absolute; background: white; border-radius: 50%;
            animation: twinkle 2s infinite ease-in-out;
            opacity: 0;
        }
        @keyframes twinkle { 0% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 4px #fff; } 100% { opacity: 0.2; transform: scale(0.8); } }
    `;
    document.head.appendChild(style);

    plannerViewEl = document.createElement('div');
    plannerViewEl.id = 'view-planner';
    plannerViewEl.className = 'view-transition';
    
    const children = Array.from(document.body.children);
    children.forEach(child => {
        if (child.tagName !== 'SCRIPT' && child.id !== 'side-menu' && !child.classList.contains('modal')) {
            plannerViewEl.appendChild(child);
        }
    });
    document.body.insertBefore(plannerViewEl, document.body.firstChild);

    timerViewEl = document.createElement('div');
    timerViewEl.id = 'view-timer';
    timerViewEl.className = 'view-transition';
    timerViewEl.innerHTML = `
        <div id="star-container"></div>
        <div id="theme-renderer"></div>
        <div class="timer-display" id="timer-display">00:00:00</div>
        <div id="timer-msg" style="color:#8b95a1; margin-bottom:20px;">집중할 준비가 되었나요?</div>
        <div id="today-total-time" style="font-size:18px; font-weight:600; color:#3182f6; margin-bottom:30px;">오늘 순공: 0분</div>
        
        <div class="timer-controls" id="timer-start-area">
            <button class="btn-main" id="btn-start-timer">집중 시작</button>
        </div>
        
        <div class="timer-controls hidden" id="timer-pause-area">
            <button class="btn-sub" id="btn-resume-timer">다시 시작</button>
            <button class="btn-sub" id="btn-stop-timer" style="color:#e94e58; background:#fff0f1;">끝내기</button>
        </div>

        <div class="stats-container">
            <h3>🔥 학습 통계 (최근 5일)</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <h4>평균 순공</h4>
                    <p id="stat-avg-total">-</p>
                </div>
                <div class="stat-item">
                    <h4>평균 지속</h4>
                    <p id="stat-avg-session">-</p>
                </div>
                <div class="stat-item">
                    <h4>최고 지속</h4>
                    <p id="stat-max-session">-</p>
                </div>
            </div>
            <div class="chart-box" id="chart-box"></div>
        </div>
        <div class="timer-overlay" id="timer-touch-layer"></div>
    `;
    document.body.insertBefore(timerViewEl, document.getElementById('side-menu'));

    const nav = document.createElement('nav');
    nav.id = 'bottom-nav';
    nav.innerHTML = `
        <div class="nav-item active" data-target="planner">
            <span class="nav-icon">📝</span>플래너
        </div>
        <div class="nav-item" data-target="timer">
            <span class="nav-icon">⏱️</span>타이머
        </div>
    `;
    document.body.appendChild(nav);

    nav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            nav.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.dataset.target;
            if (target === 'planner') {
                plannerViewEl.style.transform = 'translateX(0)';
                timerViewEl.style.transform = 'translateX(100%)';
                plannerViewEl.scrollTo(0, 0);
                renderHeader();
            } else {
                plannerViewEl.style.transform = 'translateX(-100%)';
                timerViewEl.style.transform = 'translateX(0)';
                timerViewEl.scrollTo(0, 0);
                renderStats();
            }
        });
    });

    document.getElementById('btn-start-timer').addEventListener('click', startTimer);
    document.getElementById('btn-resume-timer').addEventListener('click', startTimer);
    document.getElementById('btn-stop-timer').addEventListener('click', stopTimer);
    document.getElementById('timer-touch-layer').addEventListener('click', pauseTimer);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isTimerRunning) {
            pauseTimer(false);
        }
    });
}

function startTimer() {
    isTimerRunning = true;
    document.getElementById('timer-start-area').classList.add('hidden');
    document.getElementById('timer-pause-area').classList.add('hidden');
    document.getElementById('timer-msg').innerText = "잠깐 멈추기";
    document.getElementById('timer-touch-layer').style.display = 'block';
    document.body.classList.add('focus-mode');
    data.timerRunningState = true;
    saveData();
    
    if (window.applyCurrentTheme) {
        window.applyCurrentTheme();
    } else {
        createStars();
    }

    timerInterval = setInterval(() => {
        currentSessionTime++;
        updateTimerDisplay();
        updateTodayTotalTime();
        
        if (currentSessionTime > 0 && currentSessionTime % 600 === 0) {
            showCoinToast();
        }

        data.savedSessionTime = currentSessionTime;
        saveData();
    }, 1000);
}

function createStars() {
    const container = document.getElementById('star-container');
    if (!container || container.children.length > 0) return;

    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const duration = Math.random() * 1.5 + 1.5;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.width = `${Math.random() * 3 + 1}px`;
        star.style.height = star.style.width;
        star.style.animationDuration = `${duration}s`;
        star.style.animationDelay = `${Math.random() * 2}s`;
        container.appendChild(star);
    }
}

function pauseTimer(fromUser = true) {
    if (!isTimerRunning) return;
    isTimerRunning = false;
    clearInterval(timerInterval);
    document.body.classList.remove('focus-mode');
    
    if (window.removeCurrentTheme) {
        window.removeCurrentTheme();
    }
    
    document.getElementById('timer-touch-layer').style.display = 'none';
    
    if (fromUser) {
        data.timerRunningState = false;
        pauseTimerUI();
    }
    
    data.savedSessionTime = currentSessionTime;
    saveData();
}

function pauseTimerUI() {
    document.getElementById('timer-pause-area').classList.remove('hidden');
    document.getElementById('timer-start-area').classList.add('hidden');
    document.getElementById('timer-msg').innerText = "잠시 휴식 중... ☕";
}

function recordSession(seconds) {
    const earnedCoins = Math.floor(seconds / 600) * 10;
    if (earnedCoins > 0) {
        data.coins += earnedCoins;
    }

    const todayStr = TODAY;
    let todayRecord = data.timerHistory.find(h => h.date === todayStr);
    
    if (!todayRecord) {
        todayRecord = { date: todayStr, totalTime: 0, maxDuration: 0, sessions: 0 };
        data.timerHistory.push(todayRecord);
    }

    todayRecord.totalTime += seconds;
    todayRecord.sessions += 1;
    if (seconds > todayRecord.maxDuration) {
        todayRecord.maxDuration = seconds;
    }
    return earnedCoins;
}

function stopTimer() {
    showConfirm({
        icon: '⏱️',
        title: '집중 종료',
        message: '집중을 끝내고 기록할까요?',
        onOk: () => {
            pauseTimer(true);
            const earnedCoins = recordSession(currentSessionTime);
            
            if (earnedCoins > 0) {
                showAlert({
                    icon: '💰',
                    title: '코인 획득!',
                    message: `${Math.floor(currentSessionTime/60)}분 집중해서 ${earnedCoins}코인을 받았어요!`
                });
            }

            currentSessionTime = 0;
            data.savedSessionTime = 0;
            saveData();
            
            updateTimerDisplay();
            updateTodayTotalTime();
            document.getElementById('timer-pause-area').classList.add('hidden');
            document.getElementById('timer-start-area').classList.remove('hidden');
            document.getElementById('timer-msg').innerText = "집중할 준비가 되었나요?";
            renderStats();
        }
    });
}

function updateTimerDisplay() {
    const h = String(Math.floor(currentSessionTime / 3600)).padStart(2, '0');
    const m = String(Math.floor((currentSessionTime % 3600) / 60)).padStart(2, '0');
    const s = String(currentSessionTime % 60).padStart(2, '0');
    document.getElementById('timer-display').innerText = `${h}:${m}:${s}`;
}

function showCoinToast() {
    let toast = document.getElementById('coin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'coin-toast';
        toast.className = 'coin-toast';
        toast.innerText = '💰 10코인 획득!';
        document.body.appendChild(toast);
    }
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

function renderStats() {
    data.timerHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    const recentHistory = data.timerHistory.slice(-5);
    
    let totalTimeSum = 0;
    let totalSessionSum = 0;
    let maxSessionAll = 0;
    let maxDailyTotal = 0;

    recentHistory.forEach(h => {
        totalTimeSum += h.totalTime;
        totalSessionSum += h.sessions;
        if (h.maxDuration > maxSessionAll) maxSessionAll = h.maxDuration;
        if (h.totalTime > maxDailyTotal) maxDailyTotal = h.totalTime;
    });

    const avgTotal = recentHistory.length ? Math.floor(totalTimeSum / recentHistory.length) : 0;
    const avgSession = totalSessionSum ? Math.floor(totalTimeSum / totalSessionSum) : 0;

    document.getElementById('stat-avg-total').innerText = formatTimeSimple(avgTotal);
    document.getElementById('stat-avg-session').innerText = formatTimeSimple(avgSession);
    document.getElementById('stat-max-session').innerText = formatTimeSimple(maxSessionAll);

    const chartBox = document.getElementById('chart-box');
    chartBox.innerHTML = '';

    for (let i = 4; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // 가상 날짜 기준 사용
        const offset = d.getTimezoneOffset() * 60000;
        const dateStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
        const record = recentHistory.find(h => h.date === dateStr);
        const val = record ? record.totalTime : 0;
        
        const heightPercent = maxDailyTotal > 0 ? (val / maxDailyTotal) * 100 : 0;
        const isToday = dateStr === TODAY;

        const barGroup = document.createElement('div');
        barGroup.className = 'bar-group';
        barGroup.innerHTML = `
            <div class="bar ${isToday ? 'today' : ''}" style="height: ${heightPercent}%"></div>
            <div class="bar-label">${d.getMonth()+1}/${d.getDate()}</div>
        `;
        chartBox.appendChild(barGroup);
    }
    updateTodayTotalTime();
}

function updateTodayTotalTime() {
    const todayRecord = data.timerHistory.find(h => h.date === TODAY);
    const totalSeconds = todayRecord ? todayRecord.totalTime : 0;
    const displaySeconds = totalSeconds + (isTimerRunning ? currentSessionTime : 0);
    
    const el = document.getElementById('today-total-time');
    if (el) el.innerText = `오늘 순공: ${formatTimeSimple(displaySeconds)}`;
}

function formatTimeSimple(seconds) {
    if (seconds < 60) return `${seconds}초`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    return `${h}시간 ${m%60}분`;
}

// ─────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────
function setupEventListeners() {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

    document.getElementById('btn-close-daily').addEventListener('click', () => {
        modalDaily.classList.add('hidden');
    });
    document.getElementById('btn-close-weekly').addEventListener('click', () => {
        modalWeekly.classList.add('hidden');
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
        sideMenu.classList.remove('hidden');
    });
    document.getElementById('menu-backdrop').addEventListener('click', () => {
        sideMenu.classList.add('hidden');
    });

    document.getElementById('menu-store').addEventListener('click', () => {
        if (window.openShop) {
            window.openShop();
        } else {
            showAlert({ icon: '🏠', title: '상점', message: 'shop.js 파일이 연결되지 않았습니다.' });
        }
    });

    document.getElementById('menu-manage').addEventListener('click', () => {
        isEditMode = !isEditMode;
        sideMenu.classList.add('hidden');
        renderTasks();
        const fab = document.getElementById('add-subject-btn');
        fab.innerText = isEditMode ? '✓' : '+';
        fab.onclick = isEditMode ? () => {
            isEditMode = false;
            renderTasks();
            fab.innerText = '+';
            fab.onclick = null;
        } : null;
    });

    // 달력 메뉴
    document.getElementById('menu-calendar').addEventListener('click', openCalendar);

    const btnSound = document.getElementById('menu-sound');
    const updateSoundBtn = () => {
        btnSound.innerText = data.soundEnabled ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
    };
    updateSoundBtn();
    btnSound.addEventListener('click', () => {
        data.soundEnabled = !data.soundEnabled;
        saveData();
        updateSoundBtn();
    });

    const btnReset = document.getElementById('menu-reset');
    if (btnReset && !document.getElementById('menu-export')) {
        const parent = btnReset.parentNode;
        const btnExport = btnReset.cloneNode(true);
        btnExport.id = 'menu-export';
        btnExport.innerText = '📤 데이터 백업';
        btnExport.style.color = '';
        btnExport.addEventListener('click', exportData);
        
        const btnImport = btnReset.cloneNode(true);
        btnImport.id = 'menu-import';
        btnImport.innerText = '📥 데이터 복구';
        btnImport.style.color = '';
        btnImport.addEventListener('click', importData);
        
        parent.insertBefore(btnExport, btnReset);
        parent.insertBefore(btnImport, btnReset);
    }

    btnReset.addEventListener('click', () => {
        showConfirm({
            icon: '🗑️',
            title: '데이터 초기화',
            message: '정말 모든 데이터를 초기화할까요? 복구할 수 없어요.',
            onOk: () => {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        });
    });

    document.getElementById('input-goal').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
    document.getElementById('edit-goal').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
}

// Console command (개발용)
window.getcoin = function(amount) {
    data.coins += amount;
    saveData();
    renderHeader();
    console.log(`💰 ${amount} 코인 지급. 현재: ${data.coins}`);
};

// Start App
init();
