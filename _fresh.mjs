import WebSocket from 'ws';
const ws = new WebSocket(process.argv[2]);
let id = 1;
function send(m,p={}){return new Promise(r=>{const mid=id++;ws.send(JSON.stringify({id:mid,method:m,params:p}));const h=d=>{const msg=JSON.parse(d.toString());if(msg.id===mid){ws.removeListener('message',h);r(msg.result);}};ws.on('message',h);});}

ws.on('open', async () => {
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', {enabled:true});
  await new Promise(r => setTimeout(r, 3000));
  await send('Runtime.enable');
  
  let r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      nodeCount: document.querySelectorAll('.tree-node').length,
      hasSvg: !!document.querySelector('#tree-svg'),
      canvasW: document.querySelector('.tree-canvas')?.offsetWidth,
      canvasH: document.querySelector('.tree-canvas')?.offsetHeight,
      transform: document.querySelector('#tree-content')?.getAttribute('transform'),
      zoomText: document.querySelector('.toolbar-zoom')?.textContent,
    })
  `});
  console.log('State:', r.result.value);

  // Click first node
  r = await send('Runtime.evaluate', {expression: `
    (function(){const n=document.querySelectorAll('.tree-node');if(n.length>0){n[0].click();return 'clicked '+n.length;}return 'no nodes';})()
  `});
  console.log('Click:', r.result.value);
  
  await new Promise(r => setTimeout(r, 1000));
  
  r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      hasPanel: !!document.querySelector('.tree-profile-panel'),
      familyLinks: document.querySelectorAll('.family-link').length,
      hasActions: !!document.querySelector('.tree-profile-actions'),
      panelText: (document.querySelector('.tree-profile-panel')?.innerText||'').substring(0,300),
    })
  `});
  console.log('Panel:', r.result.value);
  
  ws.close(); process.exit(0);
});
