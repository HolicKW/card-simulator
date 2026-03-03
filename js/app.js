/**
 * app.js — 메인 대시보드 앱
 * 
 * UI 렌더링, 시뮬레이션 제어, 결과 시각화
 */

import { Simulator } from './simulator.js';
import { getAllCards, getAllPacks } from './cards.js';

class App {
  constructor() {
    this.simulator = new Simulator();
    this.isRunning = false;
    this.results = null;
    this.init();
  }

  init() {
    this._renderUI();
    this._bindEvents();
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

    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    const progressContainer = document.getElementById('progress-container');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startBtn.textContent = '⏳ 시뮬레이션 중...';
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
    }

    this.isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.textContent = '▶ 시뮬레이션 시작';
    if (progressContainer) progressContainer.classList.remove('active');
  }

  _stopSimulation() {
    this.simulator.stop();
    this.isRunning = false;
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.textContent = '▶ 시뮬레이션 시작';
  }

  _updateProgress(p) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const pct = Math.round((p.current / p.total) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressText) progressText.textContent = `세대 ${p.gen} | 게임 ${p.game} | ${pct}%`;
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
        <span class="gen-winrate ${winRate >= 50 ? 'positive' : 'negative'}">${winRate}% 승률</span>
      </div>
      <div class="gen-stats">
        <span>${genResult.totalGames}판</span>
        <span>승 ${genResult.playerWins}</span>
        <span>패 ${genResult.totalGames - genResult.playerWins}</span>
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

    const tierColors = {
      S: '#ff4757', A: '#ff6b35', B: '#ffa502',
      C: '#2ed573', D: '#1e90ff', F: '#747d8c', '?': '#4a5568'
    };

    container.innerHTML = Object.entries(tiers).map(([tier, cards]) => `
      <div class="tier-row">
        <div class="tier-label" style="background: ${tierColors[tier]}">${tier}</div>
        <div class="tier-cards">
          ${cards.map(c => `
            <div class="tier-card ${c.rarity}" title="${c.name}\n팩: ${c.pack}\n희귀도: ${c.rarity}\n코스트: ${c.cost}\n티어: T${c.tier}\nBaseline 비율: ${Math.round((c.ratio || 0) * 100)}%\n가중치: ${c.weight}\n사용: ${c.totalUses || 0}회\n승률: ${c.winRate != null ? c.winRate + '%' : 'N/A'}">
              <span class="card-name">${c.name}</span>
              <span class="card-weight">T${c.tier} ${Math.round((c.ratio || 0) * 100)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  _renderWarnings(warnings) {
    const container = document.getElementById('warnings');
    if (!container) return;

    if (warnings.length === 0) {
      container.innerHTML = '<div class="no-warnings">⚖️ 심각한 밸런스 문제가 감지되지 않았습니다.</div>';
      return;
    }

    container.innerHTML = warnings.map(w => `
      <div class="warning-item ${w.type}">
        <span class="warning-badge">${w.type === 'OP' ? '⚠️ OP' : '⬇️ UP'}</span>
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
      const winRate = stats.uses > 0 ? Math.round((stats.wins / stats.uses) * 100) : 0;
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

    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 300;

    ctx.clearRect(0, 0, W, H);

    if (history.length < 2) return;

    // 세대별 승률 그래프
    const winRates = history.map(h => h.totalGames > 0 ? h.playerWins / h.totalGames : 0.5);
    const maxVal = 1;
    const minVal = 0;

    // 배경 그리드
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = H - (i / 10) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // 50% 기준선
    ctx.strokeStyle = 'rgba(255, 71, 87, 0.5)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 승률 라인
    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, '#00d2ff');
    gradient.addColorStop(1, '#3a7bd5');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < winRates.length; i++) {
      const x = (i / (winRates.length - 1)) * (W - 40) + 20;
      const y = H - ((winRates[i] - minVal) / (maxVal - minVal)) * (H - 40) - 20;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 데이터 포인트
    for (let i = 0; i < winRates.length; i++) {
      const x = (i / (winRates.length - 1)) * (W - 40) + 20;
      const y = H - ((winRates[i] - minVal) / (maxVal - minVal)) * (H - 40) - 20;

      ctx.fillStyle = '#00d2ff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // 라벨
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(winRates[i] * 100)}%`, x, y - 12);
    }

    // 축 라벨
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('세대 →', W - 60, H - 5);
    ctx.save();
    ctx.translate(12, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('승률', 0, 0);
    ctx.restore();
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
        const barColor = pct >= 55 ? '#00e676' : pct <= 45 ? '#ff5252' : '#aaa';
        return `<tr>
                <td>${s.nameA}</td>
                <td>${s.nameB}</td>
                <td><span class="rate-bar"><span class="rate-fill" style="width:${pct}%;background:${barColor}"></span></span> ${pct}%</td>
                <td>${s.total}건</td>
              </tr>`;
      }).join('')}
          </tbody>
        </table>`;
    };

    container.innerHTML = `
      <div class="synergy-grid">
        <div class="synergy-section">
          ${renderTable(synergies, '🟢 TOP 20 시너지 (함께 쓰면 강한 카드 조합)', 'good')}
        </div>
        <div class="synergy-section">
          ${renderTable(antiSynergies, '🔴 BOTTOM 20 안티시너지 (함께 쓰면 약한 카드 조합)', 'bad')}
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
      <h3>🔀 팩 구성별 승률</h3>
      <p class="section-desc">덱에 포함된 팩 조합별로 승률을 분석합니다. 혼합 덱이 순수 덱보다 압도적으로 강하면 팩 정체성 붕괴 징후입니다.</p>
      <table class="analysis-table">
        <thead><tr><th>팩 구성</th><th>승률</th><th>표본</th><th>승/패</th></tr></thead>
        <tbody>
          ${packCombos.map(p => {
      const pct = Math.round(p.winRate * 100);
      const packs = p.combo.split('+').map(pk => `<span class="pack-tag">${pk}</span>`).join(' + ');
      const barColor = pct >= 55 ? '#00e676' : pct <= 45 ? '#ff5252' : '#78909c';
      return `<tr>
              <td>${packs}</td>
              <td><span class="rate-bar"><span class="rate-fill" style="width:${pct}%;background:${barColor}"></span></span> ${pct}%</td>
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
      if (ratio >= 1.5) return '#ff1744';
      if (ratio >= 1.2) return '#ff9100';
      if (ratio >= 0.9) return '#00e676';
      if (ratio >= 0.65) return '#448aff';
      if (ratio >= 0.45) return '#78909c';
      return '#37474f';
    };

    let html = '<h3>🗺️ 티어별 카드 밸류 히트맵</h3>';
    html += '<p class="section-desc">각 티어 내에서 Baseline 대비 카드 밸류를 색상으로 시각화합니다. 빨간색=OP, 초록=적정, 회색=UP</p>';

    for (const tier of Object.keys(tierHeatmap).sort((a, b) => a - b)) {
      const cards = tierHeatmap[tier];
      html += `<div class="heatmap-tier">`;
      html += `<h4>Tier ${tier}</h4>`;
      html += `<div class="heatmap-grid">`;
      for (const card of cards) {
        const pct = card.ratio != null ? Math.round(card.ratio * 100) : '?';
        const bg = card.ratio != null ? getHeatColor(card.ratio) : '#263238';
        html += `<div class="heatmap-cell" style="background:${bg}" title="${card.name} (${card.pack}/${card.rarity})\nBaseline대비: ${pct}%\n사용: ${card.totalUses}회">`;
        html += `<span class="hm-name">${card.name}</span>`;
        html += `<span class="hm-grade">${card.valueTier}</span>`;
        html += `<span class="hm-pct">${pct}%</span>`;
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
            <div class="pool-card ${c.rarity}">
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
      container.innerHTML = '<div class="empty-state"><div class="icon">⚔️</div><p>전투 기록이 없습니다.</p></div>';
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
      if (rf === 'win') filtered = filtered.filter(b => b.winner === 'player' || b.winner === 'A');
      if (rf === 'lose') filtered = filtered.filter(b => b.winner !== 'player' && b.winner !== 'A');

      const listEl = document.getElementById('battlelog-list');
      listEl.innerHTML = filtered.map((b, i) => {
        const isMirror = b.mode === 'mirror';
        const isWin = b.winner === 'player' || b.winner === 'A';

        if (isMirror) {
          return this._renderMirrorEntry(b, i);
        } else {
          return this._renderPveEntry(b, i);
        }
      }).join('');
    };

    genFilter.addEventListener('change', renderList);
    resultFilter.addEventListener('change', renderList);
    renderList();
  }

  _renderPveEntry(b, i) {
    const isWin = b.winner === 'player';
    return `
      <div class="battle-entry ${isWin ? 'win' : 'lose'}" data-idx="${i}">
        <div class="battle-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="battle-id">G${b.gen}-#${b.game}</span>
          <span class="battle-result ${isWin ? 'win' : 'lose'}">${isWin ? '✅ 승리' : '❌ 패배'}</span>
          <span class="battle-enemy">${b.enemy}</span>
          <span class="battle-turns">${b.turns || '?'}턴</span>
          <span class="battle-deck-size">덱 ${b.deck?.length || '?'}장</span>
          <span class="battle-expand">▼</span>
        </div>
        <div class="battle-detail">
          <div class="battle-deck-section">
            <h4>🃏 덱 구성 (${b.deck?.length || '?'}장)</h4>
            <div class="battle-deck-cards">
              ${(b.deck || []).sort((a, c) => a.cost - c.cost).map(c => `
                <span class="bdeck-card ${c.rarity}" title="${c.name}\n코스트: ${c.cost}\n타입: ${c.type}\n팩: ${c.pack}\nT${c.tier}">
                  <span class="bdeck-cost">${c.cost}</span>${c.name}
                </span>
              `).join('')}
            </div>
            <div class="battle-deck-breakdown">${this._deckBreakdown(b.deck || [])}</div>
          </div>
          ${(b.cardsUsed || []).length > 0 ? `
            <div class="battle-used-section">
              <h4>📋 실제 사용 카드 (${b.cardsUsed.length}회)</h4>
              <div class="battle-used-list">${[...new Set(b.cardsUsed)].map(name => {
      const count = b.cardsUsed.filter(n => n === name).length;
      return `<span class="used-card">${name}${count > 1 ? ` ×${count}` : ''}</span>`;
    }).join('')}</div>
            </div>
          ` : ''}
        </div>
      </div>`;
  }

  _renderMirrorEntry(b, i) {
    return `
      <div class="battle-entry mirror ${b.winner === 'A' ? 'win' : 'lose'}" data-idx="${i}">
        <div class="battle-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="battle-id">G${b.gen}-#${b.game}</span>
          <span class="battle-result ${b.winner === 'A' ? 'win' : 'lose'}">
            ${b.winner === 'A' ? '🔵 A 승리' : '🔴 B 승리'}
          </span>
          <span class="battle-enemy">${b.tierMatch}</span>
          <span class="battle-turns">${b.turns || '?'}턴</span>
          <span class="battle-deck-size">A:${b.playerAHp}hp B:${b.playerBHp}hp</span>
          <span class="battle-expand">▼</span>
        </div>
        <div class="battle-detail">
          <div class="mirror-decks">
            <div class="mirror-side side-a">
              <h4>🔵 AI A 덱 (${b.deckA.length}장) ${b.winner === 'A' ? '👑' : ''}</h4>
              <div class="battle-deck-cards">
                ${b.deckA.sort((a, c) => a.cost - c.cost).map(c => `
                  <span class="bdeck-card ${c.rarity}" title="${c.name}\nT${c.tier} ${c.rarity}">
                    <span class="bdeck-cost">${c.cost}</span>${c.name}
                  </span>
                `).join('')}
              </div>
              <div class="battle-deck-breakdown">${this._deckBreakdown(b.deckA)}</div>
              ${(b.cardsUsedA || []).length > 0 ? `
                <div class="battle-used-section">
                  <h4>📋 A 사용 카드 (${b.cardsUsedA.length}회)</h4>
                  <div class="battle-used-list">${[...new Set(b.cardsUsedA)].map(name => {
      const count = b.cardsUsedA.filter(n => n === name).length;
      return `<span class="used-card">${name}${count > 1 ? ` ×${count}` : ''}</span>`;
    }).join('')}</div>
                </div>
              ` : ''}
            </div>
            <div class="mirror-side side-b">
              <h4>🔴 AI B 덱 (${b.deckB.length}장) ${b.winner === 'B' ? '👑' : ''}</h4>
              <div class="battle-deck-cards">
                ${b.deckB.sort((a, c) => a.cost - c.cost).map(c => `
                  <span class="bdeck-card ${c.rarity}" title="${c.name}\nT${c.tier} ${c.rarity}">
                    <span class="bdeck-cost">${c.cost}</span>${c.name}
                  </span>
                `).join('')}
              </div>
              <div class="battle-deck-breakdown">${this._deckBreakdown(b.deckB)}</div>
              ${(b.cardsUsedB || []).length > 0 ? `
                <div class="battle-used-section">
                  <h4>📋 B 사용 카드 (${b.cardsUsedB.length}회)</h4>
                  <div class="battle-used-list">${[...new Set(b.cardsUsedB)].map(name => {
      const count = b.cardsUsedB.filter(n => n === name).length;
      return `<span class="used-card">${name}${count > 1 ? ` ×${count}` : ''}</span>`;
    }).join('')}</div>
                </div>
              ` : ''}
            </div>
          </div>
          ${(b.turnLog || []).length > 0 ? `
            <div class="turn-log-section">
              <h4>📜 턴별 전투 로그</h4>
              <div class="turn-log-list">
                ${b.turnLog.map(t => `
                  <div class="turn-entry">
                    <div class="turn-header">턴 ${t.turn} — A: ${t.hpAfter?.A?.hp || '?'}hp(🛡${t.hpAfter?.A?.shield || 0}) | B: ${t.hpAfter?.B?.hp || '?'}hp(🛡${t.hpAfter?.B?.shield || 0})</div>
                    <div class="turn-actions">
                      ${t.actions.map(a => `
                        <span class="turn-action ${a.side === 'A' ? 'side-a' : 'side-b'}">
                          ${a.side === 'A' ? '🔵' : '🔴'} ${a.cardName}
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
    const data = this.simulator.ai.exportWeights();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card-balance-gen${data.generation}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        this.simulator.ai.importWeights(data);
        alert(`세대 ${data.generation}의 학습 데이터를 불러왔습니다.`);
        // 바로 결과 렌더링
        this._renderFinalResults();
      } catch (err) {
        alert('파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  }
}

// 앱 시작
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
