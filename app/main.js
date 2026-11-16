// A make.fun frontend: board, bounty page, leaderboard, profile — on hash routes.
//
//   #/                              the board of open bounties
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a page loads and true once its data is on
// screen, so a screenshot script knows when to capture.

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { board, bounty, leaderboard, profile } from './views.js';
import { timeLeft } from './format.js';

const app = document.getElementById('app');
const PAGE_SIZE = 25;

/** Board UI state: search text, status filter, sort. Kept across re-renders. */
const boardUi = { q: '', status: 'open', sort: 'deadline' };

/** A 1s ticker that only rewrites countdown text — no re-render, no requests. */
function tickCountdowns() {
  const now = Date.now();
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    el.textContent = timeLeft(el.getAttribute('data-countdown'), now);
  });
}
setInterval(tickCountdowns, 1000);

/** Wire the board's search / filter / sort controls to re-render in place. */
function wireBoard(data) {
  const q = document.getElementById('q');
  const status = document.getElementById('status');
  const sort = document.getElementById('sort');
  if (!q) return;
  const rerender = () => {
    boardUi.q = q.value;
    boardUi.status = status.value;
    boardUi.sort = sort.value;
    app.innerHTML = board(data, boardUi);
    wireBoard(data);
    const q2 = document.getElementById('q');
    q2.focus();
    q2.setSelectionRange(q2.value.length, q2.value.length);
  };
  q.addEventListener('input', rerender);
  status.addEventListener('change', rerender);
  sort.addEventListener('change', rerender);
}

function setNav(route) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.removeAttribute('aria-current');
  });
  const key = route === 'board' ? 'board' : route === 'profile' ? 'profile' : null;
  if (key) {
    const a = document.querySelector(`[data-nav="${key}"]`);
    if (a) a.setAttribute('aria-current', 'page');
  }
}

async function render() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const bountyMatch = hash.match(/^#\/bounty\/([^/]+)(?:\/(leaderboard))?$/);
  const profileMatch = hash.match(/^#\/u\/([^/]+)$/);
  try {
    if (bountyMatch) {
      const slug = decodeURIComponent(bountyMatch[1]);
      if (bountyMatch[2] === 'leaderboard') {
        setNav('leaderboard');
        app.innerHTML = '<p class="loading">Loading leaderboard…</p>';
        const lb = await getLeaderboard(slug);
        let page = 1;
        const draw = () => {
          app.innerHTML = leaderboard(lb, page, PAGE_SIZE);
          document.querySelectorAll('.pager button[data-page]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const next = Number(btn.getAttribute('data-page'));
              if (next >= 1) {
                page = next;
                draw();
                window.scrollTo(0, 0);
              }
            });
          });
        };
        draw();
        document.title = `Leaderboard · ${lb.competition?.title ?? slug} | make.fun bounties`;
      } else {
        setNav('bounty');
        app.innerHTML = '<p class="loading">Loading bounty…</p>';
        const b = await getBounty(slug);
        document.title = `${b.title} | make.fun bounties`;
        app.innerHTML = bounty(b);
      }
    } else if (profileMatch) {
      const handle = decodeURIComponent(profileMatch[1]);
      setNav('profile');
      app.innerHTML = '<p class="loading">Loading profile…</p>';
      const p = await getProfile(handle);
      document.title = `@${p.handle} | make.fun bounties`;
      app.innerHTML = profile(p);
    } else {
      setNav('board');
      app.innerHTML = '<p class="loading">Loading bounties…</p>';
      const data = await getBounties('open');
      document.title = 'make.fun bounties';
      app.innerHTML = board(data, boardUi);
      wireBoard(data);
    }
  } catch (err) {
    app.innerHTML = `<p class="error">Could not load make.fun's API (${err.message}). <a href="#/">Try the board again</a>, or check <a href="https://make.fun">make.fun</a> itself.</p>`;
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
render();
