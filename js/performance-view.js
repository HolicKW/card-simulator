import { getCardById } from './cards.js';
import { rankTiers } from './performance.js';

const num = value => Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '–';
const signed = value => Number.isFinite(value) ? `${value > 0 ? '+' : ''}${num(value)}` : '–';
// 빈 슬롯 대비 승점 변화 (등급 계산과 같은 값)
const delta = result => result ? `${signed(result.benefit.mean * 100)}%p` : '측정 안 함';
const range = result => result?.benefit.low != null ? `${signed(result.benefit.low * 100)} ~ ${signed(result.benefit.high * 100)}%p` : result ? '표본 부족' : '–';
const names = { basic: '기본', developed: '중간 준비', prepared: '조건 준비 예시' };

export function performanceDetail(performance) {
    if (!performance) return '<p class="config-hint">성능 미측정 · AI 선택 가중치는 실측 성능이 아닙니다.</p>';
    return `<div class="performance-detail">
      <div class="pop-section">조건별 1회 사용 효과</div>
      ${Object.entries(performance.probes).map(([scenario, probe]) => {
        const value = probe.immediate;
        return `<p><strong>${names[scenario]}</strong> · ${probe.playableRate ? `비용 ${num(probe.effectiveCost)} · 피해 ${num(value.damageHp + value.damageShield)} · 실드 생성 ${num(value.shieldGenerated)} · 회복 ${num(value.healing)} · 드로우 ${num(value.drawn)} · 순에너지 ${signed(value.energyChange)} · 힘 ${signed(value.strengthChange)} · 적 바이러스 ${signed(value.virusChange)} · 자해 HP ${num(value.selfDamageHp)} · 자멸 ${num(probe.selfDefeatRate * 100)}%` : '사용 불가'}</p>`;
      }).join('')}
      ${['general', 'dedicated'].map(context => {
        const result = performance[context], label = context === 'general' ? '일반 덱' : '팩 전용 덱';
        if (!result) return `<p><strong>${label}</strong> · 측정 안 함</p>`;
        return `<p><strong>${label}</strong> · 빈 슬롯 대비 ${delta(result)}${result.calibrated ? '' : ' (표본 부족)'}<br>
          95% 구간 ${range(result)} · ${result.seeds}개 독립 시드<br>
          카드 사용 전투 ${num(result.playedRate * 100)}% · 무승부 ${num(result.drawRate * 100)}%</p>`;
      }).join('')}
      <p class="config-hint">조건별 효과는 정해진 상태에서 측정한 값이며, 그 조건의 실전 달성 확률은 아닙니다.</p>
    </div>`;
}

export function performanceReportHTML(report) {
    if (!report) return '<div class="empty-state"><p>성능 측정 결과가 없습니다.</p></div>';
    const measured = Object.keys(report.cards).length, ranks = rankTiers(report.cards);
    const top = share => `상위 ${Math.round(share * 100)}%`;
    const targets = Object.entries(report.tierTargets).map(([tier, value]) => `T${tier} ${signed(value * 100)}%p`).join(' · ');
    return `<p>${report.status === 'complete' ? '측정 완료' : '중지된 부분 결과'} · ${measured}/${report.config.cardIds.length}장 · 덱 ${report.config.deckSize}장 · 시작 시드 ${report.config.seed}</p>
      <p class="config-hint">티어 내 순위 = 같은 티어에서 200 시드 이상 측정된 카드(10장 이상) 중 빈 슬롯 대비 승점 변화 순위예요. 상위 10% S · 20% A · 40% B · 20% C · 10% D이고, 빈 슬롯보다 확실히 나쁘면 F예요. 순위 범위는 승점이 95% 구간 양 끝일 때의 순위예요.</p>
      <p class="config-hint">참고 · 티어 중앙값: ${targets || '아직 없음'}. 승리 1·무승부 0.5·패배 0으로 계산해요.</p>
      <div class="performance-scroll"><table class="performance-table"><thead><tr>
      <th>카드</th><th>기본 1회 효과</th><th>조건별 변화</th><th>일반 덱 · 빈 슬롯 대비</th><th>팩 전용 덱 · 빈 슬롯 대비</th><th>티어 내 순위</th>
      </tr></thead><tbody>${Object.entries(report.cards).map(([id, result]) => {
        const card = getCardById(id), basic = result.probes.basic, prepared = result.probes.prepared;
        const value = basic.immediate;
        const units = `공격 ${num(basic.attackUnits)} · 방어 ${num(basic.defenseUnits)}`;
        const later = prepared.checkpoints.find(point => point.turn === 3);
        const rank = ranks[id];
        return `<tr data-card="${id}" tabindex="0"><th>${card.name}<small>T${card.tier} · ${card.pack}</small></th>
          <td>${basic.playableRate ? `비용 ${num(basic.effectiveCost)}<br>${units}<br>회복 ${num(value.healing)} · 드로우 ${num(value.drawn)}` : '사용 불가'}</td>
          <td>${prepared.playableRate ? `준비 후 공격 ${num(prepared.attackUnits)} · 방어 ${num(prepared.defenseUnits)}<br>원본 카드 총사용 ${num(prepared.uses)}회` : '준비 후에도 사용 불가'}
          ${later?.metrics ? `<small>3턴 대조 차이: 피해 ${signed(later.metrics.damageHp + later.metrics.damageShield)}, 실드 ${signed(later.metrics.shield)}</small>` : ''}</td>
          ${['general', 'dedicated'].map(context => {
            const deck = result[context];
            return deck ? `<td>${delta(deck)}<small>95% ${range(deck)}<br>${deck.seeds}시드 · 카드 사용 ${num(deck.playedRate * 100)}%</small></td>` : '<td>측정 안 함</td>';
          }).join('')}
          <td>${rank ? `${rank.grade} · ${top(rank.top)}` : '미확정'}<small>${rank ? `순위 범위 ${top(rank.topRange[0])} ~ ${Math.round(rank.topRange[1] * 100)}%<br>빈 슬롯 대비 ${signed(rank.gain * 100)}%p`
            : result.general?.calibrated ? `T${card.tier} 측정 10장 미만` : '표본 부족'}</small></td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="config-hint">코어·재구축의 3/5턴 값은 정해진 후속 행동을 실행한 뒤 빈 슬롯 대조와 비교한 진단값입니다. 실전 기여에는 준비 카드와 설치 비용도 포함됩니다.</p>`;
}
