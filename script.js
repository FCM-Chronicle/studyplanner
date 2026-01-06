// script.js

// --- Constants & State ---
const STORAGE_KEY = 'toss_study_planner_v2'; // 버전 변경 (데이터 구조 변경 대비)

function getVirtualToday() {
    const now = new Date();
    // 3시 1분 기준 (새벽 3시까지는 전날로 처리하기 위해 3시간 1분을 뺌)
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
    history: [], // { date: '...', percent: 100 }
    tasks: [],   // { id, subject, workbook, goal, unit, current, completed: boolean }
    soundEnabled: true // 소리 설정 기본값
};
let isEditMode = false;

// --- DOM Elements ---
const taskListEl = document.getElementById('task-list');
const streakCountEl = document.getElementById('streak-count');
const coinCountEl = document.getElementById('coin-count');
const modalAdd = document.getElementById('modal-add');
const modalProgress = document.getElementById('modal-progress');
const modalDaily = document.getElementById('modal-daily-report');
const modalWeekly = document.getElementById('modal-weekly-report');
const sideMenu = document.getElementById('side-menu');

// --- Initialization ---
function init() {
    loadData();
    checkDateChange();
    renderHeader();
    renderTasks();
    setupEventListeners();
}

// --- Data Management ---
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        data = JSON.parse(stored);
        if (data.soundEnabled === undefined) data.soundEnabled = true; // 기존 데이터 호환
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- Date & Logic ---
function checkDateChange() {
    if (data.lastDate !== TODAY) {
        // 날짜가 변경됨 -> 저장된 tasks는 '어제(또는 마지막 접속일)'의 데이터임
        // 따라서 리셋하기 전에 정산을 먼저 수행해야 함
        processDailyRecap(data.lastDate);
        
        // 날짜 갱신 및 초기화
        data.lastDate = TODAY;
        
        // 과목은 유지하되, 진행률(current)은 0으로 리셋, 완료 상태 해제
        data.tasks.forEach(task => {
            task.current = 0;
            task.completed = false;
        });
        
        saveData();
    }
}

function processDailyRecap(yesterdayDate) {
    // 1. 어제 달성률 계산
    // 과목이 없었으면 기록할 것도 없음
    if (data.tasks.length === 0) return;

    let totalGoal = 0;
    let totalDone = 0;

    data.tasks.forEach(task => {
        // 각 과목의 달성률 (0~1)
        let ratio = task.goal === 0 ? 0 : (task.current / task.goal);
        if (ratio > 1) ratio = 1; // 100% 초과 방지
        
        totalDone += ratio;
        totalGoal += 1;
    });

    const percent = totalGoal === 0 ? 0 : Math.floor((totalDone / totalGoal) * 100);
    const isPerfect = (percent === 100);

    // 2. 스트릭 업데이트
    if (percent > 0) {
        data.streak += 1;
    } else {
        data.streak = 0; // 하나도 안했으면 초기화
    }

    // 3. 코인 보상 (퍼센트만큼 지급)
    const earnedCoins = percent; 
    data.coins += earnedCoins;

    // 4. 히스토리 저장
    data.history.push({
        date: yesterdayDate,
        percent: percent,
        isPerfect: isPerfect
    });

    // 5. 일일 리포트 모달 표시 준비
    showDailyReport(percent, earnedCoins);

    // 6. 주간 리포트 체크 (월요일이거나 7일 주기)
    // 여기서는 오늘이 월요일이면 지난주 리포트를 보여주는 로직으로 구현
    const todayDay = new Date().getDay(); // 0:일, 1:월 ...
    if (todayDay === 1) { 
        checkWeeklyReport();
    }
}

// --- Rendering ---
function renderHeader() {
    streakCountEl.innerText = `${data.streak}일 연속`;
    coinCountEl.innerText = `${data.coins}`;
}

function renderTasks() {
    taskListEl.innerHTML = '';
    
    if (data.tasks.length === 0) {
        taskListEl.innerHTML = `
            <div class="empty-state" style="text-align:center; padding: 40px; color: #8b95a1;">
                <p>오늘 할 공부를 추가해보세요!</p>
            </div>`;
        return;
    }

    data.tasks.forEach(task => {
        // 100% 달성 여부 확인
        const isDone = task.current >= task.goal;
        const isPartial = task.current > 0 && task.current < task.goal;
        
        let checkClass = '';
        if (isDone) checkClass = 'checked';
        else if (isPartial) checkClass = 'partial';
        
        // 편집 모드일 때 흔들림 효과 추가
        const shakeClass = isEditMode ? 'shaking' : '';

        const card = document.createElement('div');
        card.className = `task-card ${shakeClass}`;
        
        // 편집 모드일 때 클릭 이벤트 변경
        const clickAction = isEditMode 
            ? `handleDeleteRequest(${task.id}, this)` 
            : `openProgressModal(${task.id})`;
            
        // 편집 모드일 때는 체크 영역 클릭도 삭제로 연결하거나 비활성화
        const checkAction = isEditMode
            ? `handleDeleteRequest(${task.id}, this.parentElement)`
            : `openProgressModal(${task.id})`;

        card.innerHTML = `
            <div class="task-content" onclick="${clickAction}">
                <h3>${task.subject}</h3>
                <p>${task.workbook}</p>
            </div>
            <div class="task-check-area" onclick="${checkAction}">
                <div class="check-circle ${checkClass}"></div>
            </div>
        `;
        
        taskListEl.appendChild(card);
    });
}

// --- Actions ---

// 삭제 요청 처리 (편집 모드)
window.handleDeleteRequest = function(id, element) {
    // element가 task-content나 task-check-area일 수 있으므로 card 찾기
    const card = element.closest('.task-card');
    
    if (confirm('지우시겠습니까?')) {
        // 1. 소리 재생 (설정 확인 및 페이드 아웃)
        if (data.soundEnabled) {
            const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/d/d9/Wilhelm_Scream.ogg');
            audio.volume = 1.0;
            audio.play().catch(e => console.log('Audio play failed', e));

            // 소리 점점 작아지게 (Fade out)
            const fadeInterval = setInterval(() => {
                if (audio.volume > 0.01) {
                    audio.volume -= 0.01;
                } else {
                    clearInterval(fadeInterval);
                }
            }, 10); // 10ms마다
        }

        // 2. 카드 떨어지는 애니메이션
        card.classList.remove('shaking');
        
        // 1초 기다렸다가 떨어지게 수정
        setTimeout(() => {
            card.classList.add('falling');

            // 떨어지는 애니메이션(1s) 후 화면 흔들림
            setTimeout(() => {
                document.body.style.animation = 'screen-shake 0.5s';
                
                // 흔들림 끝난 후 데이터 삭제 및 리렌더링
                setTimeout(() => {
                    document.body.style.animation = '';
                    deleteTask(id);
                }, 500);
            }, 1000); // 떨어지는 시간(1s) 대기
        }, 500); // 떨어지기 전 대기 시간 (0.5초)
    }
};

function deleteTask(id) {
    data.tasks = data.tasks.filter(t => t.id !== id);
    saveData();
    renderTasks();
}

// --- Modals & Actions ---

// 1. Add Subject
const subjectChips = document.querySelectorAll('#subject-chips .chip');
let selectedSubject = '국어';

subjectChips.forEach(chip => {
    chip.addEventListener('click', () => {
        subjectChips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedSubject = chip.dataset.val;
    });
});

document.getElementById('add-subject-btn').addEventListener('click', () => {
    modalAdd.classList.remove('hidden');
});

document.getElementById('btn-save-subject').addEventListener('click', () => {
    const workbook = document.getElementById('input-workbook').value;
    const goal = parseInt(document.getElementById('input-goal').value);
    const unit = document.getElementById('input-unit').value;

    if (!workbook || !goal) {
        alert('모든 정보를 입력해주세요.');
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
    
    // Reset & Close
    document.getElementById('input-workbook').value = '';
    document.getElementById('input-goal').value = '';
    modalAdd.classList.add('hidden');
});

// 2. Update Progress
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
    // Focus input for better UX
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

// 3. Daily Report Logic
function showDailyReport(percent, coins) {
    const titleEl = document.getElementById('daily-title');
    const msgEl = document.getElementById('daily-message');
    const coinEl = document.getElementById('daily-coin');
    const iconEl = document.getElementById('daily-icon');

    titleEl.innerText = `어제는 ${percent}% 달성했어요!`;
    coinEl.innerText = `💰 +${coins}`;

    if (percent === 100) {
        msgEl.innerText = getRandomMessage(MESSAGES_100);
        iconEl.innerText = '🎉';
    } else {
        msgEl.innerText = getRandomMessage(MESSAGES_PARTIAL);
        iconEl.innerText = '💪';
    }

    modalDaily.classList.remove('hidden');
    renderHeader(); // 코인 업데이트 반영
}

function getRandomMessage(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// 4. Weekly Report Logic
function checkWeeklyReport() {
    // 최근 7일 데이터 분석
    // history 배열의 뒤에서부터 7개를 가져옴
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

    if (allPerfect && last7Days.length >= 5) { // 최소 5일 이상 기록이 있고 모두 퍼펙트
        badgeEl.innerText = "Perfect Week! 🏆";
        descEl.innerText = "지난 1주일간 모든 과제를 100% 달성했어요. 정말 완벽해요!";
        modalWeekly.classList.remove('hidden');
    } else if (continuous && last7Days.length >= 5) {
        badgeEl.innerText = "Continuous Week 🔥";
        descEl.innerText = "100%는 아니지만 매일 꾸준히 공부했어요. 끈기가 대단해요!";
        modalWeekly.classList.remove('hidden');
    }
    // 조건 충족 안하면 모달 안 띄움
}

// --- Common Event Listeners ---
function setupEventListeners() {
    // 모달 닫기 버튼들
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

    // 배경 클릭 시 닫기
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // 메뉴 관련 이벤트
    document.getElementById('menu-btn').addEventListener('click', () => {
        sideMenu.classList.remove('hidden');
    });

    document.getElementById('menu-backdrop').addEventListener('click', () => {
        sideMenu.classList.add('hidden');
    });

    // 상점 버튼
    document.getElementById('menu-store').addEventListener('click', () => {
        alert('아직 준비중입니다! 🚧');
    });

    // 공부 관리 버튼 (편집 모드 토글)
    document.getElementById('menu-manage').addEventListener('click', () => {
        isEditMode = !isEditMode;
        sideMenu.classList.add('hidden');
        renderTasks();
        
        // FAB 버튼 상태 변경 (선택사항)
        const fab = document.getElementById('add-subject-btn');
        fab.innerText = isEditMode ? '✓' : '+';
        fab.onclick = isEditMode ? () => { isEditMode = false; renderTasks(); fab.innerText = '+'; fab.onclick = null; setupEventListeners(); } : null;
    });

    // 소리 설정 버튼
    const btnSound = document.getElementById('menu-sound');
    const updateSoundBtn = () => {
        btnSound.innerText = data.soundEnabled ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
    };
    updateSoundBtn(); // 초기 상태 반영

    btnSound.addEventListener('click', () => {
        data.soundEnabled = !data.soundEnabled;
        saveData();
        updateSoundBtn();
    });

    // 데이터 초기화 버튼 (메뉴 내부)
    document.getElementById('menu-reset').addEventListener('click', () => {
        if (confirm('정말 모든 데이터를 초기화할까요? 복구할 수 없어요.')) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    });

    // 목표 분량 숫자만 입력 (문자 입력 시 제거)
    document.getElementById('input-goal').addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
}

// Start App
init();
