import WebSocket from 'ws';
const ws = new WebSocket(process.argv[2]);
let id = 1;
function send(method, params = {}) {
  return new Promise((resolve) => {
    const msgId = id++;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === msgId) { ws.removeListener('message', handler); resolve(msg.result); }
    };
    ws.on('message', handler);
  });
}
ws.on('open', async () => {
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await new Promise(r => setTimeout(r, 2000));
  await send('Runtime.enable');
  
  // Click the first tree node
  const clickResult = await send('Runtime.evaluate', { expression: `
    (function() {
      const nodes = document.querySelectorAll('.tree-node');
      if (nodes.length === 0) return 'No tree nodes found';
      // Click the first node
      nodes[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return 'Clicked node, total nodes: ' + nodes.length;
    })()
  `});
  console.log('Click result:', clickResult.result.value);
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Check if profile panel appeared
  const panelCheck = await send('Runtime.evaluate', { expression: `
    JSON.stringify({
      hasPanel: !!document.querySelector('.tree-profile-panel'),
      panelText: document.querySelector('.tree-profile-panel')?.innerText?.substring(0, 300),
      hasFamilyLinks: document.querySelectorAll('.family-link').length,
      hasActions: !!document.querySelector('.tree-profile-actions'),
      hasDrillDown: !!document.querySelector('.tree-profile-actions .btn:nth-child(2)'),
      hasFullDetails: !!document.querySelector('.tree-profile-actions .btn-primary'),
      noErrors: true,
    })
  `});
  console.log('Panel check:', panelCheck.result.value);
  
  ws.close();
  process.exit(0);
});
