// c:\Users\jinuj\vsc\studyplanner\shop.js

// --- Shop Data & Themes ---
const SHOP_ITEMS = [
    {
        id: 'shooting_star',
        name: '💫 별똥별이 떨어지는 밤',
        price: 150,
        desc: '가끔씩 떨어지는 별똥별을 보며 소원을 빌어보세요.',
        render: () => {
            createStars(); // 기본 별 (script.js 함수)
            // 별똥별 CSS 애니메이션 추가
            const container = document.getElementById('theme-renderer');
            for(let i=0; i<3; i++) {
                const star = document.createElement('div');
                star.className = 'shooting-star';
                star.style.top = Math.random() * 50 + '%';
                star.style.left = Math.random() * 100 + '%';
                star.style.animationDelay = Math.random() * 5 + 's';
                container.appendChild(star);
            }
        }
    },
    // --- Zodiac Signs (황도 12궁) ---
    {
        id: 'aries', name: '♈ 양자리', price: 200, desc: '용기와 개척 정신의 상징, 양자리입니다.',
        render: () => renderZodiac('<polyline points="30,60 50,50 70,55 85,70" /><circle cx="30" cy="60" r="2"/><circle cx="50" cy="50" r="2"/><circle cx="70" cy="55" r="2"/><circle cx="85" cy="70" r="2"/>')
    },
    {
        id: 'taurus', name: '♉ 황소자리', price: 200, desc: '풍요와 성실함의 상징, 황소자리입니다.',
        render: () => renderZodiac('<polyline points="30,30 50,50 70,30" /><polyline points="50,50 40,70 60,70" /><circle cx="30" cy="30" r="2"/><circle cx="50" cy="50" r="2"/><circle cx="70" cy="30" r="2"/><circle cx="40" cy="70" r="2"/><circle cx="60" cy="70" r="2"/>')
    },
    {
        id: 'gemini', name: '♊ 쌍둥이자리', price: 200, desc: '지혜와 소통의 상징, 쌍둥이자리입니다.',
        render: () => renderZodiac('<polyline points="30,30 30,70" /><polyline points="70,30 70,70" /><line x1="30" y1="50" x2="70" y2="50" /><circle cx="30" cy="30" r="2"/><circle cx="30" cy="70" r="2"/><circle cx="70" cy="30" r="2"/><circle cx="70" cy="70" r="2"/>')
    },
    {
        id: 'cancer', name: '♋ 게자리', price: 200, desc: '모성애와 감수성의 상징, 게자리입니다.',
        render: () => renderZodiac('<polyline points="50,50 30,30" /><polyline points="50,50 70,30" /><polyline points="50,50 50,80" /><circle cx="50" cy="50" r="2"/><circle cx="30" cy="30" r="2"/><circle cx="70" cy="30" r="2"/><circle cx="50" cy="80" r="2"/>')
    },
    {
        id: 'leo', name: '♌ 사자자리', price: 200, desc: '열정과 리더십의 상징, 사자자리입니다.',
        render: () => renderZodiac('<polyline points="70,30 60,20 40,20 30,40 40,60 70,70" /><circle cx="70" cy="30" r="2"/><circle cx="60" cy="20" r="2"/><circle cx="40" cy="20" r="2"/><circle cx="30" cy="40" r="2"/><circle cx="40" cy="60" r="2"/><circle cx="70" cy="70" r="2"/>')
    },
    {
        id: 'virgo', name: '♍ 처녀자리', price: 200, desc: '순수와 섬세함의 상징, 처녀자리입니다.',
        render: () => renderZodiac('<polyline points="30,30 50,30 50,70 70,70" /><polyline points="50,50 70,50" /><circle cx="30" cy="30" r="2"/><circle cx="50" cy="30" r="2"/><circle cx="50" cy="70" r="2"/><circle cx="70" cy="70" r="2"/><circle cx="50" cy="50" r="2"/><circle cx="70" cy="50" r="2"/>')
    },
    {
        id: 'libra', name: '♎ 천칭자리', price: 200, desc: '조화와 균형의 상징, 천칭자리입니다.',
        render: () => renderZodiac('<polyline points="50,30 20,70 80,70 50,30" /><line x1="50" y1="30" x2="50" y2="60" /><circle cx="50" cy="30" r="2"/><circle cx="20" cy="70" r="2"/><circle cx="80" cy="70" r="2"/><circle cx="50" cy="60" r="2"/>')
    },
    {
        id: 'scorpio', name: '♏ 전갈자리', price: 200, desc: '신비와 통찰력의 상징, 전갈자리입니다.',
        render: () => renderZodiac('<polyline points="80,20 80,50 60,70 40,70 30,60" /><circle cx="80" cy="20" r="2"/><circle cx="80" cy="50" r="2"/><circle cx="60" cy="70" r="2"/><circle cx="40" cy="70" r="2"/><circle cx="30" cy="60" r="2"/>')
    },
    {
        id: 'sagittarius', name: '♐ 궁수자리', price: 200, desc: '자유와 탐험의 상징, 궁수자리입니다.',
        render: () => renderZodiac('<polyline points="30,70 70,30" /><polyline points="70,30 50,30" /><polyline points="70,30 70,50" /><line x1="40" y1="60" x2="60" y2="80" /><circle cx="30" cy="70" r="2"/><circle cx="70" cy="30" r="2"/><circle cx="50" cy="30" r="2"/><circle cx="70" cy="50" r="2"/>')
    },
    {
        id: 'capricorn', name: '♑ 염소자리', price: 200, desc: '인내와 야망의 상징, 염소자리입니다.',
        render: () => renderZodiac('<polyline points="20,30 80,30 50,80 20,30" /><circle cx="20" cy="30" r="2"/><circle cx="80" cy="30" r="2"/><circle cx="50" cy="80" r="2"/>')
    },
    {
        id: 'aquarius', name: '♒ 물병자리', price: 200, desc: '독창성과 우정의 상징, 물병자리입니다.',
        render: () => renderZodiac('<polyline points="20,30 30,40 40,30 50,40 60,30 70,40 80,30" /><polyline points="20,60 30,70 40,60 50,70 60,60 70,70 80,60" /><circle cx="20" cy="30" r="2"/><circle cx="80" cy="30" r="2"/><circle cx="20" cy="60" r="2"/><circle cx="80" cy="60" r="2"/>')
    },
    {
        id: 'pisces', name: '♓ 물고기자리', price: 200, desc: '예술과 낭만의 상징, 물고기자리입니다.',
        render: () => renderZodiac('<polyline points="30,30 50,50 30,70" /><polyline points="70,30 50,50 70,70" /><circle cx="30" cy="30" r="2"/><circle cx="30" cy="70" r="2"/><circle cx="70" cy="30" r="2"/><circle cx="70" cy="70" r="2"/><circle cx="50" cy="50" r="2"/>')
    },
    {
        id: 'cat_window',
        name: '🐈 창가에 앉은 고양이',
        price: 300,
        desc: '창밖을 바라보는 고양이의 뒷모습.',
        render: () => {
            createStars();
            const container = document.getElementById('theme-renderer');
            container.innerHTML = `
                <div class="theme-obj window-frame">
                    <svg class="cat-svg" viewBox="0 0 100 100">
                        <!-- 고양이 몸통 (뒷모습) -->
                        <path d="M35 85 Q 30 85 30 65 Q 30 45 45 40 Q 40 25 50 25 Q 60 25 55 40 Q 70 45 70 65 Q 70 85 65 85 Z" fill="#1a1a1a" />
                        <!-- 귀 -->
                        <path d="M42 40 L 40 25 L 50 33 Z" fill="#1a1a1a" />
                        <path d="M58 40 L 60 25 L 50 33 Z" fill="#1a1a1a" />
                        <!-- 꼬리 (애니메이션) -->
                        <path d="M65 80 Q 85 80 85 60" fill="none" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round" class="cat-tail-anim" />
                    </svg>
                </div>
            `;
        }
    }
];

// Helper for Zodiacs
function renderZodiac(svgContent) {
    createStars();
    const container = document.getElementById('theme-renderer');
    container.innerHTML = `
        <div class="theme-obj zodiac-container">
            <svg viewBox="0 0 100 100" class="zodiac-svg">
                ${svgContent}
            </svg>
        </div>
    `;
}

// --- Shop UI Logic ---
let shopModal = null;

function initShop() {
    injectShopStyles();
    
    // 상점 모달 생성
    shopModal = document.createElement('div');
    shopModal.id = 'modal-shop';
    shopModal.className = 'modal hidden';
    shopModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <span class="close-modal" onclick="closeShop()">&times;</span>
            <h2>🛍️ 테마 상점</h2>
            <div class="shop-balance">보유 코인: <span id="shop-coin-display">0</span></div>
            <div id="shop-list" class="shop-list"></div>
        </div>
    `;
    document.body.appendChild(shopModal);
}

window.openShop = function() {
    if (!shopModal) initShop();
    updateShopUI();
    shopModal.classList.remove('hidden');
};

window.closeShop = function() {
    if (shopModal) shopModal.classList.add('hidden');
};

function updateShopUI() {
    document.getElementById('shop-coin-display').innerText = data.coins;
    const list = document.getElementById('shop-list');
    list.innerHTML = '';

    // 기본 테마
    renderShopItem(list, { id: 'default', name: '🌌 기본 밤하늘', price: 0, desc: '심플한 밤하늘입니다.' });

    // 판매 테마
    SHOP_ITEMS.forEach(item => {
        renderShopItem(list, item);
    });
}

function renderShopItem(container, item) {
    const isOwned = data.inventory.includes(item.id);
    const isEquipped = data.currentTheme === item.id;
    
    const div = document.createElement('div');
    div.className = 'shop-item';
    if (isEquipped) div.classList.add('equipped');

    let btnHTML = '';
    if (isEquipped) {
        btnHTML = `<button class="btn-shop equipped" disabled>장착 중</button>`;
    } else if (isOwned) {
        btnHTML = `<button class="btn-shop own" onclick="equipItem('${item.id}')">장착하기</button>`;
    } else {
        btnHTML = `<button class="btn-shop buy" onclick="buyItem('${item.id}', ${item.price})">${item.price} 코인</button>`;
    }

    div.innerHTML = `
        <div class="shop-item-info">
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc}</div>
        </div>
        <div class="shop-item-action">
            ${btnHTML}
        </div>
    `;
    container.appendChild(div);
}

window.buyItem = function(id, price) {
    if (data.coins >= price) {
        if (confirm('구매하시겠습니까?')) {
            data.coins -= price;
            data.inventory.push(id);
            saveData(); // script.js 함수
            renderHeader(); // script.js 함수
            updateShopUI();
            alert('구매 완료! 🎉');
        }
    } else {
        alert('코인이 부족해요! 🥲');
    }
};

window.equipItem = function(id) {
    data.currentTheme = id;
    saveData();
    updateShopUI();
    alert('테마가 변경되었습니다.');
};

// --- Theme Rendering Logic ---
window.applyCurrentTheme = function() {
    const themeId = data.currentTheme;
    const theme = SHOP_ITEMS.find(t => t.id === themeId);
    
    // 렌더러 초기화
    const renderer = document.getElementById('theme-renderer');
    if (renderer) renderer.innerHTML = '';

    if (theme) {
        theme.render();
    } else {
        createStars(); // 기본
    }
};

window.removeCurrentTheme = function() {
    const renderer = document.getElementById('theme-renderer');
    if (renderer) renderer.innerHTML = '';
    
    // 별 컨테이너도 초기화 (createStars가 만들었을 수 있음)
    const starContainer = document.getElementById('star-container');
    if (starContainer) starContainer.innerHTML = '';
};

// --- CSS Injection ---
function injectShopStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Shop UI */
        .shop-balance { font-size: 18px; font-weight: bold; color: #3182f6; margin-bottom: 15px; text-align: right; }
        .shop-list { max-height: 400px; overflow-y: auto; }
        .shop-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee; }
        .shop-item.equipped { background: #f0f7ff; border-radius: 8px; }
        .shop-item-name { font-weight: bold; font-size: 16px; margin-bottom: 4px; }
        .shop-item-desc { font-size: 12px; color: #8b95a1; }
        .btn-shop { padding: 8px 16px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; font-size: 14px; }
        .btn-shop.buy { background: #3182f6; color: white; }
        .btn-shop.own { background: #e5e8eb; color: #333; }
        .btn-shop.equipped { background: transparent; color: #3182f6; cursor: default; }

        /* Theme Objects Container */
        #theme-renderer { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
        .theme-obj { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); }

        /* Zodiac Styles */
        .zodiac-container { width: 200px; height: 200px; bottom: 100px; opacity: 0.8; }
        .zodiac-svg { width: 100%; height: 100%; overflow: visible; }
        .zodiac-svg polyline, .zodiac-svg line { fill: none; stroke: rgba(255,255,255,0.5); stroke-width: 1; }
        .zodiac-svg circle { fill: white; filter: drop-shadow(0 0 2px white); }

        /* 1. Shooting Star */
        .shooting-star {
            position: absolute; width: 100px; height: 2px;
            background: linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0));
            transform: rotate(-45deg); opacity: 0;
            animation: shoot 3s infinite ease-in-out;
        }
        @keyframes shoot { 0% { opacity: 1; transform: translate(0, 0) rotate(-45deg); } 20% { opacity: 0; transform: translate(-200px, 200px) rotate(-45deg); } 100% { opacity: 0; } }

        /* 2. Cat on Window (SVG) */
        .window-frame { width: 100%; height: 100%; }
        .window-frame::after {
            content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 120px;
            background: #2d3436; z-index: 1;
        }
        .cat-svg {
            position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%);
            width: 100px; height: 100px; z-index: 2;
        }
        .cat-tail-anim {
            transform-origin: 65px 80px;
            animation: tail-wag 3s infinite ease-in-out;
        }
        @keyframes tail-wag { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(15deg); } }
    `;
    document.head.appendChild(style);
}