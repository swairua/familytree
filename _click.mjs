import WebSocket from 'ws';
const ws = new WebSocket(process.argv[2]);
let id = 1;
function send(m,p={}){return new Promise(r=>{const mid=id++;ws.send(JSON.stringify({id:mid,method:m,params:p}));const h=d=>{const msg=JSON.parse(d.toString());if(msg.id===mid){ws.removeListener('message',h);r(msg.result);}};ws.on('message',h);});}

ws.on('open', async () => {
  await send('Page.bringToFront');
  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.enable');
  
  // Use proper MouseEvent dispatch on SVG node
  let r = await send('Runtime.evaluate', {expression: `
    (function(){
      const node = document.querySelector('.tree-node');
      if (!node) return 'no nodes';
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      node.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true,
        clientX: cx, clientY: cy,
        view: window
      }));
      return 'dispatched at ' + cx + ',' + cy + ' name=' + node.querySelector('.node-name')?.textContent;
    })()
  `});
  console.log('Click:', r.result.value);
  
  await new Promise(r => setTimeout(r, 1500));
  
  r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      hasPanel: !!document.querySelector('.tree-profile-panel'),
      familyLinks: document.querySelectorAll('.family-link').length,
      hasActions: !!document.querySelector('.tree-profile-actions'),
      panelText: (document.querySelector('.tree-profile-panel')?.innerText||'').substring(0,400),
      fullDetailsBtn: !!document.querySelector('.btn-primary'),
    })
  `});
  console.log('Panel:', r.result.value);
  
  ws.close(); process.exit(0);
});
