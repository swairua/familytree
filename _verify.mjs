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
      hasApp: !!document.querySelector('.app'),
      hasAppBody: !!document.querySelector('.app-body'),
      hasSidebar: !!document.querySelector('.sidebar'),
      sidebarWidth: document.querySelector('.sidebar')?.offsetWidth,
      hasMainContent: !!document.querySelector('.main-content'),
      hasSvg: !!document.querySelector('#tree-svg'),
      nodeCount: document.querySelectorAll('.tree-node').length,
      sidebarNavItems: document.querySelectorAll('.sidebar-nav-item').length,
      sidebarTreeNodes: document.querySelectorAll('.sidebar-tree-node').length,
      bodySnippet: document.body.innerText.substring(0, 300),
    })
  `});
  console.log(r.result.value);
  ws.close(); process.exit(0);
});
