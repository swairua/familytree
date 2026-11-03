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
  await new Promise(r => setTimeout(r, 3000));
  await send('Runtime.enable');
  
  const r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      bodyText: document.body.innerText.substring(0, 400),
      hasSvg: !!document.querySelector('#tree-svg'),
      canvasW: document.querySelector('.tree-canvas')?.offsetWidth,
      canvasH: document.querySelector('.tree-canvas')?.offsetHeight,
      transform: document.querySelector('#tree-content')?.getAttribute('transform'),
    })
  `});
  console.log(r.result.value);
  ws.close(); process.exit(0);
});
