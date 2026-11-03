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
    await new Promise(r => setTimeout(r, 4000));
    const r = await send('Runtime.evaluate', {expression: `
      JSON.stringify({
        hasApp: !!document.querySelector('.app'),
        hasSidebar: !!document.querySelector('.sidebar'),
        hasSvg: !!document.querySelector('#tree-svg'),
        nodeCount: document.querySelectorAll('.tree-node').length,
        bodySnippet: (document.body.innerText || '').substring(0, 400),
      })
    `});
    console.log(r.result.value);
  } catch(e) { console.error(e.message); }
  ws.close(); process.exit(0);
});
ws.on('error', (e) => { console.error('ws error:', e.message); process.exit(1); });
