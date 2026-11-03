import WebSocket from 'ws';
const ws = new WebSocket(process.argv[2]);
let id = 1;
function send(m,p={}){return new Promise(r=>{const mid=id++;ws.send(JSON.stringify({id:mid,method:m,params:p}));const h=d=>{const msg=JSON.parse(d.toString());if(msg.id===mid){ws.removeListener('message',h);r(msg.result);}};ws.on('message',h);});}

ws.on('open', async () => {
  await send('Page.bringToFront');
  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.enable');
  
  // Click "Full Details" button
  let r = await send('Runtime.evaluate', {expression: `
    (function(){
      const btn = document.querySelector('.tree-profile-actions .btn-primary');
      if (!btn) return 'no full details btn';
      btn.click();
      return 'clicked full details';
    })()
  `});
  console.log('Action:', r.result.value);
  
  await new Promise(r => setTimeout(r, 1500));
  
  // Check modal
  r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      hasModal: !!document.querySelector('.modal-overlay'),
      modalName: document.querySelector('.modal-content .profile-header h2')?.textContent?.substring(0,40),
      hasEditBtn: !!document.querySelector('.modal-edit'),
      sections: document.querySelectorAll('.profile-section').length,
      familyMembers: document.querySelectorAll('.family-member').length,
    })
  `});
  console.log('Modal:', r.result.value);
  
  // Close modal
  await send('Runtime.evaluate', {expression: `document.querySelector('.modal-close')?.click()`});
  await new Promise(r => setTimeout(r, 500));
  
  // Click a family link
  r = await send('Runtime.evaluate', {expression: `
    (function(){
      const link = document.querySelectorAll('.family-link')[0];
      if (!link) return 'no family links';
      link.click();
      return 'clicked: ' + link.textContent?.trim();
    })()
  `});
  console.log('Family link:', r.result.value);
  
  await new Promise(r => setTimeout(r, 1500));
  
  // Check panel updated
  r = await send('Runtime.evaluate', {expression: `
    JSON.stringify({
      panelName: document.querySelector('.tree-profile-panel h2')?.textContent,
      panelDates: document.querySelector('.tree-profile-dates')?.textContent?.substring(0,60),
    })
  `});
  console.log('Updated panel:', r.result.value);
  
  ws.close(); process.exit(0);
});
