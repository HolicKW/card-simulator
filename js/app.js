/**
 * app.js — 메인 대시보드 앱
 * 
 * UI 렌더링, 시뮬레이션 제어, 결과 시각화
 */

import { Simulator } from './simulator.js';
import { getAllCards, getAllPacks } from './cards.js';
import { PILOT_CARDS } from './performance.js';
import { performanceDetail, performanceReportHTML } from './performance-view.js';

const TIER_COLORS = {
  S: '#F04452', A: '#FF8A00', B: '#FFB800',
  C: '#03B26C', D: '#3182F6', F: '#8B95A1', '?': '#B0B8C1'
};

// 승률(%) → 막대 색: 55% 이상 초록, 45% 이하 빨강, 그 사이 회색
const rateColor = (pct) => (pct >= 55 ? '#03B26C' : pct <= 45 ? '#F04452' : '#B0B8C1');

// 카드 아트 썸네일 (scripts/export-card-art.ps1 로 생성). 이미지가 없으면 회색 자리만 남긴다
const cardArtHTML = (id, extraClass = '', lazy = true) => `
  <div class="card-art ${extraClass}">
    <img src="assets/cards/${id}.jpg" alt="" ${lazy ? 'loading="lazy" ' : ''}decoding="async" onerror="this.remove()">
  </div>`;

class App {
  constructor() {
    this.simulator = new Simulator();
    this.isRunning = false;
    this.results = null;
    this.init();
  }

  init() {
    // 팝오버에서 카드 효과 설명·키워드를 찾기 위한 원본 카드 정보
    this._cardInfo = new Map(getAllCards().map(c => [String(c.id), c]));
    this._renderUI();
    this._bindEvents();
    this._bindCardPopover();
    this._renderCardPool();
  }

  _renderUI() {
    // 이미 HTML에 구조가 있으므로, 동적 요소만 세팅
    const packsContainer = document.getElementById('pack-checkboxes');
    if (packsContainer) {
      const packs = getAllPacks();
      packsContainer.innerHTML = packs.map(p => `
        <label class="pack-checkbox">
          <input type="checkbox" value="${p.id}" checked>
          <span class="checkmark"></span>
          <span class="pack-name">${p.name}</span>
          <span class="pack-count">${p.totalCards}장</span>
        </label>
      `).join('');
    }
  }

  _bindEvents() {
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    const exportBtn = document.getElementById('btn-export');
    const importBtn = document.getElementById('btn-import');
    const importFile = document.getElementById('import-file');
    const tabBtns = document.querySelectorAll('.tab-btn');

    startBtn?.addEventListener('click', () => this._startSimulation());
    document.getElementById('btn-evaluate')?.addEventListener('click', () => this._startEvaluation());
    stopBtn?.addEventListener('click', () => this._stopSimulation());
    exportBtn?.addEventListener('click', () => this._exportData());
    importBtn?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', (e) => this._importData(e));

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${btn.dataset.tab}`)?.classList.add('active');
        // 학습 그래프 탭이 활성화될 때 지연 렌더링
        if (btn.dataset.tab === 'graph' && this._pendingGraphData) {
          requestAnimationFrame(() => this._renderLearningGraph(this._pendingGraphData));
        }
      });
    });
  }

  async _startSimulation() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._setBusy(true);

    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    const progressContainer = document.getElementById('progress-container');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startBtn.textContent = '시뮬레이션 중...';
    if (progressContainer) progressContainer.classList.add('active');

    // 이전 결과 UI 초기화
    const genResultsContainer = document.getElementById('gen-results');
    if (genResultsContainer) genResultsContainer.innerHTML = '';

    // 설정 수집
    const config = this.simulator.getDefaultConfig();
    config.gamesPerGeneration = parseInt(document.getElementById('games-per-gen')?.value) || 100;
    config.generations = parseInt(document.getElementById('generations')?.value) || 10;
    config.deckSize = parseInt(document.getElementById('deck-size')?.value) || 20;
    config.tierLimit = parseInt(document.getElementById('tier-limit')?.value) || 5;

    // 선택된 팩
    const checkboxes = document.querySelectorAll('#pack-checkboxes input:checked');
    config.packs = Array.from(checkboxes).map(cb => cb.value);
    if (!config.packs.includes('base')) config.packs.unshift('base');

    // 진행 콜백
    this.simulator.onProgress = (p) => {
      this._updateProgress(p);
    };

    this.simulator.onGenerationComplete = (genResult) => {
      this._renderGenerationResult(genResult);
    };

    try {
      const results = await this.simulator.runMirrorMode(config);
      this.results = results;
      this._renderFinalResults();
    } catch (e) {
      console.error('시뮬레이션 에러:', e);
      alert(e.message);
    }

    this.isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.textContent = '학습 대전 시작';
    this._setBusy(false);
    if (progressContainer) progressContainer.classList.remove('active');
  }

  _stopSimulation() {
    this.simulator.stop();
    document.getElementById('btn-stop').disabled = true;
  }

  _setBusy(busy) {
    for (const id of ['btn-start', 'btn-evaluate', 'btn-import', 'btn-export']) {
      document.getElementById(id).disabled = busy;
    }
    document.getElementById('btn-stop').disabled = !busy;
  }

  async _startEvaluation() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._setBusy(true);
    const progress = document.getElementById('progress-container');
    progress.classList.add('active');
    try {
      const tier = Number(document.getElementById('tier-limit').value);
      const packs = new Set(['base', ...Array.from(document.querySelectorAll('#pack-checkboxes input:checked')).map(input => input.value)]);
      const all = document.getElementById('evaluation-scope').value === 'all';
      const cardIds = getAllCards().filter(card => card.tier <= tier && packs.has(card.pack) && (all || PILOT_CARDS.includes(card.id))).map(card => card.id);
      await this.simulator.runPerformance({ cardIds,
        seeds: Number(document.getElementById('evaluation-seeds').value),
        seed: Number(document.getElementById('evaluation-seed').value),
        deckSize: Number(document.getElementById('deck-size').value)
      }, value => this._updateProgress(value));
      this._renderFinalResults();
      document.querySelector('[data-tab="performance"]').click();
    } catch (error) { console.error(error); alert(error.message); }
    finally {
      this.isRunning = false;
      this._setBusy(false);
      progress.classList.remove('active');
    }
  }

  _updateProgress(p) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const pct = Math.round((p.current / p.total) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressText) progressText.textContent = p.cardId
      ? `${this._cardInfo.get(p.cardId)?.name} · ${p.context === 'general' ? '일반 덱' : '팩 전용 덱'} · ${p.seeds}시드 · ${pct}%`
      : `세대 ${p.gen} | 게임 ${p.game} | ${pct}%`;
  }

  _renderGenerationResult(genResult) {
    const container = document.getElementById('gen-results');
    if (!container) return;

    const winRate = genResult.totalGames > 0
      ? Math.round((genResult.playerWins / genResult.totalGames) * 100) : 0;

    const el = document.createElement('div');
    el.className = 'gen-card';
    el.style.cursor = 'pointer';
    el.title = '클릭하면 해당 세대의 전투 로그를 볼 수 있습니다';
    el.innerHTML = `
      <div class="gen-header">
        <span class="gen-num">세대 ${genResult.generation}</span>
        <span class="gen-winrate ${winRate >= 50 ? 'positive' : 'negative'}">A측 ${winRate}% 승률</span>
      </div>
      <div class="gen-stats">
        <span>${genResult.totalGames}판</span>
        <span>승 ${genResult.playerWins}</span>
        <span>패 ${genResult.totalGames - genResult.playerWins - (genResult.draws || 0)}</span>
        <span>무 ${genResult.draws || 0}</span>
      </div>
    `;

    // 클릭 → 전투 로그 탭으로 이동 + 세대 필터
    el.addEventListener('click', () => {
      // 전투 로그 탭 활성화
      const battlelogBtn = document.querySelector('[data-tab="battlelog"]');
      if (battlelogBtn) battlelogBtn.click();

      // 아직 종료되지 않은 상태이므로 가장 최신 로그로 렌더링
      this._renderBattleLog(this.simulator.battleLog);

      // 세대 필터 적용
      setTimeout(() => {
        const genFilter = document.getElementById('battlelog-gen-filter');
        if (genFilter) {
          genFilter.value = String(genResult.generation);
          genFilter.dispatchEvent(new Event('change'));
        }
      }, 50);
    });

    container.prepend(el);
  }

  _renderFinalResults() {
    const analysis = this.simulator.getAnalysis();
    this._renderTierList(analysis.tierList);
    this._renderWarnings(analysis.warnings);
    this._renderPackStats(analysis.packStats);
    this._renderSynergyAnalysis(analysis.synergies, analysis.antiSynergies);
    this._renderCrossPackAnalysis(analysis.packCombos);
    this._renderTierHeatmap(analysis.tierHeatmap);
    document.getElementById('performance-results').innerHTML = performanceReportHTML(analysis.performanceReport);
    // 그래프 데이터를 저장 — 탭이 display:none이면 canvas 크기가 0이므로
    // 탭이 활성화될 때 렌더링하도록 지연
    this._pendingGraphData = analysis.history;
    const graphPanel = document.getElementById('panel-graph');
    if (graphPanel?.classList.contains('active')) {
      this._renderLearningGraph(analysis.history);
    }
    // 전투 로그 렌더링
    this._renderBattleLog(this.simulator.battleLog);
    // 시뮬 완료 후 자동으로 밸류 티어 리스트 탭으로 전환
    const tierBtn = document.querySelector('[data-tab="tierlist"]');
    if (tierBtn) tierBtn.click();
  }

  _renderTierList(tierList) {
    const container = document.getElementById('tier-list');
    if (!container) return;

    const tiers = { S: [], A: [], B: [], C: [], D: [], F: [], '?': [] };
    for (const card of tierList) {
      tiers[card.valueTier]?.push(card);
    }

    // 팝오버가 카드 id로 전체 통계를 찾도록 보관 (히트맵도 같이 사용)
    this._cardStats = new Map(tierList.map(c => [String(c.id), c]));

    container.innerHTML = Object.entries(tiers).map(([tier, cards]) => `
      <div class="tier-row">
        <div class="tier-label" style="--tier: ${TIER_COLORS[tier]}">${tier}</div>
        <div class="tier-cards">
          ${cards.map(c => `
            <div class="tier-card ${c.rarity}" data-card="${c.id}" tabindex="0">
              <span class="card-name">${c.name}</span>
              <span class="card-weight">T${c.tier} ${c.ratio == null ? '미평가' : `${Math.round(c.ratio * 100)}%`}</span>
              ${c.gradeSource === 'measured' ? '<span class="measured-badge">실측</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // ─── 카드 팝오버 (밸류 티어 칩 · 히트맵 셀 공용) ───
  _bindCardPopover() {
    const pop = document.createElement('div');
    pop.id = 'card-popover';
    pop.className = 'card-popover';
    pop.setAttribute('role', 'tooltip');
    document.body.appendChild(pop);

    let anchorEl = null;
    const show = (el) => {
      const card = this._cardStats?.get(el.dataset.card);
      if (!card || el === anchorEl) return;
      anchorEl?.removeAttribute('aria-describedby');
      anchorEl = el;
      pop.innerHTML = this._popoverHTML(card);
      el.setAttribute('aria-describedby', 'card-popover');
      this._positionPopover(pop, el);
      pop.classList.add('visible');
    };
    const hide = () => {
      anchorEl?.removeAttribute('aria-describedby');
      anchorEl = null;
      pop.classList.remove('visible');
    };
    const cardOf = (e) => e.target.closest?.('[data-card]');

    document.addEventListener('mouseover', (e) => { const el = cardOf(e); if (el) show(el); });
    document.addEventListener('mouseout', (e) => { const el = cardOf(e); if (el && !el.contains(e.relatedTarget)) hide(); });
    document.addEventListener('focusin', (e) => { const el = cardOf(e); if (el) show(el); });
    document.addEventListener('focusout', (e) => { if (cardOf(e)) hide(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, { passive: true });
  }

  _positionPopover(pop, el) {
    const GAP = 8;
    const MARGIN = 12;
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const fitsBelow = r.bottom + GAP + h <= window.innerHeight - MARGIN;
    const top = fitsBelow ? r.bottom + GAP : Math.max(MARGIN, r.top - GAP - h);
    const left = Math.min(Math.max(MARGIN, r.left + r.width / 2 - w / 2), window.innerWidth - w - MARGIN);
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  _popoverHTML(c) {
    const pct = (v) => (v != null ? `${v}%` : '–');
    const matches = Object.entries(c.byTierMatch || {}).sort(([a], [b]) => a.localeCompare(b));
    const stats = [
      ['카드 사용 전투', pct(c.playRate)],
      ['덱 승률', pct(c.deckWinRate)],
      ['게임당 사용', c.avgPlaysPerGame != null ? `${c.avgPlaysPerGame}회` : '–'],
      ['AI 선택 가중치', c.weight ?? '–'],
      ['덱 편입', `${c.deckInclusions || 0}회`],
      ['실사용', `${c.totalUses || 0}회`],
    ];
    const info = this._cardInfo.get(String(c.id));
    return `
      ${cardArtHTML(c.id, 'pop-art', false)}
      <div class="pop-head">
        <div>
          <strong class="pop-name">${c.name}</strong>
          <span class="pop-meta">${c.pack} · ${c.rarity} · 코스트 ${c.cost} · T${c.tier}</span>
        </div>
        <span class="pop-grade" style="--tier: ${TIER_COLORS[c.valueTier] || TIER_COLORS['?']}">${c.valueTier}</span>
      </div>
      ${info?.description ? `<p class="pop-desc">${info.description}</p>` : ''}
      ${info?.keywords?.length ? `<div class="pop-keywords">${info.keywords.map(k => `<span class="keyword-badge">${k}</span>`).join('')}</div>` : ''}
      <div class="pop-hero"><span>${c.gradeSource === 'measured' ? '실측 · 티어 중앙값 대비' : c.gradeSource === 'provisional' ? '잠정 · 학습 대전 기준' : '미평가'}</span><strong>${c.ratio == null ? '미평가' : `${Math.round(c.ratio * 100)}%`}</strong></div>
      <dl class="pop-stats">
        ${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
      </dl>
      ${performanceDetail(c.performance)}
      ${matches.length ? `
        <div class="pop-section">티어별 덱 승률</div>
        ${matches.map(([tm, d]) => `
          <div class="pop-bar-row">
            <span>${tm}</span>
            <span class="rate-bar"><span class="rate-fill" style="width:${d.winRate ?? 0}%;background:${rateColor(d.winRate)}"></span></span>
            <span>${pct(d.winRate)}<small>${d.inclusions}판</small></span>
          </div>`).join('')}` : ''}
    `;
  }

  _renderWarnings(warnings) {
    const container = document.getElementById('warnings');
    if (!container) return;

    if (warnings.length === 0) {
      container.innerHTML = '<div class="no-warnings">확인된 측정값에서 표시할 경고가 없습니다. 미평가 카드는 성능 측정에서 확인해 주세요.</div>';
      return;
    }

    container.innerHTML = warnings.map(w => `
      <div class="warning-item ${w.type}">
        <span class="warning-badge">${w.type}</span>
        <span class="warning-text">${w.message}</span>
      </div>
    `).join('');
  }

  _renderPackStats(packStats) {
    const container = document.getElementById('pack-stats');
    if (!container) return;

    const packs = getAllPacks();
    container.innerHTML = Object.entries(packStats).map(([packId, stats]) => {
      const pack = packs.find(p => p.id === packId);
      const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
      return `
        <div class="pack-stat-card">
          <div class="pack-stat-name">${pack?.name || packId}</div>
          <div class="pack-stat-bar">
            <div class="pack-stat-fill" style="width: ${winRate}%"></div>
          </div>
          <div class="pack-stat-info">
            <span>사용: ${stats.uses}회</span>
            <span>승률: ${winRate}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  _renderLearningGraph(history) {
    const canvas = document.getElementById('learning-canvas');
    if (!canvas) return;

    // 고해상도 화면에서도 선명하게 그리도록 devicePixelRatio 반영
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (history.length < 2) return;

    const winRates = history.map(h => h.totalGames > 0 ? h.playerWins / h.totalGames : 0.5);
    const pad = { top: 28, right: 20, bottom: 32, left: 44 };
    const xAt = i => pad.left + (i / (winRates.length - 1)) * (W - pad.left - pad.right);
    const yAt = v => pad.top + (1 - v) * (H - pad.top - pad.bottom);
    const font = '"Pretendard Variable", Pretendard, sans-serif';
    const css = getComputedStyle(document.documentElement);
    const color = (name) => css.getPropertyValue(name).trim();
    const tracePath = () => winRates.forEach((v, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(v)) : ctx.lineTo(xAt(i), yAt(v))));

    // 가로 눈금선 + Y축 라벨 (50%는 점선 기준선)
    ctx.font = `500 11px ${font}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.strokeStyle = v === 0.5 ? 'rgba(240, 68, 82, 0.4)' : color('--grey-100');
      ctx.setLineDash(v === 0.5 ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(pad.left, yAt(v));
      ctx.lineTo(W - pad.right, yAt(v));
      ctx.stroke();
      ctx.fillStyle = color('--grey-500');
      ctx.fillText(`${v * 100}%`, pad.left - 10, yAt(v));
    }
    ctx.setLineDash([]);

    // 라인 아래 그라데이션 영역
    const area = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    area.addColorStop(0, 'rgba(49, 130, 246, 0.18)');
    area.addColorStop(1, 'rgba(49, 130, 246, 0)');
    ctx.beginPath();
    tracePath();
    ctx.lineTo(xAt(winRates.length - 1), H - pad.bottom);
    ctx.lineTo(xAt(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    // 승률 라인
    ctx.strokeStyle = color('--blue');
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    tracePath();
    ctx.stroke();

    // 포인트 + 값/세대 라벨 (세대가 많으면 라벨은 최대 12개 정도만)
    const step = Math.ceil(winRates.length / 12);
    ctx.textAlign = 'center';
    winRates.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color('--surface');
      ctx.fill();
      ctx.stroke();

      if (i % step !== 0 && i !== winRates.length - 1) return;
      ctx.fillStyle = color('--grey-800');
      ctx.font = `700 12px ${font}`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.round(v * 100)}%`, x, y - 10);
      ctx.fillStyle = color('--grey-500');
      ctx.font = `500 11px ${font}`;
      ctx.textBaseline = 'top';
      ctx.fillText(`${history[i].generation ?? i + 1}세대`, x, H - pad.bottom + 10);
    });
  }

  // ─── 시너지 분석 탭 ───
  _renderSynergyAnalysis(synergies, antiSynergies) {
    const container = document.getElementById('synergy-analysis');
    if (!container) return;

    const renderTable = (data, title, colorClass) => {
      if (!data || data.length === 0) return `<p class="empty-hint">${title} 데이터가 부족합니다. 더 많은 세대를 돌려보세요.</p>`;
      return `
        <h3>${title}</h3>
        <table class="analysis-table">
          <thead><tr><th>카드 A</th><th>카드 B</th><th>승률</th><th>표본</th></tr></thead>
          <tbody>
            ${data.map(s => {
        const pct = Math.round(s.winRate * 100);
        return `<tr>
                <td>${s.nameA}</td>
                <td>${s.nameB}</td>
                <td><span class="rate-bar"><span class="rate-fill" style="width:${pct}%;background:${rateColor(pct)}"></span></span> ${pct}%</td>
                <td>${s.total}건</td>
              </tr>`;
      }).join('')}
          </tbody>
        </table>`;
    };

    container.innerHTML = `
      <div class="synergy-grid">
        <div class="synergy-section">
          ${renderTable(synergies, 'TOP 20 시너지 (함께 쓰면 강한 카드 조합)', 'good')}
        </div>
        <div class="synergy-section">
          ${renderTable(antiSynergies, 'BOTTOM 20 안티시너지 (함께 쓰면 약한 카드 조합)', 'bad')}
        </div>
      </div>`;
  }

  // ─── 팩 교차 분석 탭 ───
  _renderCrossPackAnalysis(packCombos) {
    const container = document.getElementById('crosspack-analysis');
    if (!container) return;

    if (!packCombos || packCombos.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>팩 교차 데이터가 없습니다.</p></div>';
      return;
    }

    container.innerHTML = `
      <table class="analysis-table">
        <thead><tr><th>팩 구성</th><th>승률</th><th>표본</th><th>승/패</th></tr></thead>
        <tbody>
          ${packCombos.map(p => {
      const pct = Math.round(p.winRate * 100);
      const packs = p.combo.split('+').map(pk => `<span class="pack-tag">${pk}</span>`).join(' + ');
      return `<tr>
              <td>${packs}</td>
              <td><span class="rate-bar"><span class="rate-fill" style="width:${pct}%;background:${rateColor(pct)}"></span></span> ${pct}%</td>
              <td>${p.total}건</td>
              <td>${p.wins}W / ${p.total - p.wins}L</td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>`;
  }

  // ─── 티어 히트맵 탭 ───
  _renderTierHeatmap(tierHeatmap) {
    const container = document.getElementById('tier-heatmap');
    if (!container) return;

    if (!tierHeatmap || Object.keys(tierHeatmap).length === 0) {
      container.innerHTML = '<div class="empty-state"><p>티어 데이터가 없습니다.</p></div>';
      return;
    }

    const getHeatColor = (ratio) => {
      if (ratio >= 1.5) return '#F04452';
      if (ratio >= 1.2) return '#FF8A00';
      if (ratio >= 0.9) return '#03B26C';
      if (ratio >= 0.65) return '#3182F6';
      if (ratio >= 0.45) return '#8B95A1';
      return '#B0B8C1';
    };

    let html = '';

    for (const tier of Object.keys(tierHeatmap).sort((a, b) => a - b)) {
      const cards = tierHeatmap[tier];
      html += `<div class="heatmap-tier">`;
      html += `<h4>Tier ${tier}</h4>`;
      html += `<div class="heatmap-grid">`;
      for (const card of cards) {
        const pct = card.ratio != null ? Math.round(card.ratio * 100) : '?';
        const bg = card.ratio != null && card.valueTier !== '?' ? getHeatColor(card.ratio) : '#D1D6DB';
        html += `<div class="heatmap-cell" style="--heat:${bg}" data-card="${card.id}" tabindex="0">`;
        html += `<span class="hm-name">${card.name}</span>`;
        html += `<span class="hm-grade">${card.valueTier}</span>`;
        html += `<span class="hm-pct">${card.ratio == null ? '미평가' : `${pct}%`}</span>`;
        html += `</div>`;
      }
      html += `</div></div>`;
    }

    container.innerHTML = html;
  }

  _renderCardPool() {
    const container = document.getElementById('card-pool');
    if (!container) return;

    const cards = getAllCards();
    const grouped = {};
    for (const card of cards) {
      if (!grouped[card.pack]) grouped[card.pack] = [];
      grouped[card.pack].push(card);
    }

    container.innerHTML = Object.entries(grouped).map(([pack, cards]) => `
      <div class="card-pool-group">
        <h3 class="pool-pack-name">${pack}</h3>
        <div class="pool-cards">
          ${cards.map(c => `
            <div class="pool-card ${c.rarity} type-${c.type}">
              ${cardArtHTML(c.id, 'pool-art')}
              <div class="pool-card-header">
                <span class="pool-card-cost">${c.cost}</span>
                <span class="pool-card-name">${c.name}</span>
                <span class="pool-card-type">${c.type}</span>
              </div>
              <div class="pool-card-desc">${c.description}</div>
              <div class="pool-card-meta">
                <span class="rarity-badge ${c.rarity}">${c.rarity}</span>
                <span class="tier-badge">T${c.tier}</span>
                ${c.keywords.length ? `<span class="keyword-badge">${c.keywords.join(', ')}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  _renderBattleLog(battleLog) {
    const container = document.getElementById('battle-log');
    if (!container) return;

    if (!battleLog || battleLog.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>전투 기록이 없습니다.</p></div>';
      return;
    }

    // 세대별 필터
    const gens = [...new Set(battleLog.map(b => b.gen))].sort((a, b) => a - b);

    container.innerHTML = `
      <div class="battlelog-controls">
        <label>세대 필터:</label>
        <select id="battlelog-gen-filter">
          <option value="all">전체 (${battleLog.length}건)</option>
          ${gens.map(g => `<option value="${g}">세대 ${g}</option>`).join('')}
        </select>
        <label>결과:</label>
        <select id="battlelog-result-filter">
          <option value="all">전체</option>
          <option value="win">A 승리</option>
          <option value="lose">B 승리</option>
          <option value="draw">미결정</option>
        </select>
      </div>
      <div id="battlelog-list"></div>
    `;

    const genFilter = document.getElementById('battlelog-gen-filter');
    const resultFilter = document.getElementById('battlelog-result-filter');
    const renderList = () => {
      const gf = genFilter.value;
      const rf = resultFilter.value;
      let filtered = battleLog;
      if (gf !== 'all') filtered = filtered.filter(b => b.gen === parseInt(gf));
      if (rf === 'win') filtered = filtered.filter(b => b.winner === 'A');
      if (rf === 'lose') filtered = filtered.filter(b => b.winner === 'B');
      if (rf === 'draw') filtered = filtered.filter(b => b.winner === 'draw');

      const listEl = document.getElementById('battlelog-list');
      listEl.innerHTML = filtered.map((b, i) => {
        return this._renderMirrorEntry(b, i);
      }).join('');
    };

    genFilter.addEventListener('change', renderList);
    resultFilter.addEventListener('change', renderList);
    renderList();
  }

  _renderMirrorEntry(b, i) {
    return `
      <div class="battle-entry mirror ${b.winner === 'A' ? 'win' : b.winner === 'B' ? 'lose' : 'draw'}" data-idx="${i}">
        <div class="battle-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="battle-id">G${b.gen}-#${b.game}</span>
          <span class="battle-result ${b.winner === 'A' ? 'win' : b.winner === 'B' ? 'lose' : 'draw'}">
            ${b.winner === 'A' ? 'A 승리' : b.winner === 'B' ? 'B 승리' : '턴 제한 · 미결정'}
          </span>
          <span class="battle-enemy">${b.tierMatch}</span>
          <span class="battle-turns">${b.turns || '?'}턴</span>
          <span class="battle-deck-size">A:${b.playerAHp}hp B:${b.playerBHp}hp</span>
          <span class="battle-expand">▼</span>
        </div>
        <div class="battle-detail">
          <div class="mirror-decks">
            <div class="mirror-side side-a">
              <h4>AI A 덱 (${b.deckA.length}장)${b.winner === 'A' ? ' · 승리' : ''}</h4>
              <div class="battle-deck-cards">
                ${b.deckA.sort((a, c) => a.cost - c.cost).map(c => `
                  <span class="bdeck-card ${c.rarity}" title="${c.name}\nT${c.tier} ${c.rarity}">
                    <span class="bdeck-cost">${c.cost}</span>${c.name}
                  </span>
                `).join('')}
              </div>
              <div class="battle-deck-breakdown">${this._deckBreakdown(b.deckA)}</div>
              ${this._renderDetailedUsageLog(b.cardsUsedA, 'A')}
            </div>
            <div class="mirror-side side-b">
              <h4>AI B 덱 (${b.deckB.length}장)${b.winner === 'B' ? ' · 승리' : ''}</h4>
              <div class="battle-deck-cards">
                ${b.deckB.sort((a, c) => a.cost - c.cost).map(c => `
                  <span class="bdeck-card ${c.rarity}" title="${c.name}\nT${c.tier} ${c.rarity}">
                    <span class="bdeck-cost">${c.cost}</span>${c.name}
                  </span>
                `).join('')}
              </div>
              <div class="battle-deck-breakdown">${this._deckBreakdown(b.deckB)}</div>
              ${this._renderDetailedUsageLog(b.cardsUsedB, 'B')}
            </div>
          </div>
          ${(b.turnLog || []).length > 0 ? `
            <div class="turn-log-section">
              <h4>턴별 전투 로그</h4>
              <div class="turn-log-list">
                ${b.turnLog.map(t => `
                  <div class="turn-entry">
                    <div class="turn-header">턴 ${t.turn} — A: ${t.hpAfter?.A?.hp || '?'}hp · 방어 ${t.hpAfter?.A?.shield || 0} | B: ${t.hpAfter?.B?.hp || '?'}hp · 방어 ${t.hpAfter?.B?.shield || 0}</div>
                    <div class="turn-actions">
                      ${t.actions.map(a => `
                        <span class="turn-action ${a.side === 'A' ? 'side-a' : 'side-b'}">
                          ${a.side} ${a.cardName}
                          ${a.damageDone > 0 ? `<span class="dmg">-${a.damageDone}</span>` : ''}
                          ${a.selfHpChange < 0 ? `<span class="self-dmg">${a.selfHpChange}</span>` : ''}
                          ${a.selfHpChange > 0 ? `<span class="heal">+${a.selfHpChange}</span>` : ''}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>`;
  }

  _renderDetailedUsageLog(logs, prefix = '') {
    if (!logs || logs.length === 0) return '';
    let html = `<div class="battle-used-section"><h4>${prefix ? prefix + ' ' : ''}상세 액션 로그</h4><div class="detailed-log-list">`;
    for (const log of logs) {
      if (!log) continue;
      if (typeof log === 'string') {
        html += `<span class="used-card">${log}</span>`;
      } else if (log.type === 'phase') {
        html += `<div class="log-phase">${log.name}</div>`;
      } else if (log.type === 'info') {
        html += `<div class="log-info">${log.msg}</div>`;
      } else if (log.type === 'mulligan') {
        html += `<div class="log-mulligan">멀리건 | 버림: ${log.discarded?.join(', ') || ''} → 뽑음: ${log.drawn?.join(', ') || ''}</div>`;
      } else if (log.type === 'draw') {
        html += `<div class="log-draw">드로우 (${log.source}): ${log.cards?.join(', ') || ''}</div>`;
      } else if (log.type === 'status') {
        html += `<div class="log-status">${log.effect}</div>`;
      } else if (log.type === 'effect') {
        html += `<div class="log-effect">[${log.source}] ${log.effect}</div>`;
      } else if (log.type === 'dismantle') {
        html += `<div class="log-dismantle">해체 (${log.source}): ${log.cardName} (${log.dismantleType})</div>`;
      } else if (log.type === 'extract') {
        html += `<div class="log-extract">추출 효과 발동: ${log.cardName}</div>`;
      } else if (log.cardName || log.type === undefined) {
        // 일반 카드 플레이 로그
        html += `<div class="log-play-card">▶ 플레이: <b>${log.cardName || '알 수 없는 카드'}</b> (T${log.turn || '?'} | 적 HP: ${log.enemyHpAfter || '?'})</div>`;
      }
    }
    html += `</div></div>`;
    return html;
  }

  _deckBreakdown(deck) {
    const byPack = {};
    const byType = {};
    const byRarity = {};
    for (const c of deck) {
      byPack[c.pack] = (byPack[c.pack] || 0) + 1;
      byType[c.type] = (byType[c.type] || 0) + 1;
      byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1;
    }

    return `
      <div class="breakdown-row">
        <span class="breakdown-label">팩:</span>
        ${Object.entries(byPack).map(([k, v]) => `<span class="breakdown-tag">${k} ${v}</span>`).join('')}
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">타입:</span>
        ${Object.entries(byType).map(([k, v]) => `<span class="breakdown-tag">${k} ${v}</span>`).join('')}
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">희귀도:</span>
        ${Object.entries(byRarity).map(([k, v]) => `<span class="breakdown-tag rarity-badge ${k}">${k} ${v}</span>`).join('')}
      </div>
    `;
  }

  _exportData() {
    const data = this.simulator.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card-balance-gen${data.generation}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Let the browser begin reading the blob before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  _importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        this.simulator.importData(data);
        alert(data.kind === 'performance-report' ? '성능 측정값을 불러왔습니다.' : `세대 ${data.generation}의 선택 가중치와 성능 측정값을 불러왔습니다.`);
        // 바로 결과 렌더링
        this._renderFinalResults();
      } catch (err) {
        alert(err.message || '파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  }
}

// 앱 시작
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
