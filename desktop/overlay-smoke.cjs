// GPL-3.0-or-later. Runs native windows in an isolated profile, without screen capture.
const assert=require('node:assert/strict');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const settle=window=>window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
exports.run=async c=>{
 const checks=[],wc=c.mainWindow.webContents,dir=c.path.resolve(__dirname,'../artifacts');await c.fs.mkdir(dir,{recursive:true});
 c.openMini();let mini=c.mini();for(let n=0;n<100&&(!mini.isVisible()||mini.webContents.isLoading());n++)await wait(30);await settle(mini);
 assert.equal(mini.isVisible(),true);
 // Real renderer buttons and preload IPC must control the native window.
 await mini.webContents.executeJavaScript('document.querySelector("#mini-close").click()');await wait(50);
 assert.equal(mini.isVisible(),false);assert.equal(c.state().visible,false);
 c.startViewing();assert.equal(mini.isVisible(),false);
 await c.sendSummary({status:'跟踪中',turn:'轮到我方 · 红方',move:'红方 · 车八进九',evaluation:'红方较优',hint:'测试',arrow:null});
 assert.equal(mini.isVisible(),false);checks.push('close stays closed through relocation and summaries');
 await wc.executeJavaScript('window.desktopAPI.toggleMini()');await settle(mini);assert.equal(mini.isVisible(),true);
 const hold=await wc.executeJavaScript('window.desktopAPI.prepareFrame()');assert.equal(mini.isVisible(),false);
 await wc.executeJavaScript('window.desktopAPI.closeMini()');await wc.executeJavaScript(`window.desktopAPI.restoreFrame(${hold})`);
 assert.equal(mini.isVisible(),false);checks.push('capture restoration cannot resurrect a closed overlay');
 await wc.executeJavaScript('window.desktopAPI.openMini()');await settle(mini);
 await mini.webContents.executeJavaScript('document.querySelector("#mini-lock").click()');await wait(50);
 assert.equal(c.state().locked,true);assert.equal(mini.isFocusable(),false);
 await wc.executeJavaScript('window.desktopAPI.setOverlayLock(false)');await settle(mini);
 assert.equal(c.state().locked,false);assert.equal(mini.isFocusable(),true);
 assert.equal(await mini.webContents.executeJavaScript('document.querySelector("#mini-lock").checked'),false);
 checks.push('click-through changes native focus and can be recovered from main IPC');
 c.resize(440,440);await settle(mini);c.save();const custom=mini.getBounds();c.startViewing();assert.deepEqual(mini.getBounds(),custom);
 c.closeMini();c.openMini();assert.deepEqual(mini.getBounds(),custom);checks.push('manual geometry survives reopening and relocation');
 await c.sendSummary({status:'跟踪中',turn:'轮到我方 · 红方',move:'红方 · 车八进九',evaluation:'红方较优（红方视角 2.84）',instruction:'把红车向上 9 格。',fromText:'第 2 列 · 第 10 行',toText:'第 2 列 · 第 1 行',hint:'留意对方下一步，沿绿色箭头走。',lastMove:'黑方刚走 象5进7',arrow:null});
 for(const [width,height] of [[300,260],[360,360],[500,520]]){
  c.resize(width,height);await settle(mini);const layout=await mini.webContents.executeJavaScript(`(()=>{const box=id=>{const b=document.querySelector(id).getBoundingClientRect();return {top:b.top,bottom:b.bottom,right:b.right,left:b.left};};return {width:innerWidth,height:innerHeight,close:box('#mini-close'),lock:box('.mini-lock'),grip:box('#mini-resize'),drag:getComputedStyle(document.querySelector('#mini-drag')).getPropertyValue('-webkit-app-region')};})()`);
  assert.ok(layout.lock.bottom<=layout.height&&layout.close.top>=0&&layout.grip.right<=layout.width);assert.equal(layout.drag,'drag');
  await c.fs.writeFile(c.path.join(dir,`overlay-${width}x${height}.png`),(await mini.webContents.capturePage()).toPNG());
 }
 c.resize(1,1);assert.deepEqual(mini.getSize(),[300,260]);c.resize(9999,9999);assert.ok(mini.getSize()[0]<=600&&mini.getSize()[1]<=680);checks.push('minimum, default and enlarged layouts retain close and interaction controls');
 await mini.webContents.executeJavaScript('window.desktopAPI.resetMiniSize()');assert.deepEqual(mini.getSize(),[360,360]);
 c.lock(true);c.closeMini();c.openMini();assert.equal(c.state().locked,false);assert.equal(mini.isFocusable(),true);checks.push('reopening a closed overlay restores mouse interaction');
 if(c.lab){
  await wc.loadURL('app://local/__overlay.html');
  const area=c.screen.getPrimaryDisplay().workArea;c.mainWindow.setBounds({x:area.x+30,y:area.y+20,width:1100,height:760});c.mainWindow.show();c.mainWindow.focus();
  mini.setBounds({x:area.x+30,y:area.y+20,width:360,height:360});c.save();mini.showInactive();
  // Keep the test surface behind the overlay so native clicks always have a safe target.
  mini.on('move',()=>c.mainWindow.setPosition(...mini.getPosition()));
  for(const event of ['move','resize'])mini.on(event,()=>console.log(JSON.stringify({event:'miniBounds',bounds:mini.getBounds()})));
  mini.on('hide',()=>console.log(JSON.stringify({event:'miniHidden'})));
  mini.webContents.on('console-message',event=>console.log('[mini]',event.message));
  await mini.webContents.executeJavaScript(`document.addEventListener('pointerdown',e=>console.log(JSON.stringify({pointerDown:e.target.id,client:[e.clientX,e.clientY],screen:[e.screenX,e.screenY]})));`);
  mini.focus();console.log(JSON.stringify({labReady:true,bounds:mini.getBounds(),display:area}));
 }
 return {checks};
};
