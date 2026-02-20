/* ============================================
   톡IQ — app.js
   UI 로직, 10장 카드, SVG 차트, 공유, 정밀분석
   ============================================ */

// ===== 상수 =====
const INTEL_META = {
  linguistic:     { name: '언어',     icon: '📝', color: '#a855f7', desc: '어휘력, 문장 복잡도, 접속사 활용, 시제 다양성' },
  logical:        { name: '논리-수학', icon: '🔢', color: '#3b82f6', desc: '분석적 사고, 인과관계 표현, 숫자/데이터 활용' },
  interpersonal:  { name: '대인관계', icon: '🤝', color: '#f43f5e', desc: '공감 반응, 관심 질문, 감정 표현, 대화 주도' },
  intrapersonal:  { name: '자기이해', icon: '🪞', color: '#22c55e', desc: '감정 세밀도, 자기 성찰, 야간 감정 밀도' },
  musical:        { name: '음악-리듬', icon: '🎵', color: '#f59e0b', desc: '의성어, ㅋ 패턴, 물결 표현, 텍스트 리듬감' },
  spatial:        { name: '공간-시각', icon: '🗺️', color: '#06b6d4', desc: '사진/동영상 공유, 공간 묘사, 장소 언급' },
  naturalistic:   { name: '자연탐구', icon: '🌿', color: '#84cc16', desc: '자연/날씨 관심, 음식/건강, 관찰력, 분류' },
  existential:    { name: '실존',     icon: '💫', color: '#8b5cf6', desc: '추상적 사고, 미래 지향, 가치관, 철학적 표현' },
};
const INTEL_KEYS = Object.keys(INTEL_META);
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
  worker = new Worker('worker.js');
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

  // Card 2: 언어 지능
  cards.push(buildIntelCard(2, 'linguistic', ms));

  // Card 3: 논리-수학
  cards.push(buildIntelCard(3, 'logical', ms));

  // Card 4: 대인관계
  cards.push(buildIntelCard(4, 'interpersonal', ms));

  // Card 5: 자기이해
  cards.push(buildIntelCard(5, 'intrapersonal', ms));

  // Card 6: 4개 지능 한번에
  cards.push(buildCard(6, `
    <div class="card-label">MULTI-INTELLIGENCE</div>
    <div class="card-title">나머지 4개 지능</div>
    <div class="mini-grid">
      ${['musical','spatial','naturalistic','existential'].map(key => `
        <div class="mini-card">
          <div class="mini-icon">${INTEL_META[key].icon}</div>
          <div class="mini-name">${INTEL_META[key].name}</div>
          <div class="mini-score" style="color:${INTEL_META[key].color}" data-count="${Math.round(s[key])}">${Math.round(s[key])}</div>
        </div>
      `).join('')}
    </div>
  `));

  // Card 7: 레이더 차트
  cards.push(buildCard(7, `
    <div class="card-label">INTELLIGENCE PROFILE</div>
    <div class="card-title">8축 다중지능 프로필</div>
    <div class="radar-wrap">${buildRadar8SVG(s)}</div>
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
      강점: ${ms.strengths.map(k => INTEL_META[k].icon + ' ' + INTEL_META[k].name).join(', ')}<br>
      약점: ${ms.weaknesses.map(k => INTEL_META[k].icon + ' ' + INTEL_META[k].name).join(', ')}
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
      <div class="card-label">YOUR STATS</div>
      <div class="card-title">핵심 지표</div>
      <div class="bar-group">
        ${buildBarHTML('어휘 다양성', Math.round(ms.vocabDiversity * 100), 100, '#a855f7')}
        ${buildBarHTML('감정 세밀도', Math.round(ms.emotionGranularity * 100), 100, '#f43f5e')}
        ${buildBarHTML('논리적 사고', Math.round(ms.tWordRatio * 500), 100, '#3b82f6')}
        ${buildBarHTML('공감 반응', Math.round(ms.fWordRatio * 500), 100, '#22c55e')}
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
  const meta = INTEL_META[key];
  const score = Math.round(ms.intelligence[key]);
  const details = getIntelDetails(key, ms);
  return buildCard(num, `
    <div class="card-label">${meta.name.toUpperCase()} INTELLIGENCE</div>
    <div class="card-icon">${meta.icon}</div>
    <div class="card-title">${meta.name} 지능</div>
    <div class="card-score" style="color:${meta.color}" data-count="${score}">${score}</div>
    <div class="bar-group">
      ${details.map(d => buildBarHTML(d.label, d.value, d.max, meta.color)).join('')}
    </div>
    <div class="card-desc">${meta.desc}</div>
  `);
}

function buildBarHTML(label, value, max, color) {
  const pct = Math.min(100, Math.round(value / max * 100));
  return `
    <div class="bar-item">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" data-width="${pct}" style="background:${color}"></div></div>
      <span class="bar-val">${value}</span>
    </div>`;
}

function getIntelDetails(key, ms) {
  switch(key) {
    case 'linguistic': return [
      { label: '어휘 다양성', value: Math.round(ms.vocabDiversity * 100), max: 100 },
      { label: '문장 복잡도', value: Math.round(ms.complexityPerMsg * 100), max: 100 },
      { label: '접속사 활용', value: Math.round(ms.connectiveRatio * 200), max: 100 },
    ];
    case 'logical': return [
      { label: '분석형 질문', value: Math.round(ms.analyticalQuestionRatio * 100), max: 100 },
      { label: '인과 표현', value: Math.round(ms.causalRatio * 200), max: 100 },
      { label: '숫자/데이터', value: Math.round(ms.numberRatio * 100), max: 100 },
    ];
    case 'interpersonal': return [
      { label: '공감 반응', value: Math.round((ms.empathyResponseScore + 1) * 50), max: 100 },
      { label: '관심 질문', value: Math.round(ms.interestQuestionRatio * 100), max: 100 },
      { label: '대화 주도', value: Math.round(ms.firstMessageRatio * 100), max: 100 },
    ];
    case 'intrapersonal': return [
      { label: '감정 세밀도', value: Math.round(ms.emotionGranularity * 100), max: 100 },
      { label: '자기 성찰', value: Math.round(ms.selfReflectRatio * 200), max: 100 },
      { label: '야간 감정', value: Math.round(ms.nightEmotionality * 50), max: 100 },
    ];
    default: return [];
  }
}

// ===== SVG 레이더 차트 =====
function buildRadar8SVG(scores, size = 280) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = 8;
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

  // Data polygon
  const vals = INTEL_KEYS.map(k => (scores[k] || 0) / 100);
  let dataPts = '';
  vals.forEach((v, i) => {
    const a = startAngle + i * angleStep;
    dataPts += `${cx + r * v * Math.cos(a)},${cy + r * v * Math.sin(a)} `;
  });

  // Labels
  let labels = '';
  INTEL_KEYS.forEach((k, i) => {
    const a = startAngle + i * angleStep;
    const lx = cx + (r + 24) * Math.cos(a);
    const ly = cy + (r + 24) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    labels += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="central" fill="#94a3b8" font-size="11" font-weight="600">${INTEL_META[k].icon} ${INTEL_META[k].name}</text>`;
  });

  // Dots
  let dots = '';
  vals.forEach((v, i) => {
    const a = startAngle + i * angleStep;
    const dx = cx + r * v * Math.cos(a);
    const dy = cy + r * v * Math.sin(a);
    dots += `<circle cx="${dx}" cy="${dy}" r="4" fill="${INTEL_META[INTEL_KEYS[i]].color}" stroke="#fff" stroke-width="1.5"/>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${gridLines}${axisLines}
    <polygon points="${dataPts}" fill="rgba(0,212,255,.15)" stroke="var(--cyan)" stroke-width="2" stroke-linejoin="round" class="radar-data"/>
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

  // IQ card confetti
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
    <div class="capture-radar" style="width:280px;height:280px">${buildRadar8SVG(ms.intelligence)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px">
      ${INTEL_KEYS.map(k => `<span style="font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.06);color:#94a3b8">${INTEL_META[k].icon} ${INTEL_META[k].name} ${Math.round(ms.intelligence[k])}</span>`).join('')}
    </div>
    <div class="capture-footer" style="font-size:12px;color:#64748b;margin-top:12px">톡IQ - 카카오톡 다중지능 분석기</div>
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
      <h3>🧠 다중지능 프로필</h3>
      <div class="deep-radar">${buildRadar8SVG(s, 300)}</div>
    </div>

    <!-- Scores -->
    <div class="deep-card">
      <h3>📊 영역별 점수</h3>
      <div class="scores-grid">
        ${INTEL_KEYS.map(k => {
          const val = Math.round(s[k]);
          return `
            <div class="score-row">
              <div class="score-icon">${INTEL_META[k].icon}</div>
              <div class="score-name">${INTEL_META[k].name}</div>
              <div class="score-bar-track"><div class="score-bar-fill" style="width:${val}%;background:${INTEL_META[k].color}"></div></div>
              <div class="score-val" style="color:${INTEL_META[k].color}">${val}</div>
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
        ${buildStatRow('먼저 말걸기', Math.round(ms.firstMessageRatio * 100) + '%')}
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
  const sorted = INTEL_KEYS.map(k => ({ key: k, val: s[k] })).sort((a, b) => b.val - a.val);
  const top = sorted[0];
  const bot = sorted[sorted.length - 1];

  let html = '<div class="deep-evidence">';
  html += `<p><b>최강 영역: ${INTEL_META[top.key].icon} ${INTEL_META[top.key].name} (${Math.round(top.val)}점)</b><br>`;
  html += getEvidenceText(top.key, ms);
  html += `</p><br>`;
  html += `<p><b>성장 영역: ${INTEL_META[bot.key].icon} ${INTEL_META[bot.key].name} (${Math.round(bot.val)}점)</b><br>`;
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
    case 'linguistic':
      return `어휘 다양성 ${Math.round(ms.vocabDiversity * 100)}%, 평균 문장 ${ms.avgLength}자, 접속사 활용도 상위권. 복잡한 문장 구조를 자연스럽게 구사합니다.`;
    case 'logical':
      return `분석형 질문 ${Math.round(ms.analyticalQuestionRatio * 100)}%, 인과 표현 활발, 숫자/단위 사용이 빈번합니다. 데이터 기반 사고를 선호합니다.`;
    case 'interpersonal':
      return `공감 반응 점수 ${Math.round((ms.empathyResponseScore + 1) * 50)}점, 관심 질문 비율 ${Math.round(ms.interestQuestionRatio * 100)}%. 상대방의 감정에 민감하게 반응합니다.`;
    case 'intrapersonal':
      return `감정 세밀도 ${Math.round(ms.emotionGranularity * 100)}%, 자기 성찰 표현 빈도 높음. 야간에 더 깊은 감정 표현을 합니다.`;
    case 'musical':
      return `의성어/의태어 활용, ㅋ 패턴 ${ms.kkkLengthVariance}종류, 물결(~) 사용 빈도 ${Math.round(ms.tildeRatio * 100)}%. 텍스트에 리듬감을 부여합니다.`;
    case 'spatial':
      return `사진/동영상 ${ms.photoCount + ms.videoCount}건, 공간 묘사 단어 활용, 장소 언급 빈도 ${Math.round(ms.placeRatio * 100)}%. 시각적 표현을 선호합니다.`;
    case 'naturalistic':
      return `자연/날씨 관련 표현 ${Math.round(ms.natureRatio * 100)}%, 음식/건강 키워드 활발. 주변 환경에 대한 관심이 높습니다.`;
    case 'existential':
      return `추상적 표현 ${Math.round(ms.abstractImpressionRatio * 100)}%, 미래 지향 ${Math.round(ms.futureTenseRatio * 100)}%. 삶의 의미와 가치에 대해 깊이 생각합니다.`;
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
