/**
 * 刷题平台主应用 - 优化版本
 * 包含性能优化、增强交互体验
 */

// ============================================
// 全局状态
// ============================================
let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;
let sessionStats = { done: 0, correct: 0 };
let answered = false;
let progress = {};
let practiceMode = 'all'; // 练习模式: all, wrong, random

// 性能优化：DOM 缓存
const domCache = {};

// 题型映射
const TYPE_LABELS = {
  'single': '单选题',
  'multiple': '多选题',
  'judge': '判断题',
  'material': '材料题',
  'essay': '论述题'
};

// ============================================
// 工具函数 - 性能优化
// ============================================

/**
 * 防抖函数 - 减少高频操作
 */
function debounce(fn, delay = 200) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 节流函数 - 限制操作频率
 */
function throttle(fn, limit = 100) {
  let inThrottle = false;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 缓存 DOM 查询结果
 */
function $(selector) {
  if (!domCache[selector]) {
    domCache[selector] = document.querySelector(selector);
  }
  return domCache[selector];
}

/**
 * 批量 DOM 操作 - 减少重绘
 */
function batchDOM(operations) {
  // 使用 requestAnimationFrame 批量处理
  requestAnimationFrame(() => {
    operations.forEach(op => op());
  });
}

/**
 * 触觉反馈（移动端）
 */
function vibrate(pattern = 10) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // 忽略不支持振动的情况
    }
  }
}

/**
 * 显示加载状态
 */
function showLoading(container = $('.content')) {
  // 保留现有的 DOM 结构，只添加加载层覆盖
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loadingOverlay';
  loadingOverlay.className = 'empty-state';
  loadingOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:var(--bg-secondary);z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  loadingOverlay.innerHTML = `
    <div class="loading"></div>
    <p>加载中...</p>
  `;

  // 移除旧的加载层（如果有）
  const oldLoading = document.getElementById('loadingOverlay');
  if (oldLoading) oldLoading.remove();

  // 插入新的加载层
  container.style.position = 'relative';
  container.appendChild(loadingOverlay);

  // 不再隐藏问题容器，而是通过 loadingOverlay 覆盖
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.transition = 'opacity 0.3s';
    setTimeout(() => loadingOverlay.remove(), 300);
  }
}

// ============================================
// 初始化
// ============================================
async function init() {
  try {
    loadProgress();
    loadEyeCareMode();
    await loadQuestions();
    bindEvents();
    updateStats();
    initIntersectionObserver();
  } catch (error) {
    console.error('初始化失败:', error);
    hideLoading(); // 确保隐藏加载状态
    showError('初始化失败，请刷新页面重试');
  }
}

/**
 * 显示错误信息
 */
function showError(message) {
  const container = $('.content');
  if (container) {
    // 如果 message 包含 HTML 标签，直接使用；否则包装在 p 标签中
    const isHtml = /<[a-z][\s\S]*>/i.test(message);
    container.innerHTML = isHtml ? message : `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>${message}</p>
      </div>
    `;
  }
}

// ============================================
// 题库加载
// ============================================
async function loadQuestions() {
  const container = $('.content');
  showLoading(container);

  try {
    let data = null;

    // 优先使用内嵌数据（支持 file:// 协议）
    if (typeof QUIZ_DATA !== 'undefined' && QUIZ_DATA.questions) {
      data = QUIZ_DATA;
      console.log('使用内嵌题库数据:', data.questions.length, '题');
    } else {
      // 尝试从服务器加载（支持 http:// 协议）
      const response = await fetch('data/questions.json');
      if (!response.ok) throw new Error('加载题库失败');
      data = await response.json();
    }

    allQuestions = data.questions || [];
    currentQuestions = [...allQuestions];

    if (allQuestions.length === 0) {
      showEmptyState();
      return;
    }

    batchDOM([
      () => renderTypeNav(),
      () => renderQuestionList(),
      () => renderQuestion(),
      () => showQuestionUI()
    ]);
  } catch (e) {
    console.error('加载题库失败:', e);
    showError(`
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>题库加载失败</p>
        <p class="empty-hint">请使用本地服务器运行，如 Live Server</p>
        <p class="empty-hint" style="font-size:12px;margin-top:10px;">或确保 data/questions.json 文件存在</p>
      </div>
    `);
  }
}

/**
 * 显示空状态
 */
function showEmptyState() {
  const container = $('.content');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>暂无题目</p>
        <p class="empty-hint">请先导入题库数据</p>
      </div>
    `;
  }
}

// ============================================
// 事件绑定
// ============================================
function bindEvents() {
  // 使用事件委托减少监听器数量
  const typeNav = $('#typeNav');
  if (typeNav) {
    typeNav.addEventListener('click', handleTypeNavClick);
  }

  const questionList = $('#questionList');
  if (questionList) {
    questionList.addEventListener('click', handleQuestionListClick);
  }

  const mobileNav = $('#mobileNav');
  if (mobileNav) {
    mobileNav.addEventListener('click', handleQuestionListClick);
  }

  // 按钮事件
  const submitBtn = $('#submitBtn');
  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  const eyeCareBtn = $('#eyeCareBtn');

  if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
  if (prevBtn) prevBtn.addEventListener('click', prevQuestion);
  if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
  if (eyeCareBtn) eyeCareBtn.addEventListener('click', toggleEyeCareMode);

  // 键盘事件（节流处理）
  document.addEventListener('keydown', throttle(handleKeydown, 100));

  // 移动端触摸支持
  addTouchSupport();
}

/**
 * 题型导航点击处理（事件委托）
 */
function handleTypeNavClick(e) {
  const btn = e.target.closest('.type-btn');
  if (!btn) return;

  const type = btn.dataset.type;
  filterByType(type);
}

/**
 * 题目列表点击处理（事件委托）
 */
function handleQuestionListClick(e) {
  const item = e.target.closest('.question-item');
  if (!item) return;

  const idx = parseInt(item.dataset.index);
  if (isNaN(idx)) return;

  // 背题模式：滚动到对应题目
  if (practiceMode === 'memorize') {
    const question = currentQuestions[idx];
    const targetElement = document.getElementById(`question-${question.sequence}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 高亮效果
      targetElement.style.transition = 'box-shadow 0.3s';
      targetElement.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.5)';
      setTimeout(() => {
        targetElement.style.boxShadow = '';
      }, 1000);
    }
    return;
  }

  currentIndex = idx;
  answered = false;

  // 添加切换动画
  animateQuestionChange(() => {
    renderQuestion();
    updateActiveItem();
    hideFeedback();
  });
}

/**
 * 提交按钮处理（节流）
 */
const handleSubmit = throttle(function() {
  submitAnswer();
}, 300);

/**
 * 添加触摸支持
 */
function addTouchSupport() {
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (currentQuestions.length === 0) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // 水平滑动阈值
    const threshold = 50;

    // 只处理水平滑动
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
      if (diffX > 0) {
        // 右滑 - 上一题
        prevQuestion();
      } else {
        // 左滑 - 下一题
        nextQuestion();
      }
      vibrate(10);
    }
  }, { passive: true });
}

// ============================================
// 渲染函数
// ============================================

/**
 * 渲染题型导航
 */
function renderTypeNav() {
  const nav = $('#typeNav');
  if (!nav) return;

  const types = {};
  allQuestions.forEach(q => {
    types[q.type] = (types[q.type] || 0) + 1;
  });

  // 统计错题数量
  const wrongCount = Object.values(progress).filter(p => !p.correct).length;

  const html = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
      <button class="mode-btn ${practiceMode === 'all' ? 'active' : ''}" data-mode="all">
        📝 全部题目
      </button>
      <button class="mode-btn ${practiceMode === 'wrong' ? 'active' : ''}" data-mode="wrong" ${wrongCount === 0 ? 'disabled' : ''}>
        ❌ 错题重做 (${wrongCount})
      </button>
      <button class="mode-btn ${practiceMode === 'random' ? 'active' : ''}" data-mode="random">
        🔀 随机练习
      </button>
      <button class="mode-btn ${practiceMode === 'memorize' ? 'active' : ''}" data-mode="memorize" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;">
        📖 背题模式
      </button>
      <button class="mode-btn" data-mode="reset" style="background:#ff6b6b;color:white;">
        🗑️ 清空进度
      </button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="type-btn active" data-type="all">
        全部 (${allQuestions.length})
      </button>
      ${Object.entries(types).map(([type, count]) => `
        <button class="type-btn" data-type="${type}">
          ${TYPE_LABELS[type] || type} (${count})
        </button>
      `).join('')}
    </div>
  `;

  nav.innerHTML = html;

  // 绑定练习模式按钮事件
  nav.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.dataset.mode;
      if (mode === 'reset') {
        if (confirm('确定要清空所有练习记录吗？此操作不可恢复！')) {
          resetProgress();
        }
      } else {
        setPracticeMode(mode);
      }
    });
  });
}

/**
 * 按题型筛选
 */
function filterByType(type) {
  // 更新按钮状态
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  applyFilters(type);
}

/**
 * 设置练习模式
 */
function setPracticeMode(mode) {
  practiceMode = mode;

  // 更新按钮状态
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // 获取当前选中的题型
  const activeTypeBtn = document.querySelector('.type-btn.active');
  const currentType = activeTypeBtn ? activeTypeBtn.dataset.type : 'all';

  applyFilters(currentType);
}

/**
 * 应用筛选条件
 */
function applyFilters(type = 'all') {
  let questions = type === 'all'
    ? [...allQuestions]
    : allQuestions.filter(q => q.type === type);

  // 应用练习模式
  if (practiceMode === 'wrong') {
    const wrongQuestions = questions.filter(q => {
      const hasProgress = progress[q.id];
      const isWrong = hasProgress && !progress[q.id].correct;
      return isWrong;
    });
    if (wrongQuestions.length === 0) {
      showToast('📝 暂无错题，继续加油！');
      // 切换回全部模式
      practiceMode = 'all';
      document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === 'all');
      });
    } else {
      questions = wrongQuestions;
    }
  } else if (practiceMode === 'random') {
    questions = shuffleArray([...questions]);
    // 随机模式下打乱每个题目的选项顺序，并重新分配标签和答案
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    questions = questions.map(q => {
      if (!q.options || q.options.length === 0) return q;

      // 获取原始正确答案的标签集合（如 ['A'] 或 ['A', 'B']）
      const originalCorrectLabels = q.answer.replace(/\s+/g, '').split('').filter(c => /[A-Z]/.test(c));

      // 打乱选项
      const shuffledOptions = shuffleArray([...q.options]);

      // 重新按顺序分配标签，并找出新标签对应的正确答案
      const newCorrectLabels = [];
      const newOptions = shuffledOptions.map((opt, idx) => {
        const newLabel = labels[idx] || String.fromCharCode(65 + idx);
        // 如果这个选项原本是正确答案，记录新的标签
        if (originalCorrectLabels.includes(opt.label)) {
          newCorrectLabels.push(newLabel);
        }
        return {
          ...opt,
          label: newLabel
        };
      });

      // 更新答案为新标签（按字母顺序排列以保持一致性）
      const newAnswer = newCorrectLabels.sort().join('');

      return {
        ...q,
        options: newOptions,
        answer: newAnswer
      };
    });
  } else if (practiceMode === 'memorize') {
    // 背题模式：直接显示答案，不需要打乱顺序
    questions = [...questions];
  }

  currentQuestions = questions;
  currentIndex = 0;
  answered = false;

  animateQuestionChange(() => {
    renderQuestionList();
    renderQuestion();
    hideFeedback();
  });
}

/**
 * 随机打乱数组（Fisher-Yates 算法）
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 清空进度
 */
function resetProgress() {
  progress = {};
  localStorage.removeItem('quiz_progress');
  sessionStats = { done: 0, correct: 0 };

  // 重新渲染导航和题目列表
  renderTypeNav();
  renderQuestionList();
  updateStats();

  // 重置到当前筛选
  const activeTypeBtn = document.querySelector('.type-btn.active');
  const currentType = activeTypeBtn ? activeTypeBtn.dataset.type : 'all';
  applyFilters(currentType);

  showToast('✅ 进度已清空');
  vibrate([10, 50, 10]);
}

/**
 * 题目切换动画
 */
function animateQuestionChange(callback) {
  const container = $('.question-container');
  if (container) {
    container.style.opacity = '0';
    container.style.transform = 'translateY(10px)';

    setTimeout(() => {
      callback();
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    }, 150);
  } else {
    callback();
  }
}

/**
 * 渲染题目列表
 */
function renderQuestionList() {
  const list = $('#questionList');
  const mobileNav = $('#mobileNav');

  if (!list) return;

  if (currentQuestions.length === 0) {
    list.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无题目</p>';
    if (mobileNav) mobileNav.innerHTML = '';
    return;
  }

  // 按题型分组
  const grouped = {};
  currentQuestions.forEach((q, idx) => {
    if (!grouped[q.type]) grouped[q.type] = [];
    grouped[q.type].push({ ...q, index: idx });
  });

  const listHtml = Object.entries(grouped).map(([type, questions]) => `
    <div class="question-group">
      <h4 class="group-title">${TYPE_LABELS[type] || type} (${questions.length}题)</h4>
      <div class="question-items">
        ${questions.map(q => {
          const status = progress[q.id];
          let className = 'question-item';
          if (q.index === currentIndex) className += ' active';
          if (status) className += status.correct ? ' done' : ' wrong';
          return `<button class="${className}" data-index="${q.index}">${q.sequence}</button>`;
        }).join('')}
      </div>
    </div>
  `).join('');

  list.innerHTML = listHtml;

  // 手机端导航
  if (mobileNav) {
    const mobileHtml = currentQuestions.map((q, idx) => {
      const status = progress[q.id];
      let className = 'question-item';
      if (idx === currentIndex) className += ' active';
      if (status) className += status.correct ? ' done' : ' wrong';
      return `<button class="${className}" data-index="${idx}">${q.sequence}</button>`;
    }).join('');

    mobileNav.innerHTML = mobileHtml;
  }

  // 滚动到当前题目
  scrollToActiveQuestion();
}

/**
 * 滚动到当前题目（性能优化：使用 IntersectionObserver）
 */
function scrollToActiveQuestion() {
  const activeItem = document.querySelector('.question-item.active');
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * 初始化 IntersectionObserver（懒加载优化）
 */
function initIntersectionObserver() {
  // 可以在这里添加图片懒加载等优化
}

/**
 * 渲染当前题目
 */
function renderQuestion() {
  if (currentQuestions.length === 0) return;

  // 背题模式：整卷阅览
  if (practiceMode === 'memorize') {
    renderMemorizeView();
    return;
  }

  const question = currentQuestions[currentIndex];
  const container = $('#questionContainer');

  if (!container) return;

  const typeLabel = TYPE_LABELS[question.type] || question.type;

  let html = `
    <div class="question-header">
      <span class="question-number">第 ${question.sequence} 题</span>
      <span class="question-type">${typeLabel}</span>
      <span style="color:#999;font-size:13px;margin-left:auto;">
        ${currentIndex + 1} / ${currentQuestions.length}
      </span>
    </div>
    <div class="question-content">${question.content}</div>
  `;

  if (question.options && question.options.length > 0) {
    const inputType = question.type === 'multiple' ? 'checkbox' : 'radio';
    html += '<div class="options">';
    html += question.options.map((opt, index) => {
      // 清理选项内容，移除开头的字母前缀（如 "A. ", "B．" 等）
      const cleanContent = opt.content.replace(/^[A-Z][.．]\s*/, '');
      return `
      <label class="option" data-label="${opt.label}" data-index="${index}">
        <input type="${inputType}" name="answer" value="${opt.label}">
        <span class="option-content"><strong>${opt.label}.</strong> ${cleanContent}</span>
      </label>
    `;
    }).join('');
    html += '</div>';
  } else {
    // 材料题/主观题处理 - 直接显示答案
    const hasAnswer = question.answer && question.answer.trim().length > 0;
    const hasComments = question.comments && question.comments.trim().length > 0;
    html += `
      <div class="essay-answer">
        <h4 style="margin:0 0 12px 0;">${hasAnswer ? '参考答案' : '材料题/主观题'}</h4>
        ${hasAnswer ? `
          <div class="essay-answer-content" style="margin-bottom:16px;">${question.answer}</div>
        ` : `
          <div class="essay-answer-content" style="color:var(--text-tertiary);font-style:italic;margin-bottom:16px;">
            📝 此题为主观题，请根据材料内容进行思考和分析。<br>
            💡 建议从以下角度思考：<br>
            • 材料的核心观点是什么？<br>
            • 涉及的理论知识有哪些？<br>
            • 如何联系实际进行分析？
          </div>
        `}
        ${hasComments ? `
          <div style="border-top:1px solid var(--border-color);padding-top:12px;">
            <h5 style="margin:0 0 8px 0;color:var(--primary-dark);">评语</h5>
            <div style="color:var(--text-secondary);line-height:1.6;">${question.comments}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  container.innerHTML = html;

  // 检查是否已经做过这道题（错题重做模式下不恢复状态，允许重新做题）
  const questionProgress = progress[question.id];
  if (questionProgress && question.options && question.options.length > 0 && practiceMode !== 'wrong') {
    // 恢复之前的选择
    const userAnswer = questionProgress.userAnswer || '';
    if (userAnswer) {
      const inputs = container.querySelectorAll('input[name="answer"]');
      inputs.forEach(input => {
        if (userAnswer.includes(input.value)) {
          input.checked = true;
        }
      });
      answered = true;
      const correctAnswer = question.answer.replace(/\s+/g, '').split('').filter(c => /[A-Z]/.test(c)).sort().join('');
      showAnswerFeedback(questionProgress.correct, correctAnswer);

      // 更新提交按钮文本
      const submitBtn = $('#submitBtn');
      if (submitBtn) submitBtn.textContent = '下一题';
    }
  }

  // 绑定选项事件（使用事件委托）
  const optionsContainer = container.querySelector('.options');
  if (optionsContainer) {
    optionsContainer.addEventListener('click', handleOptionClick);
    optionsContainer.addEventListener('change', updateOptionStyles);
  }

  updateButtonStates();
}

/**
 * 渲染背题模式整卷视图
 */
function renderMemorizeView() {
  const container = $('#questionContainer');
  if (!container) return;

  // 不隐藏侧边栏，题目列表跟随页面滚动

  // 隐藏按钮组
  const btnGroup = $('.btn-group');
  if (btnGroup) btnGroup.style.display = 'none';

  // 获取正确答案的辅助函数
  const getCorrectAnswer = (question) => {
    return question.answer.replace(/\s+/g, '').split('').filter(c => /[A-Z]/.test(c)).sort().join('');
  };

  // 渲染所有题目
  let html = '<div style="padding:20px;background:linear-gradient(135deg,#667eea15,#764ba215);border-radius:12px;margin-bottom:20px;">';
  html += '<h2 style="margin:0 0 10px 0;color:#667eea;">📖 背题模式 - 整卷阅览</h2>';
  html += `<p style="margin:0;color:#666;">共 ${currentQuestions.length} 道题目 · 点击左侧题号可快速跳转</p>`;
  html += '</div>';

  currentQuestions.forEach((question, idx) => {
    const typeLabel = TYPE_LABELS[question.type] || question.type;
    const correctAnswer = getCorrectAnswer(question);

    html += `
      <div id="question-${question.sequence}" style="background:var(--bg-secondary);border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid var(--border-color);">
        <div class="question-header" style="margin-bottom:15px;">
          <span class="question-number">第 ${question.sequence} 题</span>
          <span class="question-type">${typeLabel}</span>
        </div>
        <div class="question-content" style="margin-bottom:15px;">${question.content}</div>
    `;

    // 渲染选项或主观题答案
    if (question.options && question.options.length > 0) {
      html += '<div class="options" style="margin-bottom:15px;">';
      question.options.forEach((opt) => {
        const isCorrect = correctAnswer.includes(opt.label);
        const cleanContent = opt.content.replace(/^[A-Z][.．]\s*/, '');
        html += `
          <div class="option" style="display:flex;align-items:flex-start;padding:10px;margin-bottom:8px;border-radius:8px;border:1.5px solid ${isCorrect ? '#4ade80' : 'var(--border-color)'};background:${isCorrect ? '#f0fdf4' : 'var(--bg-primary)'};pointer-events:none;cursor:default;">
            <span style="font-weight:600;color:${isCorrect ? '#16a34a' : 'var(--text-secondary)'};min-width:24px;">${opt.label}.</span>
            <span style="flex:1;color:var(--text-primary);">${cleanContent}</span>
            ${isCorrect ? '<span style="color:#16a34a;font-weight:bold;">✓</span>' : ''}
          </div>
        `;
      });
      html += '</div>';
    } else {
      // 材料题/论述题
      const hasAnswer = question.answer && question.answer.trim().length > 0;
      const hasComments = question.comments && question.comments.trim().length > 0;
      html += `
        <div style="background:#f0fdf4;border-radius:8px;padding:15px;border:1px solid #4ade80;">
          <h4 style="margin:0 0 10px 0;color:#16a34a;">${hasAnswer ? '✓ 参考答案' : '材料题/主观题'}</h4>
          ${hasAnswer ? `<div style="color:var(--text-primary);line-height:1.6;white-space:pre-wrap;">${question.answer}</div>` : `
            <div style="color:var(--text-tertiary);font-style:italic;">
              📝 此题为主观题，请根据材料内容进行思考和分析。
            </div>
          `}
          ${hasComments ? `
            <div style="border-top:1px solid #4ade80;margin-top:10px;padding-top:10px;">
              <h5 style="margin:0 0 8px 0;color:#16a34a;">评语</h5>
              <div style="color:var(--text-secondary);line-height:1.6;">${question.comments}</div>
            </div>
          ` : ''}
        </div>
      `;
    }

    html += '</div>';
  });

  container.innerHTML = html;
  updateButtonStates();
}

/**
 * 选项点击处理
 */
function handleOptionClick(e) {
  if (answered) return;

  // 背题模式下禁止点击
  if (practiceMode === 'memorize') return;

  const option = e.target.closest('.option');
  if (!option) return;

  const input = option.querySelector('input');
  if (!input) return;

  const question = currentQuestions[currentIndex];

  // 对于多选题，label 的原生行为会自动切换 checkbox 状态
  // 对于单选题，label 的原生行为会自动选中 radio
  // 我们只需要更新样式即可
  updateOptionStyles();
  vibrate(5); // 轻微触觉反馈
}

/**
 * 更新选项样式
 */
function updateOptionStyles() {
  document.querySelectorAll('.option').forEach(opt => {
    const input = opt.querySelector('input');
    opt.classList.toggle('selected', input && input.checked);
  });
}

/**
 * 背题模式：显示答案
 */
function showMemorizeAnswer(question) {
  // 获取正确答案
  const correctAnswer = question.answer.replace(/\s+/g, '').split('').filter(c => /[A-Z]/.test(c)).sort().join('');

  // 标记所有选项
  document.querySelectorAll('.option').forEach(opt => {
    const label = opt.dataset.label;

    // 标记正确答案
    if (correctAnswer.includes(label)) {
      opt.classList.add('correct');
    }

    // 禁用所有选项
    const input = opt.querySelector('input');
    if (input) {
      input.disabled = true;
    }
  });

  // 显示答案提示
  const feedback = $('#feedback');
  if (feedback) {
    feedback.className = 'feedback correct';
    feedback.innerHTML = `📖 <strong>正确答案：${correctAnswer}</strong>`;
    feedback.style.display = 'block';
  }

  // 隐藏提交按钮，显示"下一题"按钮
  const submitBtn = $('#submitBtn');
  if (submitBtn) {
    submitBtn.textContent = '下一题';
  }
  updateButtonStates();
}

// ============================================
// 答案处理
// ============================================

/**
 * 提交答案
 */
function submitAnswer() {
  if (answered) {
    nextQuestion();
    return;
  }

  // 背题模式：直接进入下一题
  if (practiceMode === 'memorize') {
    nextQuestion();
    return;
  }

  const question = currentQuestions[currentIndex];

  // 材料题直接显示答案
  if (!question.options || question.options.length === 0) {
    recordAnswer(question.id, true);
    sessionStats.done++;
    sessionStats.correct++;
    answered = true;
    updateStats();
    renderQuestionList();
    renderTypeNav();
    showFeedback(true, '✅ 已查看答案');
    vibrate([10, 50, 10]); // 成功振动模式
    return;
  }

  const inputs = document.querySelectorAll('input[name="answer"]:checked');
  if (inputs.length === 0) {
    showToast('请选择答案');
    vibrate(50); // 错误振动
    return;
  }

  const userAnswer = Array.from(inputs).map(i => i.value).sort().join('');
  const correctAnswer = question.answer.replace(/\s+/g, '').split('').filter(c => /[A-Z]/.test(c)).sort().join('');
  const isCorrect = userAnswer === correctAnswer;

  recordAnswer(question.id, isCorrect, userAnswer);
  sessionStats.done++;
  if (isCorrect) sessionStats.correct++;

  answered = true;
  showAnswerFeedback(isCorrect, correctAnswer);
  updateStats();
  renderQuestionList();
  renderTypeNav();

  // 触觉反馈
  vibrate(isCorrect ? [10, 50, 10] : [50, 30, 50, 30, 50]);

  // 答案正确时自动进入下一题
  if (isCorrect) {
    setTimeout(() => {
      nextQuestion();
    }, 500); // 0.5秒后自动进入下一题
  }
}

/**
 * 显示答案反馈
 */
function showAnswerFeedback(isCorrect, correctAnswer) {
  document.querySelectorAll('.option').forEach(opt => {
    const label = opt.dataset.label;
    const input = opt.querySelector('input');

    // 清除之前的状态
    opt.classList.remove('correct', 'wrong');

    // 标记正确答案
    if (correctAnswer.includes(label)) {
      opt.classList.add('correct');
    }

    // 标记用户选中的错误选项
    if (input && input.checked && !correctAnswer.includes(label)) {
      opt.classList.add('wrong');
    }
  });

  const feedback = $('#feedback');
  if (feedback) {
    feedback.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
    feedback.innerHTML = isCorrect
      ? '✅ 回答正确！'
      : `❌ 回答错误！<div class="answer-text">正确答案：<strong>${correctAnswer}</strong></div>`;
    feedback.style.display = 'block';
  }

  const submitBtn = $('#submitBtn');
  if (submitBtn) submitBtn.textContent = '下一题';

  // 更新按钮状态（隐藏原始的下一题按钮）
  updateButtonStates();
}

/**
 * 显示反馈
 */
function showFeedback(isCorrect, message) {
  const feedback = $('#feedback');
  if (feedback) {
    feedback.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
    feedback.innerHTML = message;
    feedback.style.display = 'block';
  }
}

/**
 * 隐藏反馈
 */
function hideFeedback() {
  const feedback = $('#feedback');
  if (feedback) {
    feedback.style.display = 'none';
  }

  const submitBtn = $('#submitBtn');
  if (submitBtn) {
    // 如果当前题目已经做过，保持"下一题"文本
    if (!answered) {
      submitBtn.textContent = '提交答案';
    }
  }

  // 从背题模式切换回其他模式时，恢复按钮组显示
  if (practiceMode !== 'memorize') {
    const btnGroup = $('.btn-group');
    if (btnGroup) btnGroup.style.display = '';
  }

  // 更新按钮状态（恢复原始的下一题按钮）
  updateButtonStates();
}

// ============================================
// 导航操作
// ============================================

/**
 * 上一题
 */
function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    answered = false;
    animateQuestionChange(() => {
      renderQuestion();
      updateActiveItem();
      hideFeedback();
    });
    vibrate(5);
  }
}

/**
 * 下一题
 */
function nextQuestion() {
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    answered = false;
    animateQuestionChange(() => {
      renderQuestion();
      updateActiveItem();
      hideFeedback();
    });
    vibrate(5);
  } else {
    showToast('已经是最后一题了');
  }
}

/**
 * 更新活动题目样式
 */
function updateActiveItem() {
  document.querySelectorAll('.question-item').forEach(item => {
    const idx = parseInt(item.dataset.index);
    item.classList.toggle('active', idx === currentIndex);
  });
  scrollToActiveQuestion();
}

/**
 * 更新按钮状态
 */
function updateButtonStates() {
  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  const submitBtn = $('#submitBtn');

  if (prevBtn) prevBtn.disabled = currentIndex === 0;
  if (nextBtn) {
    nextBtn.disabled = currentIndex >= currentQuestions.length - 1;
    // 如果已回答，隐藏原始的下一题按钮（因为提交按钮已变成下一题）
    nextBtn.style.display = answered ? 'none' : '';
  }
  // 更新提交按钮的可见性
  if (submitBtn) {
    submitBtn.style.display = answered && currentIndex >= currentQuestions.length - 1 ? 'none' : '';
  }
}

/**
 * 更新统计信息
 */
function updateStats() {
  const doneCount = $('#doneCount');
  const correctCount = $('#correctCount');
  const correctRate = $('#correctRate');

  if (doneCount) doneCount.textContent = sessionStats.done;
  if (correctCount) correctCount.textContent = sessionStats.correct;

  const rate = sessionStats.done > 0
    ? Math.round(sessionStats.correct / sessionStats.done * 100)
    : 0;
  if (correctRate) correctRate.textContent = rate + '%';
}

/**
 * 显示题目UI
 */
function showQuestionUI() {
  const btnGroup = $('.btn-group');
  if (btnGroup) btnGroup.style.display = 'flex';

  // 移除加载状态 - 使用新的 loadingOverlay
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.transition = 'opacity 0.3s';
    setTimeout(() => loadingOverlay.remove(), 300);
  }
}

/**
 * 显示提示
 */
function showToast(message) {
  const toast = $('#toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }
}

/**
 * 键盘处理
 */
function handleKeydown(e) {
  if (currentQuestions.length === 0) return;

  // 数字键选择选项
  if (e.key >= '1' && e.key <= '9' && !answered) {
    const index = parseInt(e.key) - 1;
    const options = document.querySelectorAll('.option input');
    if (options[index]) {
      const question = currentQuestions[currentIndex];
      if (question.type === 'multiple') {
        options[index].checked = !options[index].checked;
      } else {
        options[index].checked = true;
      }
      updateOptionStyles();
      vibrate(5);
    }
    return;
  }

  // Enter 提交
  if (e.key === 'Enter') {
    e.preventDefault();
    submitAnswer();
    return;
  }

  // 方向键切换题目
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevQuestion();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    nextQuestion();
  }
}

// ============================================
// 进度存储
// ============================================

/**
 * 加载进度
 */
function loadProgress() {
  try {
    const data = localStorage.getItem('quiz_progress');
    progress = data ? JSON.parse(data) : {};
  } catch (e) {
    progress = {};
  }
}

/**
 * 记录答案
 */
function recordAnswer(questionId, isCorrect, userAnswer = '') {
  progress[questionId] = {
    correct: isCorrect,
    userAnswer: userAnswer,
    time: Date.now()
  };

  try {
    localStorage.setItem('quiz_progress', JSON.stringify(progress));
  } catch (e) {
    // 存储失败时清理旧数据
    if (e.name === 'QuotaExceededError') {
      console.warn('存储空间不足，清理旧数据');
      const keys = Object.keys(progress);
      if (keys.length > 100) {
        // 只保留最近100条记录
        progress = {};
        localStorage.setItem('quiz_progress', JSON.stringify(progress));
      }
    }
  }
}

// ============================================
// 护眼模式
// ============================================

/**
 * 加载护眼模式状态
 */
function loadEyeCareMode() {
  try {
    const eyeCareEnabled = localStorage.getItem('quiz_eye_care');
    if (eyeCareEnabled === 'true') {
      document.body.classList.add('eye-care-mode');
      const btn = $('#eyeCareBtn');
      if (btn) btn.classList.add('active');
    }
  } catch (e) {
    console.warn('加载护眼模式失败:', e);
  }
}

/**
 * 切换护眼模式
 */
function toggleEyeCareMode() {
  const body = document.body;
  const btn = $('#eyeCareBtn');
  const isEnabled = body.classList.toggle('eye-care-mode');

  if (btn) {
    btn.classList.toggle('active', isEnabled);
  }

  try {
    localStorage.setItem('quiz_eye_care', isEnabled ? 'true' : 'false');
    showToast(isEnabled ? '👁️ 护眼模式已开启' : '👁️ 护眼模式已关闭');
    vibrate(10);
  } catch (e) {
    console.warn('保存护眼模式失败:', e);
  }
}

// ============================================
// 启动应用
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================
// 导出（用于调试）
// ============================================
if (typeof window !== 'undefined') {
  window.QuizApp = {
    state: {
      allQuestions,
      currentQuestions,
      currentIndex,
      sessionStats,
      progress,
      practiceMode
    },
    actions: {
      filterByType,
      setPracticeMode,
      resetProgress,
      prevQuestion,
      nextQuestion,
      submitAnswer
    }
  };
}
