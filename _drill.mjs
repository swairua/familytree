import WebSocket from 'ws';
const ws = new WebSocket(process.argv[2]);
let id = 1;
function send(m,p={}){return new Promise(r=>{const mid=id++;ws.send(JSON.stringify({id:mid,method:m,params:p}));const h=d=>{const msg=JSON.parse(d.toString());if(msg.id===mid){ws.removeListener('message',h);r(msg.result);}};ws.on('message',h);});}

ws.on('open', async () => {
  await send('Page.bringToFront');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 6000));
  await send('Runtime.enable');
  
  // Check page state
  let r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      nodeCount: document.querySelectorAll('.tree-node').length,
      hasSvg: !!document.querySelector('#tree-svg'),
      canvasW: document.querySelector('.tree-canvas')?.offsetWidth,
      canvasH: document.querySelector('.tree-canvas')?.offsetHeight,
      bodySnippet: document.body.innerText.substring(0, 200),
    })
  `});
  console.log('Page state:', r.result.value);
  
  // Click first node via JS
  r = await send('Runtime.evaluate', {expression: `
    (function() {
      const nodes = document.querySelectorAll('.tree-node');
      if (nodes.length === 0) return 'no nodes';
      nodes[0].click();
      return 'clicked node 0 of ' + nodes.length;
    })()
  `});
  console.log('Click:', r.result.value);
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Check panel
  r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      hasPanel: !!document.querySelector('.tree-profile-panel'),
      panelText: (document.querySelector('.tree-profile-panel')?.innerText || '').substring(0, 300),
      familyLinks: document.querySelectorAll('.family-link').length,
      hasActions: !!document.querySelector('.tree-profile-actions'),
      fullDetailsBtn: !!document.querySelector('.tree-profile-actions .btn-primary'),
      drillBtn: document.querySelectorAll('.tree-profile-actions .btn').length,
    })
  `});
  console.log('Panel:', r.result.value);
  
  ws.close();
  process.exit(0);
});
