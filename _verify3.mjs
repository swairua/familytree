import WebSocket from 'ws';
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id = 1;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = id++;
    ws.send(JSON.stringify({ id: mid, method, params }));
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === mid) { ws.removeListener('message', handler); resolve(msg.result); }
    };
    ws.on('message', handler);
    setTimeout(() => reject(new Error('timeout')), 15000);
  });
}
ws.on('open', async () => {
  try {
    await send('Page.bringToFront');
    await send('Runtime.enable');
    // Click Gallery nav
    await send('Runtime.evaluate', {expression: `
      const links = document.querySelectorAll('.nav-link, .sidebar-nav-item');
      for (const l of links) { if (l.textContent.includes('Gallery') || l.textContent.includes('Photo')) { l.click(); break; } }
    `});
    await new Promise(r => setTimeout(r, 2000));
    const r = await send('Runtime.evaluate', {expression: `
      JSON.stringify({
        viewMode: document.querySelector('.gallery-masonry') ? 'masonry' : 
                  document.querySelector('.gallery-grid') ? 'grid' : 
                  document.querySelector('.gallery-timeline') ? 'timeline' : 
                  document.querySelector('.gallery-list') ? 'list' : 'none',
        galleryItemCount: document.querySelectorAll('.gallery-item').length,
        skeletonCount: document.querySelectorAll('.gallery-skeleton').length,
        loadedCount: document.querySelectorAll('.gallery-item.loaded').length,
        hasFilterBtns: document.querySelectorAll('.gallery-filter-group .btn').length,
        hasViewBtns: document.querySelectorAll('.gallery-view-group .btn-icon').length,
        bodySnippet: (document.querySelector('.gallery-container')?.innerText || '').substring(0, 300),
      })
    `});
    console.log(r.result.value);
  } catch(e) { console.error(e.message); }
  ws.close(); process.exit(0);
});
ws.on('error', (e) => { console.error('ws error:', e.message); process.exit(1); });
