import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { bpDetail, fmtMoney, bpQuestions, bpAnsweredQA, consensusLevel, bpTrajectory, sectorBenchmark, bpValuations, bpValuationHistory, bpOutcomes, bpSuggestions, bpSignals } from '@/lib/queries';
import BpTrajectoryChart from '@/components/BpTrajectoryChart';
import ValuationButton from '@/components/ValuationButton';
import ValuationHistoryChart from '@/components/ValuationHistoryChart';
import { getDb } from '@/lib/db';
import { rankDeltas } from '@/lib/ranks';
import { analyzeBpText, SECTOR_LABELS, STAGE_LABELS, BIZ_MODEL_LABELS, CUSTOMER_LABELS, evidenceCount, SECTOR_LABELS_EN, STAGE_LABELS_EN, BIZ_MODEL_LABELS_EN, CUSTOMER_LABELS_EN, L, valHash } from '@/lib/engine';
import { pName } from '@/lib/i18n';
import RankDelta from '@/components/RankDelta';
import FollowButton from '@/components/FollowButton';
import InvestWidget from '@/components/InvestWidget';
import CoverThumb from '@/components/CoverThumb';
import OutcomeReporter from '@/components/OutcomeReporter';
import WhatIfSimulator from '@/components/WhatIfSimulator';
import SignalTracker from '@/components/SignalTracker';
import TipWidget from '@/components/TipWidget';
import PromptPack from '@/components/PromptPack';
import { getSessionUser } from '@/lib/auth';
import { bpTips, packForBp } from '@/lib/queries';
import { comparableForBp } from '@/lib/comparables';
import { usdCnyRateSync } from '@/lib/fx';

export const dynamic = 'force-dynamic';

const TYPE_LABELS = { html: '🎮 在线试玩', url: '🔗 在线Demo', github: '🐙 GitHub', shots: '🖼 截图' };
const TYPE_LABELS_EN = { html: '🎮 Playable', url: '🔗 Live', github: '🐙 GitHub', shots: '🖼 Screenshot' };

export default function BpPage({ params, searchParams }) {
  const autoRevalue = searchParams?.revalue === '1';
  const data = bpDetail(Number(params.id));
  if (!data) notFound();
  const { bp, evals, total, owner } = data;
  const isDemo = bp.kind === 'demo';
  const delta = rankDeltas(getDb(), bp.kind || 'bp')[bp.id];
  const analysis = !isDemo ? analyzeBpText(`${bp.summary} ${bp.content}`) : null;
  const questions = bpQuestions(bp.id, 3);
  const answeredQA = bpAnsweredQA(bp.id);
  let tags = [];
  try { tags = JSON.parse(bp.tags || '[]'); } catch {}
  const en = cookies().get('lang')?.value === 'en';
  const locale = en ? 'en' : 'zh';
  const enOf = (e) => { try { return JSON.parse(e.en || 'null'); } catch { return null; } };
  const pick = (e, f) => (en && enOf(e)?.[f]) || e[f];
  const _scores = evals.map((e) => e.score);
  const spread = _scores.length ? Math.max(..._scores) - Math.min(..._scores) : 0;
  const cons = consensusLevel(spread);
  const traj = bpTrajectory(bp.id);
  const valSummary = (() => { try { return JSON.parse(bp.val_summary || 'null'); } catch { return null; } })();
  const valEvidence = (() => { try { return JSON.parse(bp.val_evidence || '[]'); } catch { return []; } })();
  const valuations = bpValuations(bp.id).map((v) => {
    let ven = null; try { ven = JSON.parse(v.en || 'null'); } catch {}
    let drivers = []; try { drivers = JSON.parse(v.drivers || '[]'); } catch {}
    let evi = []; try { evi = JSON.parse(v.evidence || '[]'); } catch {}
    return { ...v, _en: ven, _drivers: en && ven?.drivers ? ven.drivers : drivers, _evi: en && ven?.evidence ? ven.evidence : evi };
  });
  const valByInv = {};
  valuations.forEach((v) => { valByInv[v.investor_id] = { low: v.low, high: v.high }; });
  const hasVal = !!(valSummary && valSummary.n > 0);
  const valStale = hasVal && bp.val_hash !== valHash(bp);
  const valHistory = bpValuationHistory(bp.id);
  const outcomes = bpOutcomes(bp.id);
  const suggestions = bpSuggestions(bp.id);
  const signals = bpSignals(bp.id);
  const TREND = { up: '↗', down: '↘', flat: '→' };
  const viewer = getSessionUser();
  const tips = bpTips(bp.id);
  const pack = packForBp(bp.id, viewer?.uid || null);
  const isOwnerOfBp = !!(viewer && owner && bp.owner_user_id === viewer.uid);
  const compMatch = comparableForBp(getDb(), bp);
  const autoFunding = compMatch && compMatch.funding
    ? { funding: compMatch.funding, url: compMatch.funding_url, name: compMatch.name, at: compMatch.funding_at, amount_usd: compMatch.funding_amount_usd || 0 }
    : null;
  const rate = usdCnyRateSync();
  const bench = !isDemo ? sectorBenchmark(bp.id) : null;
  const myEv = bench ? evidenceCount(`${bp.summary} ${bp.content}`) : 0;
  const champEv = bench && bench.champion ? evidenceCount(`${bench.champion.summary} ${bench.champion.content}`) : 0;

  if (bp.visibility === 'ai_only') {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto', textAlign: 'center' }}>
        <h1 className="page-title">🔒 {en ? `This ${isDemo ? 'Demo' : 'BP'} is AI-only` : `这份${isDemo ? 'Demo' : 'BP'}仅AI可见`}</h1>
        <p className="page-sub">{en ? 'The uploader chose privacy: content and reports are hidden, but it still competes on the board.' : '上传者设置了隐私保护，内容与评估报告不对外公开，但它仍在排行榜上参战。'}</p>
        <Link href={isDemo ? '/demos' : '/'} className="btn">{en ? 'Back to board' : '返回排行榜'}</Link>
      </div>
    );
  }

  const avg = evals.length ? (evals.reduce((s, e) => s + e.score, 0) / evals.length).toFixed(1) : '-';

  return (
    <div>
      <SignalTracker bpId={bp.id} isDemo={isDemo} />
      <div style={{ marginBottom: 16 }}><CoverThumb cover={bp.cover} bp={bp} variant="banner" /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {bp.title} <RankDelta delta={delta} />
          </h1>
          <p className="page-sub">
            {owner ? <Link href={`/u/${owner.handle}`} style={{ color: 'var(--accent)' }}>@{owner.handle}</Link> : bp.founder} · {en ? 'uploaded' : '上传于'} {bp.created_at?.slice(0, 10)} ·{' '}
            <span className="badge badge-public">{en ? 'Public' : '公开'}</span>
            {!isDemo && bp.stage && STAGE_LABELS[bp.stage] ? <> <span className="badge badge-llm">{L(STAGE_LABELS, STAGE_LABELS_EN, bp.stage, locale)}</span></> : null}
            {bp.version > 1 ? <> <span className="badge badge-real">{en ? `iterated v${bp.version}` : `已迭代 v${bp.version}`}</span></> : null}
            {isDemo ? <> <span className="badge badge-llm">{(en ? TYPE_LABELS_EN : TYPE_LABELS)[bp.demo_type] || 'Demo'}</span> <span className="badge badge-famous">{en ? 'Demo track' : 'Demo赛道'}</span></> : null}
            {bp.sector && SECTOR_LABELS[bp.sector] ? <> · {en ? 'Sector: ' : '赛道：'}<Link href={`/sector/${bp.sector}`} style={{ color: 'var(--accent)' }}>{L(SECTOR_LABELS, SECTOR_LABELS_EN, bp.sector, locale)} 🆚</Link></> : null}
          </p>
          {!isDemo && (bp.subsector || bp.biz_model || bp.customer || tags.length > 0) && (
            <div className="cls-row">
              {bp.subsector ? <span className="badge badge-famous">{bp.subsector}</span> : null}
              {bp.biz_model && BIZ_MODEL_LABELS[bp.biz_model] ? <span className="badge badge-llm">{L(BIZ_MODEL_LABELS, BIZ_MODEL_LABELS_EN, bp.biz_model, locale)}</span> : null}
              {bp.customer && CUSTOMER_LABELS[bp.customer] ? <span className="badge badge-public">{L(CUSTOMER_LABELS, CUSTOMER_LABELS_EN, bp.customer, locale)}</span> : null}
              {tags.map((t, i) => <span key={i} className="cls-tag">#{t}</span>)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FollowButton bpId={bp.id} />
          {!isDemo && <Link href={`/bp/${bp.id}/report`} className="btn btn-ghost">📄 {en ? 'Diagnosis Report' : '深度诊断报告'}</Link>}
          {!isDemo && <Link href={`/bp/${bp.id}/card`} className="btn btn-ghost">🎉 {en ? 'Share Card' : '生成战绩卡'}</Link>}
          <Link href={`/resubmit/${bp.id}`} className="btn">⚔️ {en ? 'Re-enter / Update' : '重新参战，提交更新版'}</Link>
        </div>
      </div>

      <div className="card val-card">
        <div className="val-head">
          <h3>💰 {en ? 'Investor Valuation' : '投资人估值'}</h3>
          <ValuationButton bpId={bp.id} en={en} hasVal={hasVal} stale={valStale} autoRevalue={autoRevalue} />
        </div>
        {valSummary && valSummary.n > 0 ? (
          <>
            <div className="val-range">{fmtMoney(valSummary.low, locale)} – {fmtMoney(valSummary.high, locale)}</div>
            <div className="hint">{en ? `Consensus of ${valSummary.n} investors · avg confidence ${valSummary.confidence}% · ${valSummary.at}` : `${valSummary.n} 位投资人综合 · 平均置信度 ${valSummary.confidence}% · ${valSummary.at}`}</div>
            {valSummary.disp && (
              <div className="hint">
                {en
                  ? `Investor range ${fmtMoney(valSummary.disp.lo, locale)}–${fmtMoney(valSummary.disp.hi, locale)} · disagreement: ${{ low: 'low', mid: 'moderate', high: 'high' }[valSummary.disp.level] || valSummary.disp.level}`
                  : `各家区间跨度 ${fmtMoney(valSummary.disp.lo, locale)}–${fmtMoney(valSummary.disp.hi, locale)} · 分歧度：${{ low: '低', mid: '中', high: '高' }[valSummary.disp.level] || valSummary.disp.level}`}
              </div>
            )}
            <div className="hint" style={{ opacity: 0.8 }}>{en ? 'A reference range, not a precise price — it shifts with web evidence and model randomness across runs.' : '参考区间，非精确定价——会随联网证据与模型随机性，在多次运行间波动。'}</div>
            {valSummary.floor ? <div className="hint" style={{ color: 'var(--gold)' }}>🔒 {en ? `Floor anchored on real funding: ≥ ${fmtMoney(valSummary.floor, locale)}` : `下限锚定真实融资：不低于 ${fmtMoney(valSummary.floor, locale)}`}</div> : null}
            {Array.isArray(valSummary.levers) && valSummary.levers.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>📈 {en ? 'What would move this valuation' : '哪些因素会抬高 / 拖低估值'}</div>
                {valSummary.levers.map((lv, i) => {
                  const up = lv.dir !== 'down';
                  const label = en ? (lv.en?.label || lv.label) : lv.label;
                  const impact = en ? (lv.en?.impact || lv.impact) : lv.impact;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                      <span style={{ color: up ? '#3fb950' : '#e5534b', fontWeight: 700 }}>{up ? '↑' : '↓'}</span>
                      <span style={{ flex: 1 }}>{label}</span>
                      {impact ? <span className="hint" style={{ color: up ? '#3fb950' : '#e5534b', whiteSpace: 'nowrap' }}>{impact}</span> : null}
                    </div>
                  );
                })}
              </div>
            )}
            {valStale && <div className="hint" style={{ color: 'var(--gold)' }}>{en ? '⚠️ Content has changed since this valuation — re-value for an up-to-date estimate.' : '⚠️ 内容在此次估值后已更新——可点「重新估值」获取最新结果。'}</div>}
            {valHistory.length >= 2 && (
              <details className="val-ev">
                <summary>{en ? `Valuation trend (${valHistory.length})` : `估值趋势（${valHistory.length}）`}</summary>
                <ValuationHistoryChart data={valHistory} en={en} rate={rate} />
              </details>
            )}
            {valEvidence.length > 0 && (
              <details className="val-ev">
                <summary>{en ? `Web evidence (${valEvidence.length})` : `联网证据（${valEvidence.length}）`}</summary>
                <ul>{valEvidence.map((e, i) => <li key={i}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.title || e.url}</a></li>)}</ul>
              </details>
            )}
            {Array.isArray(valSummary.compList) && valSummary.compList.length > 0 && (
              <details className="val-ev">
                <summary>{en ? `Anchored on ${valSummary.compList.length} real in-site comparables` : `参考了站内 ${valSummary.compList.length} 个真实可比项目`}</summary>
                <ul>{valSummary.compList.map((c, i) => <li key={i}>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.name}</a> : c.name}{typeof c.stars === 'number' ? ` · ⭐${c.stars}` : ''}{c.funding ? ` · 💰${c.funding}` : ''}</li>)}</ul>
              </details>
            )}
            <details className="val-ev">
              <summary>{en ? `Each investor’s valuation (${valuations.length})` : `各家估值与依据（${valuations.length}）`}</summary>
              {valuations.map((v) => (
                <div key={v.investor_id} className="val-row">
                  <div className="val-row-head">
                    <span>{v.emoji} {pName(locale, v.slug, v.name)}</span>
                    <b>{fmtMoney(v.low, locale)}–{fmtMoney(v.high, locale)}</b>
                  </div>
                  <div className="hint">{en ? (v._en?.method || v.method) : v.method} · {en ? 'confidence' : '置信度'} {v.confidence}% · {en ? (v._en?.reasoning || v.reasoning) : v.reasoning}</div>
                  {v._evi.length > 0 && (
                    <div className="val-cite">{v._evi.map((x, i) => (
                      x.url ? <a key={i} href={x.url} target="_blank" rel="noopener noreferrer">[{i + 1}] {x.point}</a> : <span key={i}>[{i + 1}] {x.point}</span>
                    ))}</div>
                  )}
                </div>
              ))}
            </details>
            <WhatIfSimulator bpId={bp.id} low={valSummary.low} high={valSummary.high} suggestions={suggestions} rubric={valSummary.rubric || null} en={en} />
          </>
        ) : valSummary ? (
          <p className="hint">{en ? '⚠️ Last run produced no valuations (model timeout/busy). Click again to retry.' : '⚠️ 上次估值没有成功（模型超时/繁忙）。请再点一次「重新估值」重试。'}</p>
        ) : (
          <p className="hint">{en ? 'No valuation yet. Generate one — 12 investors search the web, reason deeply, and each give an evidence-backed valuation (~1 min).' : '还没有估值。点上方按钮生成——12 位投资人联网搜索、深度推理，各自给出带依据的估值（约 1 分钟）。'}</p>
        )}
        <OutcomeReporter bpId={bp.id} en={en} outcomes={outcomes} auto={autoFunding} />
      </div>

      <div className="stats-bar">
        <div className="stat"><b style={{ color: 'var(--green)' }}>{fmtMoney(total, locale)}</b><span>{en ? 'Total invested' : '累计虚拟注资'}</span></div>
        <div className="stat"><b>{avg}</b><span>{en ? 'Avg score' : '投资人平均评分'}</span></div>
        <div className="stat"><b>{evals.filter((e) => e.holding > 0).length}/{evals.length}</b><span>{en ? 'Investors holding' : '投资人持仓中'}</span></div>
      </div>

      <div className="card" style={{ padding: '10px 14px' }}>
        <div className="rank-sub" style={{ fontWeight: 600, marginBottom: 6 }}>📡 {en ? 'Real on-site engagement' : '站内真实使用'}
          <span className="hint" style={{ fontWeight: 400 }}> · {en ? 'measured here, deduped by visitor' : '本站实测、按访客去重'}</span></div>
        {signals.enough ? (
          <div className="stats-bar" style={{ marginBottom: 0 }}>
            {isDemo ? <div className="stat"><b>{signals.plays}</b><span>{en ? 'Played (people)' : '试玩人数'}</span></div> : null}
            <div className="stat"><b>{signals.returnRate}%</b><span>{en ? 'Return rate' : '复访率'}</span></div>
            {signals.avgDwellS > 0 ? <div className="stat"><b>{signals.avgDwellS}s</b><span>{en ? 'Avg dwell' : '平均停留'}</span></div> : null}
            <div className="stat"><b>{TREND[signals.trend]} {signals.v7}</b><span>{en ? 'Visitors (7d)' : '近7天访客'}</span></div>
          </div>
        ) : (
          <p className="hint" style={{ margin: 0 }}>🌱 {en ? 'Gathering data — engagement metrics show once enough real visitors interact.' : '数据积累中 —— 真实访客达到一定量后才展示使用指标（避免小样本失真）。'}</p>
        )}
      </div>

      <TipWidget bpId={bp.id} ownerHandle={owner?.handle || ''} ownerUserId={bp.owner_user_id || null} total={tips.total} count={tips.count} en={en} />
      {(pack || isOwnerOfBp) ? <PromptPack bpId={bp.id} isOwnerOfBp={isOwnerOfBp} initial={pack} en={en} /> : null}

      {isDemo && bp.demo_type === 'html' && bp.filename ? (
        <div className="card" style={{ padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 10px' }}>
            <h3>🎮 {en ? 'Play it' : '在线试玩'}</h3>
            <a className="btn btn-ghost" href={`/api/demo/${bp.id}/preview`} target="_blank" rel="noopener">{en ? 'Fullscreen ↗' : '全屏打开 ↗'}</a>
          </div>
          <iframe
            src={`/api/demo/${bp.id}/preview`}
            sandbox="allow-scripts allow-pointer-lock"
            style={{ width: '100%', height: 480, border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}
            title={bp.title}
          />
        </div>
      ) : null}
      {isDemo && bp.demo_type !== 'html' && bp.demo_url ? (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>{bp.demo_type === 'github' ? (en ? '🐙 Repository' : '🐙 项目仓库') : (en ? '🔗 Live Demo' : '🔗 在线Demo')}</h3>
            <p className="hint" style={{ wordBreak: 'break-all' }}>{bp.demo_url}</p>
          </div>
          <a className="btn" href={bp.demo_url} target="_blank" rel="noopener noreferrer">{en ? 'Open ↗' : '打开 ↗'}</a>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>🎮 {en ? 'Invest as a player' : '我也来当投资人'}</h3>
        <InvestWidget bpId={bp.id} title={bp.title} price={total} valLow={hasVal ? valSummary.low : 0} valHigh={hasVal ? valSummary.high : 0} rate={rate} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>📈 {en ? 'Investment over time' : '累计注资走势'}</h3>
        <BpTrajectoryChart data={traj} />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <h3>{isDemo ? (en ? 'About the Demo' : 'Demo 介绍') : (en ? 'Summary' : '项目简介')}</h3>
          {!isDemo && bp.filename ? (
            <a className="btn btn-ghost" href={`/api/bp/${bp.id}/file`}>⬇️ {en ? 'Download BP (.pptx)' : '下载 BP 原文件（.pptx）'}</a>
          ) : null}
        </div>
        <p style={{ color: 'var(--text2)', lineHeight: 1.8, fontSize: 14 }}>{bp.summary}</p>
      </div>

      {analysis && (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>📊 {en ? 'Scoring basis (auto-detected)' : '评分依据（系统识别）'}</h3>
          <p className="hint" style={{ marginBottom: 10 }}>{en ? 'Investors reward verifiable content, not rhetoric. Signals detected in this BP:' : '投资人只认可验证的内容、不奖励辞藻。以下是系统从这份 BP 里识别到的信号：'}</p>
          <div className="evi-stats">
            <span className="evi-pill evi-good">✅ {en ? `${analysis.evidence} evidence points` : `具体证据 ${analysis.evidence} 处`}</span>
            <span className="evi-pill evi-bad">⚠️ {en ? `${analysis.hype} buzzwords` : `口号式表述 ${analysis.hype} 处`}</span>
          </div>
          {analysis.evidenceSamples.length > 0 && (
            <div className="evi-block">
              <h4>{en ? 'Concrete claims recognized' : '被认可的具体信息'}</h4>
              <ul>{analysis.evidenceSamples.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {analysis.hypeSamples.length > 0 && (
            <div className="evi-block">
              <h4>{en ? 'These words don’t help (and may hurt)' : '这些词不加分（甚至扣分）'}</h4>
              <p className="evi-hype">{analysis.hypeSamples.join(en ? ', ' : '、')}</p>
            </div>
          )}
          {analysis.evidence === 0 && (
            <p className="hint" style={{ marginTop: 8 }}>{en ? 'No concrete data/metrics found — add verifiable evidence (market data, business metrics, unit economics, real traction) to score higher.' : '没识别到具体数据/指标 —— 想提分，请补充可量化的真实证据（市场数据、业务指标、单位经济模型、真实进展）。'}</p>
          )}
        </div>
      )}

      {bench && bench.n > 1 && (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>🎯 {en ? 'Sector positioning' : '赛道定位'}</h3>
          <p className="rp-p" style={{ fontSize: 14 }}>{en
            ? <>Among {bench.n} projects in “{L(SECTOR_LABELS, SECTOR_LABELS_EN, bp.sector, locale)}”, your average score beats about <b>{bench.percentile}%</b>.</>
            : <>在「{SECTOR_LABELS[bp.sector] || bp.sector}」赛道的 {bench.n} 个项目中，你的均分超过了约 <b>{bench.percentile}%</b>。</>}</p>
          {bench.champion && (
            <p className="hint" style={{ marginTop: 6 }}>
              {en
                ? `Leader: "${bench.champion.title}" (avg ${bench.champion.avg_score ?? '-'}, invested ${fmtMoney(bench.champion.total_invested, locale)}). Evidence: you ${myEv} vs leader ${champEv}.${champEv > myEv ? ' Adding verifiable evidence is your most direct way to catch up.' : ' Your evidence matches the leader — keep refining insight and unit economics.'}`
                : `赛道领跑：《${bench.champion.title}》（均分 ${bench.champion.avg_score ?? '-'}、注资 ${fmtMoney(bench.champion.total_invested, locale)}）。证据数：你 ${myEv} 处 vs 冠军 ${champEv} 处。${champEv > myEv ? ' 补齐可验证证据是最直接的追赶点。' : ' 你的证据不输冠军，继续打磨洞察与单位经济。'}`}
            </p>
          )}
        </div>
      )}

      {(questions.length > 0 || answeredQA.length > 0) && (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>🎤 {en ? 'Pitch Q&A' : '路演问答'}</h3>
          <p className="hint" style={{ marginBottom: 10 }}>{en ? 'The toughest investors’ key questions. Answer them when you “re-enter”, and replies fold into the evaluation.' : '评分最严格的投资人最想问的问题。创始人可在「重新参战」时作答，答复会并入评估。'}</p>
          {questions.map((q) => (
            <div key={q.investor_id} className="qa-row">
              <div className="qa-q">{q.emoji} {pName(en ? 'en' : 'zh', q.slug, q.name)}（{q.score}）: {pick(q, 'question')}</div>
              {q.answer
                ? <div className="qa-a">{en ? 'Founder: ' : '创始人答：'}{q.answer}</div>
                : <div className="qa-a qa-pending">{en ? '— awaiting founder’s reply on re-entry —' : '— 待创始人在「重新参战」时作答 —'}</div>}
            </div>
          ))}
          {answeredQA.length > 0 && (
            <details className="qa-history">
              <summary>📜 历史问答记录（{answeredQA.length}）</summary>
              {answeredQA.map((x, i) => (
                <div key={i} className="qa-row">
                  <div className="qa-q">{x.emoji} {x.name} 问：{x.q}</div>
                  <div className="qa-a">答：{x.a}</div>
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      <h2 className="section-title">📋 {en ? `12 AI Investors · ${isDemo ? 'Try-out Reports' : 'Evaluations'}` : `12位虚拟投资人${isDemo ? '试用报告' : '评估报告'}`}</h2>
      {evals.length > 0 && (
        <p className="hint" style={{ marginBottom: 8 }}>
          {en ? 'Score range' : '评分区间'} {Math.min(..._scores)}–{Math.max(..._scores)} · <span className={`badge ${cons.cls}`}>{en ? cons.labelEn : cons.label}</span>
          {spread > 30 ? <> · <Link href="/controversial" style={{ color: 'var(--accent)' }}>{en ? 'See Controversial 🔥' : '看争议榜 🔥'}</Link></> : null}
        </p>
      )}
      {!isDemo && (
        <p className="hint" style={{ marginBottom: 12 }}>
          {en ? 'Scoring rewards verifiable content and evidence, not rhetoric; founder background cannot be verified and is excluded.' : '评分只看可验证的内容与证据，不奖励辞藻堆砌；团队/创始人背景无法核实，不计入评分与投资决策。'}
        </p>
      )}
      {evals.map((e) => (
        <div className="card eval-card" key={e.id} style={{ borderLeftColor: e.holding > 0 ? 'var(--green)' : 'var(--border)' }}>
          <div className="eval-head">
            <div className="inv-avatar">{e.emoji}</div>
            <div>
              <div className="inv-name">
                {pName(en ? 'en' : 'zh', e.slug, e.name)}{' '}
                <span className={`badge ${e.type === 'famous' ? 'badge-famous' : 'badge-llm'}`}>
                  {e.type === 'famous' ? (en ? 'Style sim' : '风格模拟') : 'LLM'}
                </span>
                {e.source === 'deepseek' ? <span className="badge badge-real"> {en ? 'Live LLM' : '真实LLM分析'}</span> : null}
              </div>
              <div className="inv-style">
                {e.holding > 0 ? `${en ? 'Invested' : '当前注资'} ${fmtMoney(e.holding)}` : (en ? 'No position' : '未注资')}
              </div>
            </div>
            <div className="eval-score" style={{ color: e.score >= 70 ? 'var(--green)' : e.score >= 50 ? 'var(--gold)' : 'var(--red)' }}>
              {e.score}
            </div>
          </div>
          <div className="eval-grid">
            <div><h4>💰 {en ? 'Valuation' : '估值'}</h4>{valByInv[e.investor_id] ? `${fmtMoney(valByInv[e.investor_id].low, locale)} – ${fmtMoney(valByInv[e.investor_id].high, locale)}` : (en ? '— (generate above)' : '—（见上方估值）')}</div>
            <div><h4>{isDemo ? `⚙️ ${en ? 'Tech' : '技术点评'}` : `🏰 ${en ? 'Moat' : '护城河'}`}</h4>{pick(e, 'moat')}</div>
            <div><h4>✨ {isDemo ? (en ? 'Highlight' : '亮点') : (en ? 'Strengths' : '优势')}</h4>{pick(e, 'strengths')}</div>
            <div><h4>⚠️ {isDemo ? (en ? 'To improve' : '改进建议') : (en ? 'Weakness' : '短板')}</h4>{pick(e, 'weaknesses')}</div>
          </div>
          <div className="eval-comment">💬 {pick(e, 'comment')}</div>
        </div>
      ))}
    </div>
  );
}
