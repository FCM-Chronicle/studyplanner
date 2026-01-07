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
    soundEnabled: true, // 소리 설정 기본값
    timerHistory: [], // { date: 'YYYY-MM-DD', totalTime: 0, maxDuration: 0, sessions: 0 }
    savedSessionTime: 0, // 중단된 세션 시간 저장 (초 단위)
    timerRunningState: false, // 타이머가 실행 중이었는지 여부 (새로고침 구분용)
    inventory: ['default'], // 보유 중인 테마 목록
    currentTheme: 'default' // 현재 선택된 테마
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
let timerViewEl, plannerViewEl; // 뷰 요소
let timerInterval = null;
let isTimerRunning = false;
let currentSessionTime = 0;

// --- Initialization ---
function init() {
    loadData();
    checkDateChange();
    setupUIStructure(); // UI 구조 변경 (탭바, 타이머 뷰 추가)
    renderHeader();
    renderTasks();
    setupEventListeners();
    
    // 타이머 상태 복구 로직
    if (data.timerRunningState) {
        // 1. 실행 중 새로고침됨 -> 세션 종료 및 저장
        if (data.savedSessionTime > 0) {
            const earnedCoins = recordSession(data.savedSessionTime);
            let msg = '앱이 종료되어 집중 시간이 기록되었습니다.';
            if (earnedCoins > 0) msg += ` (+${earnedCoins}코인)`;
            alert(msg);
        }
        // 데이터 초기화
        data.savedSessionTime = 0;
        data.timerRunningState = false;
        saveData();
        currentSessionTime = 0;
        updateTimerDisplay();
        renderStats();
    } else if (data.savedSessionTime > 0) {
        // 2. 일시 정지 상태에서 새로고침됨 -> 세션 복구
        currentSessionTime = data.savedSessionTime;
        updateTimerDisplay();
        // UI를 일시 정지 상태로 변경
        pauseTimerUI(); 
    }
}

// --- Data Management ---
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        data = JSON.parse(stored);
        if (data.soundEnabled === undefined) data.soundEnabled = true; // 기존 데이터 호환
        if (!data.timerHistory) data.timerHistory = [];
        if (!data.savedSessionTime) data.savedSessionTime = 0;
        if (data.timerRunningState === undefined) data.timerRunningState = false;
        if (!data.inventory) data.inventory = ['default'];
        if (!data.currentTheme) data.currentTheme = 'default';
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- JSON Export/Import ---
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
                    if (confirm('현재 데이터를 덮어쓰고 불러오시겠습니까?')) {
                        data = newData;
                        saveData();
                        renderHeader();
                        renderTasks();
                        alert('데이터를 성공적으로 불러왔습니다.');
                        sideMenu.classList.add('hidden');
                    }
                } else {
                    alert('올바르지 않은 데이터 파일입니다.');
                }
            } catch (err) {
                alert('파일을 읽는 중 오류가 발생했습니다.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
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
                <p>${task.workbook} <span style="color:#3182f6; font-weight:600; font-size:14px; margin-left:4px;">(${task.current}/${task.goal}${task.unit})</span></p>
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

// --- Timer & Stats Logic ---

function setupUIStructure() {
    // 0. Viewport Meta Tag (강제 업데이트)
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

    // 1. 스타일 주입
    const style = document.createElement('style');
    style.innerHTML = `
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { height: 100%; width: 100%; overflow: hidden; margin: 0; position: fixed; top: 0; left: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        
        /* 하단 탭바 (Safe Area 대응) */
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
        
        /* 슬라이드 전환을 위한 스타일 */
        .view-transition {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            overflow-y: auto; -webkit-overflow-scrolling: touch; /* 내부 스크롤 활성화 */
            transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1); /* 부드러운 감속 효과 */
            box-sizing: border-box;
            background: transparent; /* 배경 투명화 (body 배경 보이게) */
        }
        .app-container { margin: 0 auto; } /* 데스크탑 중앙 정렬 유지 */
        
        /* 뷰별 패딩 (탭바 높이 + 여유분 + Safe Area) */
        #view-planner { padding-bottom: calc(90px + env(safe-area-inset-bottom)); transform: translateX(0); background: #f2f4f6; }
        #view-timer { padding: 20px; padding-bottom: calc(90px + env(safe-area-inset-bottom)); text-align: center; transform: translateX(100%); }
        #view-timer > * { max-width: 480px; margin-left: auto; margin-right: auto; }

        /* 타이머 반응형 폰트 */
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
        
        /* Focus Mode (Starry Night) & Toast */
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

        /* Stars Animation */
        #star-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
        .star {
            position: absolute; background: white; border-radius: 50%;
            animation: twinkle 2s infinite ease-in-out;
            opacity: 0;
        }
        @keyframes twinkle { 0% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); box-shadow: 0 0 4px #fff; } 100% { opacity: 0.2; transform: scale(0.8); } }
    `;
    document.head.appendChild(style);

    // 2. 뷰 컨테이너 생성 및 기존 요소 이동
    plannerViewEl = document.createElement('div');
    plannerViewEl.id = 'view-planner';
    plannerViewEl.className = 'view-transition';
    
    // body의 기존 자식들을 plannerViewEl로 이동 (스크립트 태그 제외)
    const children = Array.from(document.body.children);
    children.forEach(child => {
        if (child.tagName !== 'SCRIPT' && child.id !== 'side-menu' && !child.classList.contains('modal')) {
            plannerViewEl.appendChild(child);
        }
    });
    document.body.insertBefore(plannerViewEl, document.body.firstChild);

    // 3. 타이머 뷰 생성
    timerViewEl = document.createElement('div');
    timerViewEl.id = 'view-timer';
    timerViewEl.className = 'view-transition';
    timerViewEl.innerHTML = `
        <div id="star-container"></div>
        <div id="theme-renderer"></div>
        <div class="timer-display" id="timer-display">00:00:00</div>
        <div id="timer-msg" style="color:#8b95a1; margin-bottom:20px;">집중할 준비가 되었나요?</div>
        
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
            <div class="chart-box" id="chart-box">
                <!-- 그래프 바 동적 생성 -->
            </div>
        </div>
        <div class="timer-overlay" id="timer-touch-layer"></div>
    `;
    document.body.insertBefore(timerViewEl, document.getElementById('side-menu'));

    // 4. 하단 탭바 생성
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

    // 탭 전환 로직
    nav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            nav.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.dataset.target;
            if (target === 'planner') {
                plannerViewEl.style.transform = 'translateX(0)';
                timerViewEl.style.transform = 'translateX(100%)';
                plannerViewEl.scrollTo(0, 0); // 플래너 스크롤 맨 위로
                renderHeader(); // 헤더 갱신
            } else {
                plannerViewEl.style.transform = 'translateX(-100%)';
                timerViewEl.style.transform = 'translateX(0)';
                timerViewEl.scrollTo(0, 0); // 타이머 스크롤 맨 위로
                renderStats(); // 통계 갱신
            }
        });
    });

    // 타이머 이벤트 연결
    document.getElementById('btn-start-timer').addEventListener('click', startTimer);
    document.getElementById('btn-resume-timer').addEventListener('click', startTimer);
    document.getElementById('btn-stop-timer').addEventListener('click', stopTimer);
    
    // 화면 터치 시 멈춤 (투명 레이어)
    document.getElementById('timer-touch-layer').addEventListener('click', pauseTimer);

    // 백그라운드 감지 (앱 이탈, 화면 꺼짐 등)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isTimerRunning) {
            pauseTimer(false); // 시스템에 의한 일시 정지 (Running 상태 유지)
        }
    });
}

function startTimer() {
    isTimerRunning = true;
    document.getElementById('timer-start-area').classList.add('hidden');
    document.getElementById('timer-pause-area').classList.add('hidden');
    document.getElementById('timer-msg').innerText = "잠깐 멈추기";
    document.getElementById('timer-touch-layer').style.display = 'block'; // 터치 감지 활성화
    document.body.classList.add('focus-mode'); // 테마 변경
    data.timerRunningState = true; // 실행 상태 기록
    saveData();
    
    // 테마 적용 (shop.js의 함수가 있다면 사용, 없으면 기본 별 생성)
    if (window.applyCurrentTheme) {
        window.applyCurrentTheme();
    } else {
        createStars(); 
    }

    timerInterval = setInterval(() => {
        currentSessionTime++;
        updateTimerDisplay();
        
        // 10분(600초)마다 코인 획득 알림
        if (currentSessionTime > 0 && currentSessionTime % 600 === 0) {
            showCoinToast();
        }

        // 실시간 저장 (새로고침 대비)
        data.savedSessionTime = currentSessionTime;
        saveData();
    }, 1000);
}

function createStars() {
    const container = document.getElementById('star-container');
    if (!container || container.children.length > 0) return; // 이미 있으면 생성 안 함

    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const xy = Math.random() * 100;
        const duration = Math.random() * 1.5 + 1.5; // 1.5s ~ 3s
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
    document.body.classList.remove('focus-mode'); // 테마 복구
    
    if (window.removeCurrentTheme) {
        window.removeCurrentTheme();
    }
    
    document.getElementById('timer-touch-layer').style.display = 'none'; // 터치 감지 해제
    
    // 사용자가 직접 멈춘 경우에만 '일시 정지' 상태로 기록
    // (백그라운드/새로고침 등은 Running 상태 유지 -> 재접속 시 종료 처리)
    if (fromUser) {
        data.timerRunningState = false;
        pauseTimerUI();
    }
    
    data.savedSessionTime = currentSessionTime;
    saveData();
}

// UI만 일시 정지 상태로 변경하는 함수 (init 등에서 재사용)
function pauseTimerUI() {
    document.getElementById('timer-pause-area').classList.remove('hidden');
    document.getElementById('timer-start-area').classList.add('hidden');
    document.getElementById('timer-msg').innerText = "잠시 휴식 중... ☕";
}

// 세션 기록 로직 분리 (init과 stopTimer에서 공유)
function recordSession(seconds) {
    // 1. 코인 보상
    const earnedCoins = Math.floor(seconds / 600) * 10;
    if (earnedCoins > 0) {
        data.coins += earnedCoins;
    }

    // 2. 통계 저장
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
    if (confirm('집중을 끝내고 기록할까요?')) {
        pauseTimer(true); // 확실히 멈춤 (사용자 의도)
        const earnedCoins = recordSession(currentSessionTime);
        
        if (earnedCoins > 0) {
            alert(`${Math.floor(currentSessionTime/60)}분 집중해서 ${earnedCoins}코인을 받았어요! 💰`);
        }

        // 3. 초기화
        currentSessionTime = 0;
        data.savedSessionTime = 0;
        saveData();
        
        updateTimerDisplay();
        document.getElementById('timer-pause-area').classList.add('hidden');
        document.getElementById('timer-start-area').classList.remove('hidden');
        document.getElementById('timer-msg').innerText = "집중할 준비가 되었나요?";
        renderStats();
    }
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
    void toast.offsetWidth; // Reflow
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function renderStats() {
    // 최근 5일 데이터 가져오기
    // 날짜순 정렬 보장
    data.timerHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 최근 5일치만 (데이터가 적으면 있는 만큼)
    const recentHistory = data.timerHistory.slice(-5);
    
    // 통계 계산
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

    // 그래프 렌더링
    const chartBox = document.getElementById('chart-box');
    chartBox.innerHTML = '';

    // 최근 5일이 아니더라도 오늘 포함 5칸을 채우기 위해 날짜 생성
    for (let i = 4; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const record = recentHistory.find(h => h.date === dateStr);
        const val = record ? record.totalTime : 0;
        
        // 최대값 기준 높이 비율 (최대값이 0이면 0)
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
}

function formatTimeSimple(seconds) {
    if (seconds < 60) return `${seconds}초`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    return `${h}시간 ${m%60}분`;
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
        if (window.openShop) {
            window.openShop();
        } else {
            alert('shop.js 파일이 연결되지 않았습니다. HTML에 <script src="shop.js"></script>를 추가해주세요.');
        }
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
    const btnReset = document.getElementById('menu-reset');
    
    // 백업/복구 버튼 동적 추가
    if (btnReset && !document.getElementById('menu-export')) {
        const parent = btnReset.parentNode;
        
        const btnExport = btnReset.cloneNode(true);
        btnExport.id = 'menu-export';
        btnExport.innerText = '📤 데이터 백업';
        btnExport.addEventListener('click', exportData);
        
        const btnImport = btnReset.cloneNode(true);
        btnImport.id = 'menu-import';
        btnImport.innerText = '📥 데이터 복구';
        btnImport.addEventListener('click', importData);
        
        parent.insertBefore(btnExport, btnReset);
        parent.insertBefore(btnImport, btnReset);
    }

    btnReset.addEventListener('click', () => {
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

// --- Console Commands ---
window.getcoin = function(amount) {
    data.coins += amount;
    saveData();
    renderHeader();
    console.log(`💰 ${amount} 코인이 지급되었습니다! 현재 코인: ${data.coins}`);
};

// Start App
init();
