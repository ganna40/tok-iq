/* ============================================
   톡IQ — app.js
   웩슬러(WAIS) 5대 인지지표 UI
   펜타곤 차트, 카드 시스템, 공유, 정밀분석
   ============================================ */

// ===== 상수 =====
const WECHSLER_META = {
  vci: { name: '언어이해', abbr: 'VCI', icon: '📝', color: '#a855f7', desc: '언어적 개념 형성, 어휘 지식, 언어 추론' },
  fri: { name: '유동추론', abbr: 'FRI', icon: '🧩', color: '#3b82f6', desc: '패턴 인식, 추상적 추론, 귀납·연역적 사고' },
  wmi: { name: '작업기억', abbr: 'WMI', icon: '🧠', color: '#f43f5e', desc: '정보 유지·조작, 맥락 기억, 정신적 조작' },
  psi: { name: '처리속도', abbr: 'PSI', icon: '⚡', color: '#22c55e', desc: '정보 처리 속도, 출력 효율, 반응 민첩성' },
  vsi: { name: '시공간',   abbr: 'VSI', icon: '🗺️', color: '#06b6d4', desc: '공간 분석, 시각 정보 처리, 심상 조작' },
};
const W_KEYS = Object.keys(WECHSLER_META);
const SITE_URL = location.href.split('?')[0];

let worker = null;
let globalStats = null;
let selectedMember = null;
let currentCard = 0;
let totalCards = 0;
let audioCtx = null;

// ===== 화면 전환 =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  if (id === 'wrapped') {
    document.getElementById('dots').style.display = 'flex';
  } else {
    document.getElementById('dots').style.display = 'none';
  }
}

// ===== 파일 업로드 =====
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file) {
  if (!file.name.endsWith('.txt')) {
    showToast('.txt 파일만 업로드 가능합니다');
    return;
  }
  showScreen('loading');
  haptic(30);
  startParsing(file);
}

// ===== Worker 통신 =====
function startParsing(file) {
  worker = new Worker('worker.js?v=2');
  worker.postMessage({ file });
  worker.onmessage = function(e) {
    const d = e.data;
    if (d.type === 'progress') {
      document.getElementById('progressFill').style.width = d.percent + '%';
      document.getElementById('loadingPercent').textContent = d.percent + '%';
      document.getElementById('loadingMsg').textContent = d.message;
    } else if (d.type === 'complete') {
      globalStats = d.stats;
      haptic(50);
      playSound('complete');
      if (globalStats.isGroup && globalStats.perMemberStats.length > 2) {
        showParticipantPicker();
      } else {
        selectedMember = globalStats.perMemberStats[0];
        buildAndShowCards();
      }
    } else if (d.type === 'error') {
      showToast(d.message);
      showScreen('upload');
    }
  };
}

// ===== 참가자 선택 (그룹) =====
function showParticipantPicker() {
  const list = document.getElementById('pickerList');
  list.innerHTML = '';
  globalStats.perMemberStats.forEach((ms, i) => {
    const btn = document.createElement('button');
    btn.className = 'picker-item' + (i === 0 ? ' selected' : '');
    btn.textContent = `${ms.name} (${ms.count.toLocaleString()}건)`;
    btn.onclick = () => {
      list.querySelectorAll('.picker-item').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMember = ms;
    };
    list.appendChild(btn);
  });
  selectedMember = globalStats.perMemberStats[0];
  document.getElementById('pickerOverlay').classList.add('active');
}

function confirmPicker() {
  document.getElementById('pickerOverlay').classList.remove('active');
  buildAndShowCards();
}

// ===== 웩슬러 분류 =====
function indexInterpretation(score) {
  if (score >= 130) return '최우수 (Very Superior)';
  if (score >= 120) return '우수 (Superior)';
  if (score >= 110) return '평균 상 (High Average)';
  if (score >= 90) return '평균 (Average)';
  if (score >= 80) return '평균 하 (Low Average)';
  return '경계 (Borderline)';
}

// ===== 카드 빌드 =====
function buildAndShowCards() {
  const ms = selectedMember;
  const s = ms.intelligence;
  const viewport = document.getElementById('cardsViewport');
  viewport.innerHTML = '';

  const cards = [];

  // Card 1: 분석 요약
  cards.push(buildCard(1, `
    <div class="card-label">ANALYSIS SUMMARY</div>
    <div class="card-icon">📊</div>
    <div class="card-title">분석 요약</div>
    <div class="card-score" data-count="${globalStats.totalMessages}">${globalStats.totalMessages.toLocaleString()}</div>
    <div class="card-desc">메시지</div>
    <div class="bar-group">
      <div class="bar-item"><span class="bar-label">분석 기간</span><span class="bar-val" style="width:auto">${globalStats.totalDays}일</span></div>
      <div class="bar-item"><span class="bar-label">분석 단어</span><span class="bar-val" style="width:auto">${globalStats.totalWordCount.toLocaleString()}개</span></div>
      <div class="bar-item"><span class="bar-label">참가자</span><span class="bar-val" style="width:auto">${globalStats.participants.length}명</span></div>
      <div class="bar-item"><span class="bar-label">일평균</span><span class="bar-val" style="width:auto">${Math.round(globalStats.totalMessages / globalStats.totalDays)}건</span></div>
    </div>
  `));

  // Card 2~6: 5대 인지지표
  W_KEYS.forEach((key, i) => {
    cards.push(buildIntelCard(i + 2, key, ms));
  });

  // Card 7: 펜타곤 레이더
  cards.push(buildCard(7, `
    <div class="card-label">COGNITIVE PROFILE</div>
    <div class="card-title">5대 인지 프로필</div>
    <div class="radar-wrap">${buildRadarSVG(ms)}</div>
  `));

  // Card 8: IQ 공개
  cards.push(buildCard(8, `
    <div class="card-label">YOUR TOK-IQ</div>
    <div class="card-icon">${ms.tier.emoji}</div>
    <div class="iq-number" data-count="${ms.iq}">${ms.iq}</div>
    <div class="tier-badge" style="background:${ms.tier.color};color:#000">
      ${ms.tier.emoji} ${ms.tier.name}
    </div>
    <div class="card-desc">
      강점: ${ms.strengths.map(k => WECHSLER_META[k].icon + ' ' + WECHSLER_META[k].name).join(', ')}<br>
      약점: ${ms.weaknesses.map(k => WECHSLER_META[k].icon + ' ' + WECHSLER_META[k].name).join(', ')}
    </div>
  `));

  // Card 9: 랭킹/비교
  if (globalStats.perMemberStats.length > 1) {
    const sorted = [...globalStats.perMemberStats].sort((a, b) => b.iq - a.iq);
    cards.push(buildCard(9, `
      <div class="card-label">IQ RANKING</div>
      <div class="card-title">${globalStats.isGroup ? '멤버 IQ 랭킹' : '나 vs 상대'}</div>
      <div class="ranking-list">
        ${sorted.map((m, i) => `
          <div class="rank-item" style="${m.name === ms.name ? 'background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3)' : ''}">
            <div class="rank-num" style="color:${i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--t3)'}">${i + 1}</div>
            <div class="rank-name">${m.name}</div>
            <div class="rank-iq" style="color:${m.tier.color}">${m.iq}</div>
            <div class="rank-tier">${m.tier.emoji}</div>
          </div>
        `).join('')}
      </div>
    `));
  } else {
    cards.push(buildCard(9, `
      <div class="card-label">INDEX SCORES</div>
      <div class="card-title">인지지표 점수</div>
      <div class="bar-group">
        ${W_KEYS.map(k => {
          const pct = Math.round((s[k] - 55) / 90 * 100);
          return buildBarHTML(WECHSLER_META[k].name, s[k], 145, WECHSLER_META[k].color, pct);
        }).join('')}
      </div>
    `));
  }

  // Card 10: 공유
  cards.push(buildCard(10, `
    <div class="card-label">SHARE</div>
    <div class="card-icon">🔗</div>
    <div class="card-title">결과 공유하기</div>
    <div class="share-btns">
      <button class="btn-share btn-capture" onclick="captureAndShare()">결과 이미지 저장</button>
      <button class="btn-share btn-link" onclick="copyLink()">링크 복사</button>
      <button class="btn-share btn-deep" onclick="showDeepAnalysis()">정밀 분석 보기</button>
      <button class="btn-share btn-retry" onclick="location.reload()">다시 하기</button>
    </div>
  `));

  totalCards = cards.length;
  cards.forEach((html, i) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const card = div.firstElementChild;
    if (i === 0) card.classList.add('active');
    viewport.appendChild(card);
  });

  // Dots
  const dotsEl = document.getElementById('dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < totalCards; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dotsEl.appendChild(dot);
  }

  currentCard = 0;
  showScreen('wrapped');
  setupSwipe();
  animateCurrentCard();

  // Nav hint
  const hint = document.createElement('div');
  hint.className = 'card-nav-hint';
  hint.textContent = '← 스와이프하여 다음 카드';
  document.getElementById('screen-wrapped').appendChild(hint);
}

function buildCard(num, inner) {
  return `<div class="card card-bg-${num}">${inner}</div>`;
}

function buildIntelCard(num, key, ms) {
  const meta = WECHSLER_META[key];
  const indexScore = ms.intelligence[key];
  const interp = indexInterpretation(indexScore);
  const details = getIntelDetails(key, ms);
  return buildCard(num, `
    <div class="card-label">${meta.abbr} · ${meta.name.toUpperCase()}</div>
    <div class="card-icon">${meta.icon}</div>
    <div class="card-title">${meta.name}</div>
    <div class="card-score" style="color:${meta.color}" data-count="${indexScore}">${indexScore}</div>
    <div class="card-interp" style="color:${meta.color}">${interp}</div>
    <div class="bar-group">
      ${details.map(d => buildBarHTML(d.label, d.value, d.max, meta.color)).join('')}
    </div>
    <div class="card-desc">${meta.desc}</div>
  `);
}

function buildBarHTML(label, value, max, color, overridePct) {
  const pct = overridePct != null ? overridePct : Math.min(100, Math.round(value / max * 100));
  return `
    <div class="bar-item">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" data-width="${pct}" style="background:${color}"></div></div>
      <span class="bar-val">${value}</span>
    </div>`;
}

function getIntelDetails(key, ms) {
  switch(key) {
    case 'vci': return [
      { label: '어휘 다양성', value: Math.round(ms.vocabDiversity * 100), max: 100 },
      { label: '고급 어휘', value: Math.min(100, Math.round((ms.formalWordRatio + ms.advancedVocabRatio) * 300)), max: 100 },
      { label: '긴 단어 비율', value: Math.round(ms.longWordRatio * 100), max: 100 },
    ];
    case 'fri': return [
      { label: '인과 추론', value: Math.min(100, Math.round(ms.causalRatio * 300)), max: 100 },
      { label: '조건부 사고', value: Math.min(100, Math.round(ms.conditionalRatio * 300)), max: 100 },
      { label: '문제 해결', value: Math.min(100, Math.round(ms.problemSolveRatio * 300)), max: 100 },
    ];
    case 'wmi': return [
      { label: '맥락 참조', value: Math.min(100, Math.round(ms.contextRefRatio * 300)), max: 100 },
      { label: '다중절 문장', value: Math.min(100, Math.round(ms.multiClauseRatio * 200)), max: 100 },
      { label: '문장 복잡도', value: Math.round(ms.complexityPerMsg * 100), max: 100 },
    ];
    case 'psi': return [
      { label: '응답 속도', value: Math.max(0, Math.round(100 - ms.avgResponse * 2)), max: 100 },
      { label: '일평균 메시지', value: Math.min(100, ms.dailyAvg), max: 100 },
      { label: '표현 효율', value: Math.min(100, Math.round(ms.avgLength / 2)), max: 100 },
    ];
    case 'vsi': return [
      { label: '미디어 공유', value: Math.min(100, Math.round(ms.mediaRatio * 200)), max: 100 },
      { label: '공간 묘사', value: Math.min(100, Math.round(ms.spatialRatio * 300)), max: 100 },
      { label: '이모지 활용', value: Math.min(100, Math.round(ms.emojiRatio * 100)), max: 100 },
    ];
    default: return [];
  }
}

// ===== SVG 펜타곤 레이더 차트 =====
function buildRadarSVG(ms, size = 280) {
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const n = 5;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  // Grid lines
  let gridLines = '';
  [0.25, 0.5, 0.75, 1.0].forEach(scale => {
    let pts = '';
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * angleStep;
      pts += `${cx + r * scale * Math.cos(a)},${cy + r * scale * Math.sin(a)} `;
    }
    gridLines += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1"/>`;
  });

  // Axis lines
  let axisLines = '';
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * angleStep;
    axisLines += `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>`;
  }

  // Data polygon (use rawScores 0~100 for shape)
  const rawScores = ms.rawScores || {};
  const vals = W_KEYS.map(k => (rawScores[k] || 50) / 100);
  let dataPts = '';
  vals.forEach((v, i) => {
    const a = startAngle + i * angleStep;
    dataPts += `${cx + r * v * Math.cos(a)},${cy + r * v * Math.sin(a)} `;
  });

  // Labels with Wechsler index scores
  let labels = '';
  W_KEYS.forEach((k, i) => {
    const a = startAngle + i * angleStep;
    const lx = cx + (r + 30) * Math.cos(a);
    const ly = cy + (r + 30) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    const indexScore = ms.intelligence[k] || 100;
    labels += `<text x="${lx}" y="${ly - 8}" text-anchor="${anchor}" dominant-baseline="central" fill="${WECHSLER_META[k].color}" font-size="12" font-weight="700">${WECHSLER_META[k].icon} ${WECHSLER_META[k].name}</text>`;
    labels += `<text x="${lx}" y="${ly + 8}" text-anchor="${anchor}" dominant-baseline="central" fill="#94a3b8" font-size="11" font-weight="600">${indexScore}</text>`;
  });

  // Dots
  let dots = '';
  vals.forEach((v, i) => {
    const a = startAngle + i * angleStep;
    const dx = cx + r * v * Math.cos(a);
    const dy = cy + r * v * Math.sin(a);
    dots += `<circle cx="${dx}" cy="${dy}" r="5" fill="${WECHSLER_META[W_KEYS[i]].color}" stroke="#fff" stroke-width="1.5"/>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${gridLines}${axisLines}
    <polygon points="${dataPts}" fill="rgba(0,212,255,.12)" stroke="var(--cyan)" stroke-width="2" stroke-linejoin="round" class="radar-data"/>
    ${dots}${labels}
  </svg>`;
}

// ===== 카드 스와이프 =====
function setupSwipe() {
  const vp = document.getElementById('cardsViewport');
  let startX = 0, startY = 0, isDragging = false;

  vp.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; isDragging = true; }, { passive: true });
  vp.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && currentCard < totalCards - 1) goToCard(currentCard + 1);
      else if (dx > 0 && currentCard > 0) goToCard(currentCard - 1);
    }
  }, { passive: true });

  // Click navigation (desktop)
  vp.addEventListener('click', e => {
    const w = vp.offsetWidth;
    if (e.clientX > w * 0.65 && currentCard < totalCards - 1) goToCard(currentCard + 1);
    else if (e.clientX < w * 0.35 && currentCard > 0) goToCard(currentCard - 1);
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (!document.getElementById('screen-wrapped').classList.contains('active')) return;
    if (e.key === 'ArrowRight' && currentCard < totalCards - 1) goToCard(currentCard + 1);
    if (e.key === 'ArrowLeft' && currentCard > 0) goToCard(currentCard - 1);
  });
}

function goToCard(idx) {
  const cards = document.querySelectorAll('#cardsViewport .card');
  const dots = document.querySelectorAll('#dots .dot');
  cards[currentCard].classList.remove('active');
  cards[currentCard].classList.add(idx > currentCard ? 'prev' : '');
  setTimeout(() => cards[currentCard].classList.remove('prev'), 400);
  currentCard = idx;
  cards[currentCard].classList.add('active');
  dots.forEach((d, i) => d.classList.toggle('active', i === currentCard));
  haptic(15);
  playSound('swipe');
  animateCurrentCard();

  // IQ card confetti (card index 7 = 8th card)
  if (currentCard === 7) {
    setTimeout(spawnConfetti, 300);
  }
}

function animateCurrentCard() {
  const card = document.querySelectorAll('#cardsViewport .card')[currentCard];
  if (!card) return;

  // Count-up animation
  card.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    animateNumber(el, target, 1200);
  });

  // Bar fill animation
  setTimeout(() => {
    card.querySelectorAll('.bar-fill[data-width]').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  }, 200);
}

function animateNumber(el, target, duration) {
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ===== Confetti =====
function spawnConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti';
  document.body.appendChild(container);
  const colors = ['#fbbf24','#00d4ff','#a855f7','#f43f5e','#22c55e','#3b82f6'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 1 + 's';
    piece.style.animationDuration = 2 + Math.random() * 2 + 's';
    piece.style.width = 6 + Math.random() * 8 + 'px';
    piece.style.height = 6 + Math.random() * 8 + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 4000);
}

// ===== 효과음 (Web Audio API) =====
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0.08;

    if (type === 'swipe') {
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.start(); osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'complete') {
      osc.frequency.value = 523;
      osc.type = 'sine';
      gain.gain.value = 0.12;
      setTimeout(() => {
        const o2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        o2.connect(g2); g2.connect(audioCtx.destination);
        o2.frequency.value = 659; o2.type = 'sine'; g2.gain.value = 0.12;
        g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        o2.start(); o2.stop(audioCtx.currentTime + 0.3);
      }, 150);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
  } catch(e) {}
}

// ===== 햅틱 =====
function haptic(ms) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch(e) {}
}

// ===== 결과 캡처 =====
function captureAndShare() {
  const ms = selectedMember;
  const target = document.getElementById('capture-target');
  target.innerHTML = `
    <div class="capture-title" style="font-size:22px;font-weight:800;color:#f1f5f9">🧠 톡IQ 분석 결과</div>
    <div style="font-size:16px;color:#94a3b8;font-weight:600">${ms.name}</div>
    <div class="capture-iq" style="font-size:64px;font-weight:900;color:#fbbf24">${ms.iq}</div>
    <div class="capture-tier" style="font-size:18px;font-weight:700;color:${ms.tier.color}">${ms.tier.emoji} ${ms.tier.name}</div>
    <div class="capture-radar" style="width:280px;height:280px">${buildRadarSVG(ms)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px">
      ${W_KEYS.map(k => `<span style="font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.06);color:#94a3b8">${WECHSLER_META[k].icon} ${WECHSLER_META[k].name} ${ms.intelligence[k]}</span>`).join('')}
    </div>
    <div class="capture-footer" style="font-size:12px;color:#64748b;margin-top:12px">톡IQ - 웩슬러 기반 카카오톡 지능 분석기</div>
  `;
  target.style.left = '0';

  html2canvas(target, {
    backgroundColor: '#0a0e1a',
    scale: 2,
    useCORS: true,
    logging: false,
  }).then(canvas => {
    target.style.left = '-9999px';
    canvas.toBlob(blob => {
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'tok-iq.png', { type: 'image/png' })] })) {
        navigator.share({
          files: [new File([blob], 'tok-iq.png', { type: 'image/png' })],
          title: '톡IQ 결과',
          text: `나의 톡IQ는 ${ms.iq}! (${ms.tier.name})`,
        }).catch(() => downloadBlob(blob));
      } else {
        downloadBlob(blob);
      }
    });
  }).catch(() => {
    target.style.left = '-9999px';
    showToast('캡처에 실패했습니다');
  });
}

function downloadBlob(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tok-iq-result.png';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('이미지가 저장되었습니다');
}

// ===== 링크 복사 =====
function copyLink() {
  navigator.clipboard.writeText(SITE_URL).then(() => {
    showToast('링크가 복사되었습니다');
  }).catch(() => {
    showToast('복사 실패');
  });
}

// ===== 정밀 분석 =====
function showDeepAnalysis() {
  showScreen('deep');
  const tabs = document.getElementById('memberTabs');
  tabs.innerHTML = '';
  globalStats.perMemberStats.forEach((ms, i) => {
    const btn = document.createElement('button');
    btn.className = 'member-tab' + (ms.name === selectedMember.name ? ' active' : '');
    btn.textContent = ms.name;
    btn.onclick = () => {
      tabs.querySelectorAll('.member-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDeepMember(ms);
    };
    tabs.appendChild(btn);
  });
  renderDeepMember(selectedMember);
}

function renderDeepMember(ms) {
  const s = ms.intelligence;
  const content = document.getElementById('deepContent');

  content.innerHTML = `
    <!-- IQ + Tier -->
    <div class="deep-card">
      <div class="deep-iq-display">
        <div class="deep-iq-num">${ms.iq}</div>
        <div class="deep-tier" style="color:${ms.tier.color}">${ms.tier.emoji} ${ms.tier.name}</div>
      </div>
    </div>

    <!-- Radar -->
    <div class="deep-card">
      <h3>🧠 인지 프로필</h3>
      <div class="deep-radar">${buildRadarSVG(ms, 300)}</div>
    </div>

    <!-- Index Scores -->
    <div class="deep-card">
      <h3>📊 지표별 점수</h3>
      <div class="scores-grid">
        ${W_KEYS.map(k => {
          const val = s[k];
          const pct = Math.round((val - 55) / 90 * 100);
          const interp = indexInterpretation(val);
          return `
            <div class="score-row">
              <div class="score-icon">${WECHSLER_META[k].icon}</div>
              <div class="score-name">${WECHSLER_META[k].name}</div>
              <div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${WECHSLER_META[k].color}"></div></div>
              <div class="score-val" style="color:${WECHSLER_META[k].color}">${val}</div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Evidence -->
    <div class="deep-card">
      <h3>🔍 분석 근거</h3>
      ${buildEvidence(ms)}
    </div>

    <!-- Key Stats -->
    <div class="deep-card">
      <h3>📋 핵심 지표</h3>
      <div class="scores-grid">
        ${buildStatRow('메시지 수', ms.count.toLocaleString() + '건')}
        ${buildStatRow('평균 길이', ms.avgLength + '자')}
        ${buildStatRow('어휘 다양성', Math.round(ms.vocabDiversity * 100) + '%')}
        ${buildStatRow('질문 비율', Math.round(ms.questionRatio * 100) + '%')}
        ${buildStatRow('이모지 비율', Math.round(ms.emojiRatio * 100) + '%')}
        ${buildStatRow('링크 공유', Math.round(ms.linkRatio * 100) + '%')}
        ${buildStatRow('사진/동영상', (ms.photoCount + ms.videoCount) + '건')}
        ${buildStatRow('평균 응답', ms.avgResponse > 0 ? Math.round(ms.avgResponse) + '분' : '-')}
      </div>
    </div>
  `;
}

function buildStatRow(label, value) {
  return `
    <div class="score-row">
      <div class="score-name" style="width:auto;flex:1">${label}</div>
      <div class="score-val" style="width:auto;color:var(--t1)">${value}</div>
    </div>`;
}

function buildEvidence(ms) {
  const s = ms.intelligence;
  const sorted = W_KEYS.map(k => ({ key: k, val: s[k] })).sort((a, b) => b.val - a.val);
  const top = sorted[0];
  const bot = sorted[sorted.length - 1];

  let html = '<div class="deep-evidence">';
  html += `<p><b>최강 영역: ${WECHSLER_META[top.key].icon} ${WECHSLER_META[top.key].name} (${top.val})</b><br>`;
  html += getEvidenceText(top.key, ms);
  html += `</p><br>`;
  html += `<p><b>성장 영역: ${WECHSLER_META[bot.key].icon} ${WECHSLER_META[bot.key].name} (${bot.val})</b><br>`;
  html += getEvidenceText(bot.key, ms);
  html += `</p>`;

  // 자주 쓰는 단어
  if (ms.topWords && ms.topWords.length > 0) {
    html += `<br><p><b>자주 쓰는 단어:</b> ${ms.topWords.join(', ')}</p>`;
  }
  if (ms.topEmoji && ms.topEmoji.length > 0) {
    html += `<p><b>자주 쓰는 이모지:</b> ${ms.topEmoji.join(' ')}</p>`;
  }

  html += '</div>';
  return html;
}

function getEvidenceText(key, ms) {
  switch(key) {
    case 'vci':
      return `어휘 다양성 ${Math.round(ms.vocabDiversity * 100)}%, 고급어 비율 ${Math.round((ms.formalWordRatio + ms.advancedVocabRatio) * 100)}%, 긴 단어 ${Math.round(ms.longWordRatio * 100)}%. 언어적 개념 형성과 단어 지식이 반영됩니다.`;
    case 'fri':
      return `인과 추론 ${Math.round(ms.causalRatio * 100)}%, 조건부 사고 ${Math.round(ms.conditionalRatio * 100)}%, 문제해결 ${Math.round(ms.problemSolveRatio * 100)}%. 패턴 인식과 추상적 추론 능력을 보여줍니다.`;
    case 'wmi':
      return `맥락 참조(아까/그때) ${Math.round(ms.contextRefRatio * 100)}%, 다중절 문장 ${Math.round(ms.multiClauseRatio * 100)}%. 이전 정보를 유지하며 복잡한 정보를 조작하는 능력입니다.`;
    case 'psi':
      return `평균 응답 ${ms.avgResponse > 0 ? Math.round(ms.avgResponse) + '분' : '-'}, 일평균 ${ms.dailyAvg}건. 정보를 빠르게 처리하고 효율적으로 출력하는 속도입니다.`;
    case 'vsi':
      return `사진/동영상 ${ms.photoCount + ms.videoCount}건, 공간어 ${Math.round(ms.spatialRatio * 100)}%, 이모지 ${Math.round(ms.emojiRatio * 100)}%. 공간 정보를 처리하고 시각적으로 사고하는 능력입니다.`;
    default: return '';
  }
}

// ===== Toast =====
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}
