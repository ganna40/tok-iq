/* ============================================
   톡IQ — 카카오톡 지능 분석기 Web Worker
   웩슬러(WAIS) 기반 5대 인지지표 측정
   tok-wrapped 파서 + 지능 분석 엔진
   ============================================ */

// ===== 정규식 패턴 (tok-wrapped 재활용) =====
const RE_MOBILE = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s+(오전|오후)\s+(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s*(.+)/;
const RE_DATE_DIVIDER = /^-+\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일/;
const RE_SYSTEM = /^\[.+(들어왔습니다|나갔습니다|내보냈습니다|초대했습니다|삭제되었습니다)\.\]$/;
const RE_HEADER = /^(.+?)(?:님과 카카오톡 대화|카카오톡 대화)/;
const RE_PC = /^\[(.+?)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.+)/;
const RE_PHOTO = /^사진$/;
const RE_VIDEO = /^동영상$/;
const RE_EMOTICON = /^이모티콘$/;
const RE_DELETED = /^삭제된 메시지입니다\.?$/;
const RE_LINK = /https?:\/\/\S+/;
const RE_KKK = /[ㅋ]{2,}/g;
const RE_HH = /[ㅎ]{2,}/g;
const RE_UU = /[ㅠㅜ]{2,}/g;
const RE_EMOJI = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
const RE_NUMBER = /\d+/;

// ===== T/F 판별 사전 =====
const T_WORDS = [
  '왜냐하면','왜냐면','따라서','그러므로','그러니까','결론적으로',
  '요약하면','정리하면','요약하자면','결론은',
  '확실','정확','사실','근거','증거','객관','합리','논리',
  '분석','비교','차이','확률','통계','데이터','팩트',
  '해결','방법','대안','효율','성과','목표','계획','전략',
  '수정','개선','보완','조치',
  '아닌데','틀렸','잘못','문제는','핵심은','요점은',
  '당연히','어차피','솔직히','냉정하게',
  '몇시','몇개','얼마','어디서','언제까지',
];
const F_WORDS = [
  '힘들었겠','속상했겠','힘들겠','속상하겠','걱정된','걱정돼',
  '마음이아','마음아프','안쓰럽','어떡해','어쩌나',
  '공감','이해해','맞아맞아','그치그치',
  '힘내','괜찮아','괜찮을','잘될거','잘할수','응원해',
  '화이팅','파이팅','할수있','믿어','곁에','옆에있',
  '감동이야','소중해','소중한','고마워',
  '사랑해','사랑한다','보고싶','그리워',
  '행복해','행복하다','설레','두근',
  '슬퍼','슬프다','눈물나',
  '수고했','수고많','고생했','고생많',
  '잘했어','잘했다','최고야','짱이야',
];
const F_PATTERNS = [
  /많이\s*(힘들|속상|걱정|아프|슬프)/,
  /괜찮아[?]?/,
  /내가\s*(있잖|옆에|곁에)/,
  /[ㅠㅜ]{3,}/,
  /[!]{2,}/,
  /[~]{2,}/,
];
const T_PATTERNS = [
  /어떻게\s*(해|하|된|할)/,
  /왜\s*(그런|안|못|그랬)/,
  /(확인|체크|점검)\s*(해|좀|했)/,
  /\d+[개월일시분초%원]/,
  /(일단|우선|먼저)\s*(해|하자|알아)/,
  /(근데|그런데)\s*(왜|뭐|어떻게)/,
];

// ===== E/I 판별 사전 =====
const E_WORDS = [
  '나가자','만나자','가자','놀자','나와','모여','같이가','어디가',
  '뭐하자','언제볼','약속잡','어디서만','갈래','할래','놀러',
  '우리같이','다같이','데려가','모이자','나갈래',
];
const I_WORDS = [
  '집에','혼자','쉬고싶','피곤','귀찮','나중에연락','조용','혼자있',
  '집콕','쉴래','안나가','귀찮아','힘들어','혼자서','조용히',
  '나중에','다음에','집이좋',
];

// ===== S/N 판별 사전 =====
const S_WORDS = [
  '먹었','갔었','봤어','했어','입었','샀어','만들었','어디','몇시',
  '몇개','얼마','구체적','정확히','자세히','실제로','직접',
  '확실히','분명히','거기','여기','이거','저거','그거',
];
const N_WORDS = [
  '만약','아마','혹시','느낌','의미','왜그런','상상','비유',
  '가능성','미래','아이디어','영감','직감','끌리','궁금',
  '신기','재밌는게','갑자기생각','떠올랐','연결되','관련',
];

// ===== J/P 판별 사전 =====
const J_WORDS = [
  '계획','예약','약속','정했','확인','미리','준비','정리','시간맞',
  '일정','목표','마감','기한','체크','완료','끝냈','다했','해야할',
  '정해놓','예정','스케줄','순서','단계',
];
const P_WORDS = [
  '일단','나중에','모르겠','그때가서','보자','아무거나','그냥','몰라',
  '됐어','상관없','알아서','어쩌다','즉흥','갑자기','대충','아무때나',
  '때되면','내키면','끌리면','마음대로','기분따라',
];

// ===== 언어 깊이 패턴 =====
const RE_PAST_TENSE = /(했어|었어|봤어|갔어|왔어|먹었|샀어|만들었|읽었|들었|받았|잤어|했는데|었는데|았는데)/;
const RE_FUTURE_TENSE = /(할거|할게|할까|하려|해볼|갈게|먹을|만들|볼게|겠어|될거|할건|해야지|가야지)/;
const ABSTRACT_WORDS = ['느낌','기분','분위기','에너지','바이브','감성','인상','직감','영감','가치','의미'];
const RE_COMPLEXITY = /(근데|그런데|왜냐면|왜냐하면|는데|해서|니까|때문에|그래서|그러니까|하지만|그러나|그렇지만)/g;
const RE_HEDGING = /(것같|인듯|아마|혹시|할수도|일지도|아닐까|모르겠|글쎄)/;
const RE_DETAILED_EMOTION = /(진짜웃|배아파|너무웃|눈물남|소름돋|심장터|감동받|울컥|짜릿|두근두|찡하|뭉클)/;
const ONOMATOPOEIA = ['두근두근','콩닥콩닥','반짝반짝','살금살금','두둥','짠짠','쿵쿵','사르르','빙글빙글','소곤소곤','후들후들','쨍','뻥','팍','퍽','쿵','둥둥','따르릉','칙칙폭폭','졸졸','빠직'];

// ===== 질문 유형 분류 =====
const RE_FACTUAL_Q = /(몇시|몇개|얼마|어디|언제|누가|뭐먹|뭐해|어디야|몇명).*([\?？]|$)/;
const RE_HYPOTHETICAL_Q = /(만약|혹시|가정|상상|라면|면어떻|되면|었으면|다면).*([\?？]|$)/;
const RE_EMOTIONAL_Q = /(기분|느낌|어때|어떄|괜찮|힘들|속상|슬프|좋아).*([\?？]|$)/;
const RE_ANALYTICAL_Q = /(왜|이유|원인|어떻게|방법|차이|비교|의미).*([\?？]|$)/;

// ===== 문장 종결 패턴 =====
const RE_PERIOD_END = /[.。]$/;
const RE_TILDE_END = /[~～]+$/;
const RE_ELLIPSIS_END = /[…·]{2,}$|\.{3,}$/;
const RE_EXCLAMATION_END = /[!！]+$/;

// ===== 이모지 의미 분류 =====
const EMOJI_EMOTION = new Set(['😭','😢','😊','🥺','😍','🥰','😤','😡','😱','🤣','😂','🥲','😔','😞','😣','😖','😫','😩','🤗','🤭','🤩','😘','💕','❤️','💗','💖','💓','🖤','💔']);
const EMOJI_REACTION = new Set(['👍','👏','🔥','💯','🙏','👀','✅','❌','⭐','🎉','🎊','👌','✌️','🤝','💪','🫡']);
const EMOJI_DECORATIVE = new Set(['✨','💫','🌟','⭐','🌈','🦋','🍀','🌸','🌺','💐','🎀','🪄','💎','🫧']);
const EMOJI_CONCRETE = new Set(['🍕','🍔','🍜','🍗','🏠','🚗','✈️','📱','💻','🎮','⚽','🏃','🎵','📚','💰','🎁','🛒','☕','🍺','🍷']);

// ===== 감정 사전 =====
const POSITIVE_WORDS = [
  '좋아','사랑','고마워','감사','행복','최고','대박','멋져','예뻐',
  '좋겠','축하','응원','화이팅','파이팅','기대','설레','다행','재밌',
  '맛있','신나','완벽','귀여','짱','감동','웃기','존경','보고싶',
  '잘했','좋다','좋은','행복하','기뻐','즐거','고마','멋있','잘생',
  '이쁘','최고다','대박이','신기','굿','좋아해','사랑해','축하해',
];
const NEGATIVE_WORDS = [
  '싫어','짜증','화나','슬퍼','아프','힘들','피곤','걱정','불안',
  '우울','미안','최악','지겨','무서','답답','외로','속상','귀찮',
  '나쁘','열받','빡치','포기','후회','실망','지치','아파','짜증나',
  '힘들어','슬프','무섭','우울하','별로','싫다','못','안돼','그만',
  '죽겠','미치','헐','에휴','ㅡㅡ',
];

// ===== 불용어 =====
const STOP_WORDS = new Set([
  '나','너','저','이','그','것','수','들','등','및',
  '는','은','을','를','에','의','가','와','과','도',
  '로','으로','에서','까지','부터','한','하다','있다',
  '없다','되다','이다','아','어','오','우','좀','잘',
  '네','예','응','음','흠','아니','근데','그래','진짜',
  '사진','동영상','이모티콘','삭제된','메시지입니다',
  '해서','하고','했어','했는데','했다','하는','해야',
  '있어','없어','있는','없는','했으면','해줘','하면',
]);

// ===== 대화 수리 패턴 =====
const REPAIR_APOLOGY = ['미안','죄송','잘못했','내가그래','내탓','내잘못'];
const REPAIR_LOGIC = ['아니내말은','그게아니라','내가말한건','내뜻은','오해','다시말하면'];
const REPAIR_AVOID = ['됐어','그만하자','그냥','몰라','알았어알았어','넘어가'];
const REPAIR_RESOLVE = ['그래알겠어','이해했어','그러면이렇게','합의','해결','정리하면'];
const SOLVE_WORDS = ['이렇게하자','이렇게해','해봐','해보자','하면돼','방법은','대안','해결책','시도해','차라리','그러면'];

// ===== 지능 측정 전용 사전 =====
const CONNECTIVE_WORDS = ['그래서','그러니까','왜냐하면','따라서','그러므로','하지만','그러나','그렇지만','반면','오히려','게다가','더구나','뿐만아니라','결국','결론적으로','요약하면','즉','다시말해','예를들어','비록','그럼에도'];
const PROFANITY = ['시발','씨발','존나','좆','개새','병신','지랄','ㅅㅂ','ㅈㄴ','ㅂㅅ','ㄱㅅㄲ','미친','씹'];
const CAUSAL_WORDS = ['왜냐하면','왜냐면','때문에','그래서','따라서','그러므로','결과적으로','원인은','이유는','결론은'];
const ANALYTICAL_EXPR = ['비교하면','분석하면','정리하면','확인해보면','계산하면','평균','퍼센트','비율','통계'];
const RE_NUMBER_UNIT = /\d+\s*(개|명|번|원|kg|cm|km|시간|분|초|%|위|등|점|살|월|일|년|만|억)/g;
const INTEREST_QUESTIONS = ['뭐해','어때','괜찮아','잘지내','밥먹었','어디야','뭐하고있','잘잤','기분어때'];
const SELF_REFLECT = ['나는','내가','나도','내생각','나한테','내마음','나자신','내입장','솔직히나','나같은'];
const EMOTION_SELF = ['기분이','느낌이','마음이','감정이','컨디션','상태가','멘탈','심리'];
const RE_TILDE = /[~～]+/g;
const RE_EXCLAMATION_MULTI = /[!！]{2,}/g;
const SPATIAL_WORDS = ['위에','아래','앞에','뒤에','옆에','근처','왼쪽','오른쪽','가운데','사이','건너편','맞은편','방향','쪽으로','거리'];
const PLACE_WORDS = ['카페','식당','공원','학교','회사','집','역','백화점','마트','병원','영화관','도서관','헬스장','미용실','편의점'];
const NATURE_WORDS = ['날씨','비','눈','해','바람','구름','하늘','별','달','꽃','나무','산','바다','강','숲','동물','고양이','강아지','새'];
const FOOD_HEALTH = ['맛있','건강','운동','다이어트','영양','비타민','칼로리','단백질','야채','과일','물','잠'];
const CLASSIFY_WORDS = ['종류','유형','타입','분류','구분','차이','비슷','다른','같은','반대'];
const EXISTENTIAL_WORDS = ['삶','인생','의미','가치','행복','성장','꿈','목표','미래','변화','자유','평화','진실','깨달','배움','경험'];
const PHILOSOPHICAL = ['왜사는','삶이란','인생이란','행복이란','의미있','가치있','성장하','변화하','깨달았','배웠'];

// ===== 로딩 메시지 =====
const LOADING_MESSAGES = [
  { t: 0,  msg: '파일 열어보는 중...' },
  { t: 8,  msg: '대화 내역 읽는 중...' },
  { t: 18, msg: '뇌파 수집 중...' },
  { t: 28, msg: '언어 이해력 분석 중...' },
  { t: 40, msg: '유동 추론력 측정 중...' },
  { t: 52, msg: '작업 기억력 스캔 중...' },
  { t: 64, msg: '처리 속도 측정 중...' },
  { t: 76, msg: '시공간 능력 계산 중...' },
  { t: 86, msg: '인지 프로필 구성 중...' },
  { t: 93, msg: 'IQ 산출 중...' },
  { t: 98, msg: '거의 다 됐어요!' },
];

function getLoadingMessage(percent) {
  let msg = LOADING_MESSAGES[0].msg;
  for (const m of LOADING_MESSAGES) { if (percent >= m.t) msg = m.msg; }
  return msg;
}

function convertHour(ampm, hour) {
  hour = parseInt(hour);
  if (ampm === '오후' && hour !== 12) return hour + 12;
  if (ampm === '오전' && hour === 12) return 0;
  return hour;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ===== 메인 파서 =====
self.onmessage = async function(e) {
  try {
    const text = await e.data.file.text();
    const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const lines = clean.split(/\r?\n/);
    const totalLines = lines.length;

    let partnerFromHeader = null;
    const headerMatch = lines[0]?.match(RE_HEADER);
    if (headerMatch) partnerFromHeader = headerMatch[1].trim();

    const messages = [];
    let currentMsg = null;
    let currentDate = null;
    const progressStep = Math.max(1, Math.floor(totalLines / 60));

    for (let i = 0; i < totalLines; i++) {
      const line = lines[i];
      if (i % progressStep === 0) {
        const pct = Math.round(i / totalLines * 80);
        self.postMessage({ type: 'progress', percent: pct, message: getLoadingMessage(pct) });
      }
      if (!line.trim()) continue;

      if (RE_DATE_DIVIDER.test(line)) {
        if (currentMsg) messages.push(currentMsg);
        currentMsg = null;
        const dm = line.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        if (dm) currentDate = { y: parseInt(dm[1]), m: parseInt(dm[2]), d: parseInt(dm[3]) };
        continue;
      }
      if (RE_SYSTEM.test(line)) {
        if (currentMsg) messages.push(currentMsg);
        currentMsg = null;
        continue;
      }

      const mobile = line.match(RE_MOBILE);
      if (mobile) {
        if (currentMsg) messages.push(currentMsg);
        const hour = convertHour(mobile[4], mobile[5]);
        const min = parseInt(mobile[6]);
        const date = new Date(parseInt(mobile[1]), parseInt(mobile[2]) - 1, parseInt(mobile[3]), hour, min);
        currentMsg = {
          date, sender: mobile[7].trim(), text: mobile[8],
          hour, minute: min, weekday: date.getDay(),
          dateKey: `${mobile[1]}-${String(mobile[2]).padStart(2,'0')}-${String(mobile[3]).padStart(2,'0')}`,
        };
        continue;
      }

      const pc = line.match(RE_PC);
      if (pc && currentDate) {
        if (currentMsg) messages.push(currentMsg);
        const hour = convertHour(pc[2], pc[3]);
        const min = parseInt(pc[4]);
        const date = new Date(currentDate.y, currentDate.m - 1, currentDate.d, hour, min);
        currentMsg = {
          date, sender: pc[1].trim(), text: pc[5],
          hour, minute: min, weekday: date.getDay(),
          dateKey: `${currentDate.y}-${String(currentDate.m).padStart(2,'0')}-${String(currentDate.d).padStart(2,'0')}`,
        };
        continue;
      }

      if (currentMsg && line.trim()) {
        currentMsg.text += '\n' + line;
      }
    }
    if (currentMsg) messages.push(currentMsg);

    if (messages.length === 0) {
      self.postMessage({ type: 'error', message: '메시지를 찾을 수 없습니다. 카카오톡 대화 내보내기 파일인지 확인해주세요.' });
      return;
    }

    self.postMessage({ type: 'progress', percent: 82, message: '통계 계산 중...' });
    const stats = extractStats(messages, partnerFromHeader);
    self.postMessage({ type: 'progress', percent: 92, message: 'IQ 산출 중...' });
    const results = computeWechsler(stats.perMemberStats);
    stats.perMemberStats = results;
    self.postMessage({ type: 'progress', percent: 100, message: '완료!' });
    self.postMessage({ type: 'complete', stats });

  } catch (err) {
    self.postMessage({ type: 'error', message: '파일 분석 중 오류가 발생했습니다: ' + err.message });
  }
};

// ===== 통계 추출 =====
function extractStats(messages, partnerFromHeader) {
  const participantCount = {};
  messages.forEach(m => { participantCount[m.sender] = (participantCount[m.sender] || 0) + 1; });
  const participants = Object.keys(participantCount);
  const isGroup = participants.length > 2;

  let me = null;
  if (!isGroup && participants.length === 2 && partnerFromHeader) {
    me = participants.find(p => p !== partnerFromHeader) || participants[0];
  } else if (!isGroup && participants.length === 2) {
    me = participantCount[participants[0]] >= participantCount[participants[1]]
      ? participants[0] : participants[1];
  }

  const totalMessages = messages.length;
  const firstDate = messages[0].date;
  const lastDate = messages[messages.length - 1].date;
  const totalDays = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
  const dateSet = new Set(messages.map(m => m.dateKey));
  const activeDays = dateSet.size;

  // 대화 분리 (60분 갭)
  const conversations = [];
  let cStart = 0;
  for (let i = 0; i < messages.length; i++) {
    const gap = i > 0 ? (messages[i].date - messages[i - 1].date) / (1000 * 60) : 9999;
    const t = messages[i].text;
    messages[i]._isEmotional = (
      /[ㅠㅜ]{2,}/.test(t) || RE_DETAILED_EMOTION.test(t) ||
      NEGATIVE_WORDS.some(w => t.includes(w))
    );
    if (gap > 60 && i > 0) {
      conversations.push({ start: cStart, end: i - 1, starter: messages[cStart].sender });
      cStart = i;
    }
  }
  if (cStart < messages.length) {
    conversations.push({ start: cStart, end: messages.length - 1, starter: messages[cStart].sender });
  }

  const memberConvIndex = {};
  participants.forEach(p => { memberConvIndex[p] = []; });
  conversations.forEach((conv, ci) => {
    const seen = new Set();
    for (let i = conv.start; i <= conv.end; i++) {
      const s = messages[i].sender;
      if (!seen.has(s)) { seen.add(s); if (memberConvIndex[s]) memberConvIndex[s].push(ci); }
    }
  });

  // 총 단어 수
  let totalWordCount = 0;
  messages.forEach(msg => {
    const cleaned = msg.text.replace(RE_EMOJI, '').replace(/[ㅋㅎㅠㅜ]+/g, '');
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2);
    totalWordCount += words.length;
  });

  // ===== 멤버별 통계 =====
  const perMemberStats = [];
  participants.forEach(name => {
    const memberMsgs = messages.filter(m => m.sender === name);
    const mc = memberMsgs.length;
    let mLen = 0, mKkk = 0, mQ = 0, mSingle = 0, mLink = 0, mUu = 0, mHh = 0;
    let mPhoto = 0, mVideo = 0, mEmoticon = 0;
    let mTWordHits = 0, mFWordHits = 0;
    const mEmojiMap = {};
    const mHourly = new Array(24).fill(0);
    let mPastTense = 0, mFutureTense = 0, mConcreteDetail = 0, mAbstractImpression = 0;
    let mDetailedEmotion = 0, mKkkOnly = 0, mComplexitySum = 0, mHedging = 0, mOnomatopoeia = 0;
    let mNightEmotionCount = 0, mDayEmotionCount = 0, mNightTextCount = 0, mDayTextCount = 0;
    let mFactualQ = 0, mHypotheticalQ = 0, mEmotionalQ = 0, mAnalyticalQ = 0;
    let mTildeEnd = 0, mExclamationEnd = 0;
    let mEmoEmoji = 0, mReactEmoji = 0, mDecoEmoji = 0, mConcreteEmoji = 0;
    let mPos = 0, mNeg = 0;
    let mNumberMsg = 0;

    // 지능 측정 전용 카운터
    let mConnective = 0, mProfanity = 0, mCausal = 0, mAnalyticalExpr = 0;
    let mNumberUnitCount = 0, mInterestQ = 0;
    let mSelfReflect = 0, mEmotionSelf = 0;
    let mTildeCount = 0, mExclamationMulti = 0;
    let mSpatial = 0, mPlace = 0;
    let mNature = 0, mFoodHealth = 0, mClassify = 0;
    let mExistential = 0, mPhilosophical = 0;
    const msgLengths = [];

    // ㅋ 길이 패턴 추적
    const kkkLengths = [];

    memberMsgs.forEach(msg => {
      const t = msg.text;
      const trimmed = t.trim();
      if (RE_PHOTO.test(trimmed)) { mPhoto++; return; }
      if (RE_VIDEO.test(trimmed)) { mVideo++; return; }
      if (RE_EMOTICON.test(trimmed)) { mEmoticon++; return; }
      if (RE_DELETED.test(trimmed)) return;
      if (RE_LINK.test(t)) mLink++;

      mLen += t.length;
      msgLengths.push(t.length);
      if (trimmed.length <= 2) mSingle++;
      if (RE_NUMBER.test(t)) mNumberMsg++;

      // 문장 종결
      if (RE_TILDE_END.test(trimmed)) mTildeEnd++;
      if (RE_EXCLAMATION_END.test(trimmed)) mExclamationEnd++;

      // 질문
      if (t.includes('?') || t.includes('？')) {
        mQ++;
        if (RE_FACTUAL_Q.test(t)) mFactualQ++;
        else if (RE_HYPOTHETICAL_Q.test(t)) mHypotheticalQ++;
        else if (RE_EMOTIONAL_Q.test(t)) mEmotionalQ++;
        else if (RE_ANALYTICAL_Q.test(t)) mAnalyticalQ++;
      }

      // ㅋㅋㅋ
      const km = t.match(RE_KKK);
      if (km) { mKkk += km.length; km.forEach(k => kkkLengths.push(k.length)); }
      const um = t.match(RE_UU); if (um) mUu += um.length;
      const hm = t.match(RE_HH); if (hm) mHh += hm.length;

      // 이모지
      const em = t.match(RE_EMOJI);
      if (em) em.forEach(e => {
        mEmojiMap[e] = (mEmojiMap[e] || 0) + 1;
        if (EMOJI_EMOTION.has(e)) mEmoEmoji++;
        else if (EMOJI_REACTION.has(e)) mReactEmoji++;
        else if (EMOJI_DECORATIVE.has(e)) mDecoEmoji++;
        else if (EMOJI_CONCRETE.has(e)) mConcreteEmoji++;
      });
      mHourly[msg.hour]++;

      // 감정
      POSITIVE_WORDS.forEach(w => { if (t.includes(w)) mPos++; });
      NEGATIVE_WORDS.forEach(w => { if (t.includes(w)) mNeg++; });

      // 기존 사전 히트
      T_WORDS.forEach(w => { if (t.includes(w)) mTWordHits++; });
      F_WORDS.forEach(w => { if (t.includes(w)) mFWordHits++; });

      // 언어 깊이
      if (RE_PAST_TENSE.test(t)) mPastTense++;
      if (RE_FUTURE_TENSE.test(t)) mFutureTense++;
      if (/\d+\s*[개월일시분초%원명장권만억천백]/.test(t)) mConcreteDetail++;
      if (ABSTRACT_WORDS.some(w => t.includes(w))) mAbstractImpression++;
      if (RE_DETAILED_EMOTION.test(t)) mDetailedEmotion++;
      if (/^[ㅋ]+$/.test(trimmed)) mKkkOnly++;
      const _cplx = t.match(RE_COMPLEXITY);
      if (_cplx) mComplexitySum += _cplx.length;
      if (RE_HEDGING.test(t)) mHedging++;
      if (ONOMATOPOEIA.some(w => t.includes(w))) mOnomatopoeia++;

      // 야간/주간 감정어
      const _isNight = msg.hour >= 22 || msg.hour < 5;
      const _hasEmo = POSITIVE_WORDS.some(w => t.includes(w)) || NEGATIVE_WORDS.some(w => t.includes(w));
      if (_isNight) { mNightTextCount++; if (_hasEmo) mNightEmotionCount++; }
      else { mDayTextCount++; if (_hasEmo) mDayEmotionCount++; }

      // ===== 지능 측정 전용 신호 =====
      CONNECTIVE_WORDS.forEach(w => { if (t.includes(w)) mConnective++; });
      PROFANITY.forEach(w => { if (t.includes(w)) mProfanity++; });
      CAUSAL_WORDS.forEach(w => { if (t.includes(w)) mCausal++; });
      ANALYTICAL_EXPR.forEach(w => { if (t.includes(w)) mAnalyticalExpr++; });
      const nuMatches = t.match(RE_NUMBER_UNIT);
      if (nuMatches) mNumberUnitCount += nuMatches.length;
      INTEREST_QUESTIONS.forEach(w => { if (t.includes(w)) mInterestQ++; });
      SELF_REFLECT.forEach(w => { if (t.includes(w)) mSelfReflect++; });
      EMOTION_SELF.forEach(w => { if (t.includes(w)) mEmotionSelf++; });
      const tildeM = t.match(RE_TILDE);
      if (tildeM) mTildeCount += tildeM.length;
      const exclM = t.match(RE_EXCLAMATION_MULTI);
      if (exclM) mExclamationMulti += exclM.length;
      SPATIAL_WORDS.forEach(w => { if (t.includes(w)) mSpatial++; });
      PLACE_WORDS.forEach(w => { if (t.includes(w)) mPlace++; });
      NATURE_WORDS.forEach(w => { if (t.includes(w)) mNature++; });
      FOOD_HEALTH.forEach(w => { if (t.includes(w)) mFoodHealth++; });
      CLASSIFY_WORDS.forEach(w => { if (t.includes(w)) mClassify++; });
      EXISTENTIAL_WORDS.forEach(w => { if (t.includes(w)) mExistential++; });
      PHILOSOPHICAL.forEach(w => { if (t.includes(w)) mPhilosophical++; });
    });

    const mEmojiTotal = Object.values(mEmojiMap).reduce((a, b) => a + b, 0);
    const textCount = mc - mPhoto - mVideo - mEmoticon;

    // 어휘 다양성
    const mUniqueWords = new Set();
    let mTotalWords = 0;
    memberMsgs.forEach(msg => {
      const cleaned = msg.text.replace(RE_EMOJI, '').replace(/[ㅋㅎㅠㅜ]+/g, '');
      const words = cleaned.split(/\s+/).map(w => w.replace(/[.,!?~…""''「」()[\]{}]/g, '').trim()).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
      words.forEach(w => { mUniqueWords.add(w); mTotalWords++; });
    });
    const mVocabDiversity = mTotalWords > 0 ? mUniqueWords.size / mTotalWords : 0;

    // 먼저 말걸기
    let mFirst = 0, mConv = 0, lt = null;
    messages.forEach(m => {
      const gap = lt ? (m.date - lt) / (1000 * 60) : 9999;
      if (gap > 60) { mConv++; if (m.sender === name) mFirst++; }
      lt = m.date;
    });

    // 응답 시간
    const mResponseTimes = [];
    let mLastSender = null, mLastTime = null;
    messages.forEach(m => {
      if (mLastSender && mLastTime && m.sender !== mLastSender) {
        const gap = (m.date - mLastTime) / (1000 * 60);
        if (gap > 0.1 && gap < 60 * 24 && m.sender === name) mResponseTimes.push(gap);
      }
      mLastSender = m.sender; mLastTime = m.date;
    });

    const mNight = mHourly.slice(0, 5).reduce((a, b) => a + b, 0);
    const mMorning = mHourly.slice(5, 12).reduce((a, b) => a + b, 0);

    // 야간 감정어 밀도
    const mNightEmotionDensity = mNightTextCount > 0 ? mNightEmotionCount / mNightTextCount : 0;
    const mDayEmotionDensity = mDayTextCount > 0 ? mDayEmotionCount / mDayTextCount : 0;

    // 메시지 길이 분산 (리듬감 지표)
    const avgMsgLen = msgLengths.length > 0 ? msgLengths.reduce((a, b) => a + b, 0) / msgLengths.length : 0;
    const msgLenVariance = msgLengths.length > 1
      ? msgLengths.reduce((s, l) => s + (l - avgMsgLen) ** 2, 0) / msgLengths.length
      : 0;
    const msgLenStdDev = Math.sqrt(msgLenVariance);

    // ㅋ 길이 다양성 (음악-리듬 지표)
    const kkkLengthSet = new Set(kkkLengths);
    const kkkLengthVariance = kkkLengthSet.size;

    // 대화 맥락 신호
    const myConvs = memberConvIndex[name] || [];
    let mEmpathyPos = 0, mEmpathyNeg = 0, mTotalConvMsgs = 0;
    let mEnergySlopeSum = 0, mEnergySlopeCount = 0;
    let mEmpathySustain = 0, mEmpathyThenSolve = 0, mDirectSolve = 0;
    let mTopicDriver = 0;

    myConvs.forEach(ci => {
      const conv = conversations[ci];
      let prevSender = null, prevTime = null;
      const myMsgLens = [];
      let _lastEmpathyType = null;
      for (let i = conv.start; i <= conv.end; i++) {
        const m = messages[i];
        if (m.sender === name) {
          mTotalConvMsgs++;
          myMsgLens.push(m.text.length);
          if (prevTime && (m.date - prevTime) / (1000 * 60) >= 5) mTopicDriver++;
          if (prevSender && prevSender !== name && i > conv.start && messages[i - 1]._isEmotional) {
            const rt = m.text;
            const _isEmpathy = F_WORDS.some(w => rt.includes(w)) || F_PATTERNS.some(re => re.test(rt));
            const _isTSolve = T_WORDS.some(w => rt.includes(w)) || T_PATTERNS.some(re => re.test(rt));
            if (_isEmpathy) mEmpathyPos++;
            if (_isTSolve) mEmpathyNeg++;
            const _isSolve = _isTSolve || SOLVE_WORDS.some(w => rt.includes(w));
            if (_isEmpathy && !_isSolve) {
              if (_lastEmpathyType === 'empathy') mEmpathySustain++;
              _lastEmpathyType = 'empathy';
            } else if (_isSolve) {
              if (_lastEmpathyType === 'empathy') mEmpathyThenSolve++;
              else mDirectSolve++;
              _lastEmpathyType = 'solve';
            } else {
              _lastEmpathyType = null;
            }
          }
        }
        prevSender = m.sender; prevTime = m.date;
      }
      if (myMsgLens.length >= 4) {
        const half = Math.floor(myMsgLens.length / 2);
        const avgF = myMsgLens.slice(0, half).reduce((a, b) => a + b, 0) / half;
        const avgS = myMsgLens.slice(half).reduce((a, b) => a + b, 0) / (myMsgLens.length - half);
        if (avgF > 0) { mEnergySlopeSum += (avgS - avgF) / avgF; mEnergySlopeCount++; }
      }
    });

    const mEmpathyTotal = mEmpathyPos + mEmpathyNeg;
    const mEnergyCurveSlope = mEnergySlopeCount > 0 ? mEnergySlopeSum / mEnergySlopeCount : 0;

    // 최다 이모지
    const topEmoji = Object.entries(mEmojiMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    // 최다 단어
    const wordCount = {};
    memberMsgs.forEach(msg => {
      const cleaned = msg.text.replace(RE_EMOJI, '').replace(/[ㅋㅎㅠㅜ]+/g, '');
      const words = cleaned.split(/\s+/).map(w => w.replace(/[.,!?~…""''「」()[\]{}]/g, '').trim()).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
      words.forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });
    });
    const topWords = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

    perMemberStats.push({
      name, count: mc, totalWords: mTotalWords,
      avgLength: textCount > 0 ? Math.round(mLen / textCount) : 0,
      avgSentenceLength: textCount > 0 ? mLen / textCount : 0,
      kkkRatio: mc > 0 ? mKkk / mc : 0,
      emojiRatio: mc > 0 ? mEmojiTotal / mc : 0,
      emojiEmotionRatio: mEmojiTotal > 0 ? mEmoEmoji / mEmojiTotal : 0,
      emoticonRatio: mc > 0 ? mEmoticon / mc : 0,
      topEmoji, topWords,
      nightRatio: mc > 0 ? mNight / mc : 0,
      morningRatio: mc > 0 ? mMorning / mc : 0,
      questionRatio: mc > 0 ? mQ / mc : 0,
      singleCharRatio: mc > 0 ? mSingle / mc : 0,
      linkRatio: mc > 0 ? mLink / mc : 0,
      uuRatio: mc > 0 ? mUu / mc : 0,
      hhRatio: mc > 0 ? mHh / mc : 0,
      firstMessageRatio: mConv > 0 ? mFirst / mConv : 0,
      mediaRatio: mc > 0 ? (mPhoto + mVideo + mEmoticon) / mc : 0,
      dailyAvg: Math.round(mc / totalDays),
      posRatio: mc > 0 ? mPos / mc : 0,
      negRatio: mc > 0 ? mNeg / mc : 0,
      vocabDiversity: mVocabDiversity,
      avgResponse: mResponseTimes.length > 0 ? mResponseTimes.reduce((a, b) => a + b, 0) / mResponseTimes.length : 0,
      photoCount: mPhoto, videoCount: mVideo, emoticonCount: mEmoticon,
      numberRatio: mc > 0 ? mNumberMsg / mc : 0,
      tWordRatio: mc > 0 ? mTWordHits / mc : 0,
      fWordRatio: mc > 0 ? mFWordHits / mc : 0,
      // 언어 깊이
      pastTenseRatio: textCount > 0 ? mPastTense / textCount : 0,
      futureTenseRatio: textCount > 0 ? mFutureTense / textCount : 0,
      concreteDetailRatio: textCount > 0 ? mConcreteDetail / textCount : 0,
      abstractImpressionRatio: textCount > 0 ? mAbstractImpression / textCount : 0,
      emotionGranularity: (mDetailedEmotion + mKkkOnly) > 0 ? mDetailedEmotion / (mDetailedEmotion + mKkkOnly) : 0.5,
      complexityPerMsg: textCount > 0 ? mComplexitySum / textCount : 0,
      hedgingSoftenerRatio: textCount > 0 ? mHedging / textCount : 0,
      onomatopoeiaRatio: textCount > 0 ? mOnomatopoeia / textCount : 0,
      nightEmotionality: mDayEmotionDensity > 0 ? mNightEmotionDensity / mDayEmotionDensity : 1,
      detailedEmotionRatio: textCount > 0 ? mDetailedEmotion / textCount : 0,
      // 질문 유형
      factualQuestionRatio: mQ > 0 ? mFactualQ / mQ : 0,
      hypotheticalQuestionRatio: mQ > 0 ? mHypotheticalQ / mQ : 0,
      emotionalQuestionRatio: mQ > 0 ? mEmotionalQ / mQ : 0,
      analyticalQuestionRatio: mQ > 0 ? mAnalyticalQ / mQ : 0,
      // 대화 맥락
      empathyResponseScore: mEmpathyTotal > 0 ? (mEmpathyPos - mEmpathyNeg) / mEmpathyTotal : 0,
      empathySustainScore: (mEmpathySustain + mEmpathyThenSolve + mDirectSolve) > 0 ? (mEmpathySustain + mEmpathyThenSolve * 0.5) / (mEmpathySustain + mEmpathyThenSolve + mDirectSolve) : 0.5,
      topicDriverRatio: mTotalConvMsgs > 0 ? mTopicDriver / mTotalConvMsgs : 0,
      energyCurveSlope: mEnergyCurveSlope,
      sWordRatio: mc > 0 ? mConcreteDetail / mc : 0,
      // ===== 지능 측정 전용 비율 =====
      connectiveRatio: textCount > 0 ? mConnective / textCount : 0,
      profanityRatio: textCount > 0 ? mProfanity / textCount : 0,
      causalRatio: textCount > 0 ? mCausal / textCount : 0,
      analyticalExprRatio: textCount > 0 ? mAnalyticalExpr / textCount : 0,
      numberUnitCount: mNumberUnitCount,
      interestQuestionRatio: mQ > 0 ? mInterestQ / Math.max(1, mQ) : 0,
      selfReflectRatio: textCount > 0 ? mSelfReflect / textCount : 0,
      emotionSelfRatio: textCount > 0 ? mEmotionSelf / textCount : 0,
      tildeRatio: textCount > 0 ? mTildeCount / textCount : 0,
      exclamationMultiRatio: textCount > 0 ? mExclamationMulti / textCount : 0,
      messageLengthVariance: msgLenStdDev,
      kkkLengthVariance: kkkLengthVariance,
      spatialRatio: textCount > 0 ? mSpatial / textCount : 0,
      placeRatio: textCount > 0 ? mPlace / textCount : 0,
      natureRatio: textCount > 0 ? mNature / textCount : 0,
      foodHealthRatio: textCount > 0 ? mFoodHealth / textCount : 0,
      classifyRatio: textCount > 0 ? mClassify / textCount : 0,
      existentialRatio: textCount > 0 ? mExistential / textCount : 0,
      philosophicalRatio: textCount > 0 ? mPhilosophical / textCount : 0,
    });
  });
  perMemberStats.sort((a, b) => b.count - a.count);

  return {
    totalMessages, totalDays, activeDays, totalWordCount,
    isGroup, participants, me,
    firstDate: messages[0].dateKey,
    lastDate: messages[messages.length - 1].dateKey,
    perMemberStats,
  };
}

// ===== 웩슬러(WAIS) 5대 인지지표 측정 엔진 =====
// 그룹 적응형 스코어링 — 실제 데이터 기반
//
// 5대 지표:
// VCI (언어이해) — 어휘력, 문장 복잡도, 접속사, 시제
// FRI (유동추론) — 분석적 사고, 인과관계, 논리, 데이터
// WMI (작업기억) — 주제 유지, 맥락 연결, 복잡 문장
// PSI (처리속도) — 응답 속도, 메시지 빈도, 표현 효율
// VSI (시공간)   — 미디어, 공간 묘사, 시각적 표현
//
// 스코어링:
// S(val, groupAvg): 절대 점수 (지수감쇠, floor 20%)
// R(val, groupAvg, groupStd): 상대 점수 (z-score + tanh)
// raw 0~100 → 웩슬러 지표 55~145 (mean≈100)
// FSIQ = 5개 지표 균등 평균

function computeWechsler(memberStats) {
  const n = memberStats.length || 1;
  const avg = (field) => {
    const vals = memberStats.map(m => m[field] || 0);
    return vals.reduce((a, b) => a + b, 0) / n;
  };
  const std = (field) => {
    const a = avg(field);
    const vals = memberStats.map(m => m[field] || 0);
    const variance = vals.reduce((s, v) => s + (v - a) ** 2, 0) / n;
    return Math.sqrt(variance) || 0.0001;
  };

  function S(val, groupAvg, maxPts) {
    const ref = Math.max(groupAvg, 0.0001);
    const r = val / ref;
    const mapped = 1 - Math.exp(-r * 1.2);
    return maxPts * (0.2 + mapped * 0.8);
  }

  function S_inv(val, groupAvg, maxPts) {
    const ref = Math.max(groupAvg, 0.0001);
    const r = val / ref;
    const mapped = Math.exp(-r * 1.2);
    return maxPts * (0.1 + mapped * 0.9);
  }

  function R(val, groupAvg, groupStd, maxPts) {
    if (groupStd < 0.0001) return maxPts * 0.5;
    const z = (val - groupAvg) / groupStd;
    return maxPts * (Math.tanh(z * 0.6) + 1) / 2;
  }

  function R_inv(val, groupAvg, groupStd, maxPts) {
    if (groupStd < 0.0001) return maxPts * 0.5;
    const z = (val - groupAvg) / groupStd;
    return maxPts * (Math.tanh(-z * 0.6) + 1) / 2;
  }

  return memberStats.map(ms => {
    const raw = {};
    const nuPerMsg = ms.numberUnitCount / Math.max(1, ms.count);
    const nuPerMsgAvg = avg('numberUnitCount') / Math.max(1, avg('count'));
    const nuPerMsgStd = std('numberUnitCount') / Math.max(1, avg('count'));
    const wordsPerMsg = ms.totalWords / Math.max(1, ms.count);
    const wordsPerMsgAvg = avg('totalWords') / Math.max(1, avg('count'));
    const wordsPerMsgStd = std('totalWords') / Math.max(1, avg('count'));
    const empathy = Math.max(ms.empathySustainScore, ms.empathyResponseScore * 0.5 + 0.5);
    const myResp = ms.avgResponse > 0 ? ms.avgResponse : avg('avgResponse');

    // ===== VCI: 언어이해 (Verbal Comprehension) =====
    // 어휘 다양성, 문장 복잡도, 접속사, 시제, 추상어
    raw.vci = clamp(0, 100,
      S(ms.vocabDiversity, avg('vocabDiversity'), 14) +
      S(ms.avgSentenceLength, avg('avgSentenceLength'), 10) +
      S(ms.connectiveRatio, avg('connectiveRatio'), 10) +
      S(ms.complexityPerMsg, avg('complexityPerMsg'), 8) +
      S_inv(ms.profanityRatio, avg('profanityRatio'), 6) +
      S(ms.pastTenseRatio + ms.futureTenseRatio, avg('pastTenseRatio') + avg('futureTenseRatio'), 8) +
      R(ms.vocabDiversity, avg('vocabDiversity'), std('vocabDiversity'), 12) +
      R(ms.avgSentenceLength, avg('avgSentenceLength'), std('avgSentenceLength'), 8) +
      R(ms.connectiveRatio, avg('connectiveRatio'), std('connectiveRatio'), 8) +
      R(ms.complexityPerMsg, avg('complexityPerMsg'), std('complexityPerMsg'), 8) +
      R(ms.abstractImpressionRatio, avg('abstractImpressionRatio'), std('abstractImpressionRatio'), 8)
    );

    // ===== FRI: 유동추론 (Fluid Reasoning) =====
    // 분석적 사고, 인과관계, 논리 연결, 데이터/숫자
    raw.fri = clamp(0, 100,
      S(ms.tWordRatio, avg('tWordRatio'), 12) +
      S(ms.causalRatio, avg('causalRatio'), 10) +
      S(ms.analyticalExprRatio, avg('analyticalExprRatio'), 8) +
      S(nuPerMsg, nuPerMsgAvg, 10) +
      S(ms.analyticalQuestionRatio, avg('analyticalQuestionRatio'), 8) +
      S(ms.linkRatio, avg('linkRatio'), 8) +
      R(ms.tWordRatio, avg('tWordRatio'), std('tWordRatio'), 10) +
      R(ms.causalRatio, avg('causalRatio'), std('causalRatio'), 8) +
      R(nuPerMsg, nuPerMsgAvg, nuPerMsgStd, 8) +
      R(ms.analyticalQuestionRatio, avg('analyticalQuestionRatio'), std('analyticalQuestionRatio'), 8) +
      R(ms.hypotheticalQuestionRatio, avg('hypotheticalQuestionRatio'), std('hypotheticalQuestionRatio'), 6) +
      R(ms.linkRatio, avg('linkRatio'), std('linkRatio'), 4)
    );

    // ===== WMI: 작업기억 (Working Memory) =====
    // 주제 유지, 맥락 연결, 복잡 문장 처리, 공감 유지
    raw.wmi = clamp(0, 100,
      S(ms.topicDriverRatio, avg('topicDriverRatio'), 12) +
      S(ms.complexityPerMsg, avg('complexityPerMsg'), 10) +
      S(ms.avgSentenceLength, avg('avgSentenceLength'), 10) +
      S(empathy, avg('empathySustainScore'), 8) +
      S(ms.connectiveRatio, avg('connectiveRatio'), 8) +
      S(ms.hedgingSoftenerRatio, avg('hedgingSoftenerRatio'), 8) +
      R(ms.topicDriverRatio, avg('topicDriverRatio'), std('topicDriverRatio'), 10) +
      R(ms.complexityPerMsg, avg('complexityPerMsg'), std('complexityPerMsg'), 8) +
      R(ms.avgSentenceLength, avg('avgSentenceLength'), std('avgSentenceLength'), 8) +
      R(empathy, avg('empathySustainScore'), std('empathySustainScore'), 8) +
      R(ms.connectiveRatio, avg('connectiveRatio'), std('connectiveRatio'), 5) +
      R(ms.hedgingSoftenerRatio, avg('hedgingSoftenerRatio'), std('hedgingSoftenerRatio'), 5)
    );

    // ===== PSI: 처리속도 (Processing Speed) =====
    // 응답 속도(역), 메시지 빈도, 표현 효율, 총 볼륨
    raw.psi = clamp(0, 100,
      S_inv(myResp, avg('avgResponse'), 14) +
      S(ms.dailyAvg, avg('dailyAvg'), 12) +
      S(wordsPerMsg, wordsPerMsgAvg, 10) +
      S_inv(ms.singleCharRatio, avg('singleCharRatio'), 10) +
      S(ms.count, avg('count'), 10) +
      R_inv(myResp, avg('avgResponse'), std('avgResponse'), 10) +
      R(ms.dailyAvg, avg('dailyAvg'), std('dailyAvg'), 8) +
      R(wordsPerMsg, wordsPerMsgAvg, wordsPerMsgStd, 8) +
      R_inv(ms.singleCharRatio, avg('singleCharRatio'), std('singleCharRatio'), 8) +
      R(ms.count, avg('count'), std('count'), 10)
    );

    // ===== VSI: 시공간 (Visual-Spatial) =====
    // 미디어 공유, 공간 묘사, 장소, 이모지/이모티콘
    raw.vsi = clamp(0, 100,
      S(ms.mediaRatio, avg('mediaRatio'), 14) +
      S(ms.spatialRatio, avg('spatialRatio'), 10) +
      S(ms.placeRatio, avg('placeRatio'), 10) +
      S(ms.emoticonRatio, avg('emoticonRatio'), 8) +
      S(ms.concreteDetailRatio, avg('concreteDetailRatio'), 8) +
      S(ms.emojiRatio, avg('emojiRatio'), 6) +
      R(ms.mediaRatio, avg('mediaRatio'), std('mediaRatio'), 10) +
      R(ms.spatialRatio, avg('spatialRatio'), std('spatialRatio'), 8) +
      R(ms.placeRatio, avg('placeRatio'), std('placeRatio'), 8) +
      R(ms.emoticonRatio, avg('emoticonRatio'), std('emoticonRatio'), 6) +
      R(ms.concreteDetailRatio, avg('concreteDetailRatio'), std('concreteDetailRatio'), 6) +
      R(ms.emojiRatio, avg('emojiRatio'), std('emojiRatio'), 6)
    );

    // ===== 웩슬러 지표 점수 변환 =====
    // raw 0~100 → Index 55~145 (평균 raw ~65 → Index ~102)
    const indices = {};
    for (const key of ['vci','fri','wmi','psi','vsi']) {
      indices[key] = Math.round(clamp(55, 145, 40 + raw[key] * 0.95));
    }

    // FSIQ = 5개 지표 균등 평균
    const fsiq = Math.round(
      (indices.vci + indices.fri + indices.wmi + indices.psi + indices.vsi) / 5
    );
    const iq = clamp(55, 145, fsiq);

    // 티어 (웩슬러 분류 기반)
    let tier;
    if (iq >= 130) tier = { name: '최우수', emoji: '🧠', color: '#fbbf24' };
    else if (iq >= 120) tier = { name: '우수', emoji: '⚡', color: '#a855f7' };
    else if (iq >= 110) tier = { name: '평균 상', emoji: '✨', color: '#00d4ff' };
    else if (iq >= 100) tier = { name: '평균', emoji: '📊', color: '#22c55e' };
    else if (iq >= 90) tier = { name: '평균 하', emoji: '💪', color: '#f59e0b' };
    else tier = { name: '경계', emoji: '💤', color: '#ef4444' };

    // 강점/약점
    const sorted = Object.entries(indices).sort((a, b) => b[1] - a[1]);
    const strengths = sorted.slice(0, 2).map(s => s[0]);
    const weaknesses = sorted.slice(-2).map(s => s[0]);

    return { ...ms, rawScores: raw, intelligence: indices, iq, tier, strengths, weaknesses };
  });
}

function clamp(min, max, val) { return Math.max(min, Math.min(max, val)); }
