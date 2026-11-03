import WebSocket from 'ws';
const ws = new WebSocket(process.argv[2]);
let id = 1;
function send(m, p={}) {
  return new Promise(r => {
    const mid = id++;
    ws.send(JSON.stringify({id:mid,method:m,params:p}));
    const h = d => { const msg=JSON.parse(d.toString()); if(msg.id===mid){ws.removeListener('message',h);r(msg.result);} };
    ws.on('message', h);
  });
}
ws.on('open', async () => {
  await send('Page.bringToFront');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 5000));
  await send('Runtime.enable');
  
  // Click first node
  await send('Runtime.evaluate', {expression: `
    const n = document.querySelectorAll('.tree-node');
    if(n.length>0) n[0].click();
    'clicked:' + n.length
  `});
  
  await new Promise(r => setTimeout(r, 1000));
  
  const r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      nodeCount: document.querySelectorAll('.tree-node').length,
      panel: !!document.querySelector('.tree-profile-panel'),
      familyLinks: document.querySelectorAll('.family-link').length,
      actions: !!document.querySelector('.tree-profile-actions'),
      profileClose: !!document.querySelector('.tree-profile-close'),
    })
  `});
  console.log(r.result.value);
  ws.close(); process.exit(0);
});
