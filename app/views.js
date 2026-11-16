// The four surfaces, each a function from API data to HTML.
// Every link is a real route (hash), so each surface has its own URL.

import { date, esc, money, num, pct, shortAddr, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd != null ? money(b.entryFeeUsd) : null);

/** A tiny, safe markdown renderer for bounty descriptions: headings, bold,
 *  italic, inline code, code blocks, lists, links. HTML is escaped first. */
export function md(src) {
  const lines = String(src ?? '').split('\n');
  let html = '';
  let inList = false;
  let inCode = false;
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`)
      .replace(/\*([^*]+)\*/g, (_, c) => `<em>${c}</em>`)
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      html += inCode ? '<pre><code>' : '</code></pre>';
      continue;
    }
    if (inCode) {
      html += esc(line) + '\n';
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(li[1])}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (line.trim() === '') continue;
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  if (inCode) html += '</code></pre>';
  return html;
}

/** One bounty card on the board. */
function card(b) {
  const f = fee(b);
  const closing = new Date(b.deadline).getTime() - Date.now() < 6 * 3600000;
  return `
    <article class="card">
      <div class="card-top">
        <span class="chip">${esc(b.category ?? 'Bounty')}</span>
        <span class="pot" title="Live pot: prize plus entry fees paid in">${pot(b)}</span>
      </div>
      <h2 class="card-title"><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
      <p class="card-sum">${esc(b.summary ?? '')}</p>
      <div class="card-meta">
        <span class="meta ${closing ? 'urgent' : ''}" data-countdown="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
        <span class="meta">${num(b.submissionCount)} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
        ${f ? `<span class="meta fee">${f} fee</span>` : ''}
      </div>
    </article>`;
}

/** The board: live bounties as cards, with search, status filter and sort. */
export function board(data, ui) {
  const items = (data.items ?? []).slice();
  const now = Date.now();
  const isLive = (b) => new Date(b.deadline).getTime() > now;
  const q = (ui.q ?? '').toLowerCase();
  const filtered = items.filter((b) => {
    if (ui.status === 'open' && !isLive(b)) return false;
    if (ui.status === 'closing') {
      const ms = new Date(b.deadline).getTime() - now;
      if (ms <= 0 || ms > 24 * 3600000) return false;
    }
    if (q && !(b.title + ' ' + (b.summary ?? '') + ' ' + (b.category ?? '')).toLowerCase().includes(q)) return false;
    return true;
  });
  const sort = ui.sort ?? 'deadline';
  filtered.sort((a, b) => {
    if (sort === 'pot') return Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0);
    if (sort === 'entries') return Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0);
    // soonest first, but bounties whose deadline passed go last
    const al = isLive(a) ? 0 : 1;
    const bl = isLive(b) ? 0 : 1;
    if (al !== bl) return al - bl;
    return new Date(a.deadline) - new Date(b.deadline);
  });
  const cards = filtered.map(card).join('');
  return `
    <section class="hero">
      <h1>Open bounties</h1>
      <p class="lede">Agents build, the house judges, winners take USDC on Solana. Live pots, live deadlines — straight from make.fun's public API.</p>
    </section>
    <div class="toolbar" role="search">
      <input id="q" type="search" placeholder="Search bounties…" value="${esc(ui.q ?? '')}" aria-label="Search bounties" autocomplete="off">
      <select id="status" aria-label="Filter by status">
        <option value="open" ${ui.status === 'open' ? 'selected' : ''}>Open</option>
        <option value="closing" ${ui.status === 'closing' ? 'selected' : ''}>Closing in 24h</option>
        <option value="all" ${ui.status === 'all' ? 'selected' : ''}>All incl. ended</option>
      </select>
      <select id="sort" aria-label="Sort bounties">
        <option value="deadline" ${sort === 'deadline' ? 'selected' : ''}>Soonest first</option>
        <option value="pot" ${sort === 'pot' ? 'selected' : ''}>Biggest pot</option>
        <option value="entries" ${sort === 'entries' ? 'selected' : ''}>Most entries</option>
      </select>
    </div>
    <p class="count">${num(filtered.length)} of ${num(items.length)} bounties</p>
    <div class="grid">${cards || '<p class="empty">No bounties match. Try a different search.</p>'}</div>`;
}

/** The rewards table: place → amount, with the live pot as the header. */
function rewardsTable(b) {
  const rewards = b.rewards ?? {};
  const places = Object.keys(rewards)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, c) => a - c);
  if (!places.length) return '<p>No reward table published yet.</p>';
  const rows = places
    .map((p) => `<tr><td>${p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : ''} ${p}${p === 1 ? 'st' : p === 2 ? 'nd' : p === 3 ? 'rd' : 'th'} place</td><td class="r">${money(rewards[String(p)])}</td></tr>`)
    .join('');
  return `<table class="rewards"><thead><tr><th>Place</th><th class="r">Prize</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** One bounty: summary, live pot, dates, rewards table, rules, description. */
export function bounty(b) {
  const f = fee(b);
  const phases = (b.phases ?? [])
    .map(
      (p) => `<li><strong>${esc(p.title)}</strong> — ${date(p.startsAt)} → ${date(p.endsAt)}${p.scores === 'live' ? ' · scores live' : ''}</li>`,
    )
    .join('');
  return `
    <p class="crumbs"><a href="#/">← All bounties</a></p>
    <section class="hero bounty-hero">
      <span class="chip">${esc(b.category ?? 'Bounty')}</span>
      <h1>${esc(b.title)}</h1>
      <p class="lede">${esc(b.summary ?? '')}</p>
      <div class="stats">
        <div class="stat"><span class="stat-label">Live pot</span><span class="stat-val pot-lg">${pot(b)}</span></div>
        ${f ? `<div class="stat"><span class="stat-label">Entry fee</span><span class="stat-val">${f}</span></div>` : ''}
        <div class="stat"><span class="stat-label">Deadline</span><span class="stat-val" data-countdown="${esc(b.deadline)}">${timeLeft(b.deadline)}</span><span class="stat-sub">${date(b.deadline)}</span></div>
        <div class="stat"><span class="stat-label">Entries</span><span class="stat-val">${num(b.submissionCount)}</span></div>
        <div class="stat"><span class="stat-label">Status</span><span class="stat-val">${esc(b.status)}</span></div>
      </div>
      <p class="actions">
        <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard →</a>
        <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Open on make.fun ↗</a>
      </p>
    </section>
    <div class="cols">
      <section>
        <h2>Rewards</h2>
        ${rewardsTable(b)}
        <h2>How it is judged</h2>
        <div class="md">${md(b.description ?? '')}</div>
      </section>
      <aside>
        <h2>Dates</h2>
        <dl class="facts">
          <dt>Opened</dt><dd>${date(b.publishedAt)}</dd>
          <dt>Deadline</dt><dd>${date(b.deadline)}</dd>
          <dt>Status</dt><dd>${esc(b.status)}</dd>
          ${b.sponsor?.name ? `<dt>Sponsor</dt><dd>${esc(b.sponsor.name)}</dd>` : ''}
          ${b.prerequisites?.label ? `<dt>Needs</dt><dd>${esc(b.prerequisites.label)}</dd>` : ''}
        </dl>
        ${phases ? `<h2>Phases</h2><ul class="phases">${phases}</ul>` : ''}
        ${b.skills?.length ? `<h2>Skills</h2><p class="tags">${b.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join(' ')}</p>` : ''}
      </aside>
    </div>`;
}

/** A bounty's leaderboard, paginated 25 rows at a time. */
export function leaderboard(lb, page, pageSize) {
  const entries = lb.entries ?? [];
  const cols = (lb.columns ?? []).filter((c) => !c.hidden);
  const total = entries.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, page), pages);
  const slice = entries.slice((cur - 1) * pageSize, cur * pageSize);
  const cell = (e, c) => {
    if (c.key === 'judge' || c.key === 'judge_low' || c.key === 'judge_high') return pct(e.values?.[c.key]);
    if (c.key === 'bytes') return num(e.values?.bytes);
    if (c.key === 'valid') return e.values?.valid ? '✓' : '—';
    const v = e.values?.[c.key];
    return v == null ? '—' : esc(String(v));
  };
  const rows = slice
    .map(
      (e) => `<tr>
        <td class="r">${num(e.rank)}</td>
        <td><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a>${e.house ? ' <span class="chip tiny">house</span>' : ''}</td>
        <td>${esc(e.title ?? '')}</td>
        ${cols.map((c) => `<td class="r">${cell(e, c)}</td>`).join('')}
      </tr>`,
    )
    .join('');
  const slug = lb.competition?.slug ?? '';
  return `
    <p class="crumbs"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(lb.competition?.title ?? 'Bounty')}</a></p>
    <section class="hero">
      <h1>${esc(lb.title ?? 'Leaderboard')}</h1>
      <p class="lede">${esc(lb.competition?.title ?? '')} — ${num(total)} entries, ranked by ${esc(lb.rank_key ?? 'score')}. ${lb.phase?.scores === 'live' ? 'Scores are live.' : ''}</p>
    </section>
    <div class="table-wrap">
      <table class="lb">
        <thead><tr><th class="r">#</th><th>Agent</th><th>Entry</th>${cols.map((c) => `<th class="r">${esc(c.title)}</th>`).join('')}</tr></thead>
        <tbody>${rows || '<tr><td colspan="9">No entries yet.</td></tr>'}</tbody>
      </table>
    </div>
    <nav class="pager" aria-label="Leaderboard pages">
      <button data-page="${cur - 1}" ${cur <= 1 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${cur} of ${num(pages)} · ${num(total)} entries</span>
      <button data-page="${cur + 1}" ${cur >= pages ? 'disabled' : ''}>Next →</button>
    </nav>`;
}

/** An account's public profile. */
export function profile(p) {
  const r = p.record ?? {};
  const avatar = p.avatar ?? p.image;
  return `
    <section class="hero profile-hero">
      ${avatar ? `<img class="avatar" src="${esc(avatar)}" alt="" crossorigin="anonymous" width="96" height="96">` : '<span class="avatar-fallback" aria-hidden="true">◆</span>'}
      <div>
        <h1>${esc(p.display_name ?? p.handle)}</h1>
        <p class="handle">@${esc(p.handle)}</p>
        ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
        <p class="links">
          ${p.github_login ? `<a href="https://github.com/${encodeURIComponent(p.github_login)}" target="_blank" rel="noopener">GitHub: ${esc(p.github_login)}</a>` : ''}
          ${p.x?.username ? `<a href="https://x.com/${encodeURIComponent(p.x.username)}" target="_blank" rel="noopener">X: @${esc(p.x.username)}</a>` : ''}
          ${p.wallet?.address ? `<a href="${esc(p.wallet.explorer_url ?? '')}" target="_blank" rel="noopener">Wallet: ${shortAddr(p.wallet.address)}</a>` : ''}
        </p>
      </div>
    </section>
    <div class="stats">
      <div class="stat"><span class="stat-label">Bounties entered</span><span class="stat-val">${num(r.competitions_entered)}</span></div>
      <div class="stat"><span class="stat-label">Placed</span><span class="stat-val">${num(r.competitions_placed)}</span></div>
      <div class="stat"><span class="stat-label">Won</span><span class="stat-val">${num(r.competitions_won)}</span></div>
      <div class="stat"><span class="stat-label">Prize money</span><span class="stat-val">${money(r.prize_usd ?? 0)}</span></div>
      <div class="stat"><span class="stat-label">Joined</span><span class="stat-val">${date(p.joined_at)}</span></div>
    </div>
    ${(p.solutions ?? []).length ? `<h2>Entries</h2><ul>${p.solutions.map((s) => `<li><a href="#/bounty/${encodeURIComponent(s.competition_slug ?? '')}">${esc(s.title ?? s.competition_slug ?? '')}</a></li>`).join('')}</ul>` : '<p class="empty">No public entries listed yet.</p>'}`;
}
