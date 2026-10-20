const {app,BrowserWindow,desktopCapturer,ipcMain,protocol,net,session,screen,systemPreferences,shell,globalShortcut}=require('electron');
const {placeOverlay,isOwnSource,sanitizeArrow,sourceViewport,MINI_DEFAULT,MINI_LIMITS,constrainMini,gestureBounds}=require('./overlay-layout.cjs');
const path=require('node:path');const {pathToFileURL}=require('node:url');const fs=require('node:fs/promises');
const TRACKING_SMOKE=process.argv.includes('--tracking-smoke'),OVERLAY_SMOKE=process.argv.includes('--overlay-smoke'),OVERLAY_LAB=process.argv.includes('--overlay-lab');
const LIVE_DEBUG=process.argv.includes('--live-debug'),RELEASE_SELF_TEST=process.argv.includes('--release-self-test');
const APP_ORIGIN='app://local',ROOT=path.resolve(__dirname,'../dist'),MODEL_SELF_TEST=process.argv.includes('--model-self-test'),CAPTURE_SMOKE=process.argv.includes('--capture-smoke'),SMOKE=process.argv.includes('--smoke')||CAPTURE_SMOKE||TRACKING_SMOKE||OVERLAY_SMOKE||OVERLAY_LAB;
let captureHold=null,captureSerial=0,overlayLocked=false,overlayLayout=null;
let miniWanted=null,miniSaved=null,miniGesture=null,miniSaveTimer=null,miniSaveTask=Promise.resolve();
let mainWindow,miniWindow,arrowWindow,arrowReady,arrowRevision=0,lastSources=[],selectedSource=null,summary={status:'未开始跟踪',move:'—',evaluation:'等待分析',hint:'点击主窗口“读取屏幕”开始跟踪'};
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
app.setName('象棋屏幕助手');
if(SMOKE||MODEL_SELF_TEST||RELEASE_SELF_TEST){const testProfile=path.join(app.getPath('temp'),'xq-desktop-smoke-'+process.pid);require('node:fs').mkdirSync(testProfile,{recursive:true});app.setPath('userData',testProfile);}
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{mainWindow?.show();mainWindow?.focus();});
const isLocal=url=>{try{const u=new URL(url);return u.protocol==='app:'&&u.host==='local';}catch{return false;}};
function trusted(event){if(!event.senderFrame||!isLocal(event.senderFrame.url)||![mainWindow?.webContents,miniWindow?.webContents,arrowWindow?.webContents].includes(event.sender))throw Error('拒绝非本机页面的请求');}
function handle(name,fn){ipcMain.handle(name,(event,...args)=>{trusted(event);return fn(event,...args);});}
function makeWindow(options){const w=new BrowserWindow({...options,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});w.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\/(www\.)?(github\.com|npmjs\.com|electronjs\.org|huggingface\.co)\//.test(url))shell.openExternal(url);else if(isLocal(url)){const child=makeWindow({width:850,height:760,title:'开源组件与许可',parent:mainWindow});child.loadURL(url);}return {action:'deny'};});w.webContents.on('will-navigate',(event,url)=>{if(!isLocal(url))event.preventDefault();});return w;}
function positionMini(){if(!miniWindow)return;
 if(miniSaved){miniWindow.setBounds(constrainMini(miniSaved,screen.getDisplayMatching(miniSaved).workArea));return;}
 const source=lastSources.find(s=>s.id===overlayLayout?.sourceId);const display=screen.getAllDisplays().find(d=>String(d.id)===source?.display_id)||screen.getDisplayNearestPoint(screen.getCursorScreenPoint());let board=null;
 if(source?.id.startsWith('screen:')&&overlayLayout?.board){const r=overlayLayout.board,d=display.bounds;board={x:d.x+r.x*d.width,y:d.y+r.y*d.height,width:r.width*d.width,height:r.height*d.height};}
 miniWindow.setBounds(placeOverlay(display.workArea,board,MINI_DEFAULT));
}
function miniState(){return {visible:miniWanted===true,locked:overlayLocked};}
function publishMiniState(){mainWindow?.webContents.send('desktop:mini-state',miniState());}
function saveMini(){if(!miniWindow)return;miniSaved=miniWindow.getBounds();const data=JSON.stringify(miniSaved);miniSaveTask=miniSaveTask.then(()=>fs.writeFile(path.join(app.getPath('userData'),'overlay-window.json'),data)).catch(()=>{});}
function endMiniGesture(){if(!miniGesture)return;if(OVERLAY_LAB)console.log('[gesture] end');clearTimeout(miniGesture.timeout);miniGesture=null;saveMini();}
const validPointer=p=>p&&[p.x,p.y].every(v=>Number.isFinite(v)&&Math.abs(v)<100000);
function updateMiniGesture(point){
 if(!miniGesture||!miniWindow)return;
 if(OVERLAY_LAB&&point)console.log('[gesture] move',JSON.stringify(point));
 if(validPointer(point))miniGesture.point=point;
 const {start,origin,mode,point:cursor}=miniGesture;
 const area=mode==='move'?screen.getDisplayNearestPoint(cursor).workArea:screen.getDisplayMatching(start).workArea;
 const bounds=gestureBounds(start,origin,cursor,mode,area),current=miniWindow.getBounds();
 if(['x','y','width','height'].some(k=>current[k]!==bounds[k]))miniWindow.setBounds(bounds);
}
function beginMiniGesture(mode,point){
 if(OVERLAY_LAB)console.log('[gesture] begin',mode,JSON.stringify(point),miniWindow?.isVisible(),overlayLocked);
 if(!miniWindow?.isVisible()||overlayLocked||!['move','resize'].includes(mode)||!validPointer(point))return false;
 endMiniGesture();miniGesture={mode,start:miniWindow.getBounds(),origin:point,point};
 miniGesture.timeout=setTimeout(endMiniGesture,30000);return true;
}
function resizeMini(width,height){
 if(!miniWindow||overlayLocked)return;
 const current=miniWindow.getBounds();miniWindow.setBounds(constrainMini({...current,width,height},screen.getDisplayMatching(current).workArea));saveMini();
}
function showMini(){
 if(!miniWindow||!miniWanted)return;
 // AppKit can shift a borderless window when it becomes visible again.
 const bounds=miniWindow.getBounds();miniWindow.showInactive();miniWindow.setBounds(bounds);
}
function openMini(reposition=false){
 miniWanted=true;
 if(miniWindow){if(reposition)positionMini();showMini();publishMiniState();return;}
 miniWindow=makeWindow({...MINI_DEFAULT,...MINI_LIMITS,title:'象棋屏幕助手 · 悬浮局势',alwaysOnTop:true,resizable:true,maximizable:false,fullscreenable:false,acceptFirstMouse:true,frame:false,backgroundColor:'#fffdf7',hasShadow:true,skipTaskbar:true,show:false,autoHideMenuBar:true});
 miniWindow.setAlwaysOnTop(true,'floating');if(process.platform==='darwin')miniWindow.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
 positionMini();miniWindow.once('ready-to-show',showMini);miniWindow.loadURL(APP_ORIGIN+'/mini.html');
 miniWindow.on('blur',endMiniGesture);miniWindow.on('hide',endMiniGesture);
 for(const event of ['will-move','will-resize'])miniWindow.on(event,(_event,bounds)=>{miniSaved=bounds;clearTimeout(miniSaveTimer);miniSaveTimer=setTimeout(saveMini,200);});
 miniWindow.on('close',()=>{endMiniGesture();miniWanted=false;});
 miniWindow.on('closed',()=>{miniWindow=null;overlayLocked=false;publishMiniState();});
 publishMiniState();
}
function toggleOverlayLock(value){endMiniGesture();overlayLocked=miniWanted===true&&(typeof value==='boolean'?value:!overlayLocked);miniWindow?.setMovable(!overlayLocked);miniWindow?.setResizable(!overlayLocked);miniWindow?.setFocusable(!overlayLocked);miniWindow?.setIgnoreMouseEvents(overlayLocked);miniWindow?.webContents.send('desktop:overlay-lock',overlayLocked);publishMiniState();return overlayLocked;}
function closeMini(){miniWanted=false;endMiniGesture();toggleOverlayLock(false);miniWindow?.hide();publishMiniState();return miniState();}
function restoreCapture(id){if(!captureHold||captureHold.id!==id)return;clearTimeout(captureHold.timer);const windows=captureHold.windows;captureHold=null;windows.forEach(w=>{if(!w.isDestroyed()&&(w!==miniWindow||miniWanted===true)&&(w!==arrowWindow||summary.status==='跟踪中'&&summary.arrow)){if(w===miniWindow)showMini();else w.showInactive();}});}
function startViewing(layout){if(layout)overlayLayout=layout;if(captureHold){clearTimeout(captureHold.timer);captureHold=null;}if(miniWanted!==false)openMini(true);mainWindow.hide();}
function showMain(){if(process.platform==='darwin'&&!mainWindow.isVisibleOnAllWorkspaces())mainWindow.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});mainWindow.webContents.send('desktop:command','review');toggleOverlayLock(false);mainWindow.show();mainWindow.focus();}

function displayForArrow(value){const source=lastSources.find(s=>s.id===value.arrow?.sourceId),displays=screen.getAllDisplays();return displays.find(d=>String(d.id)===source?.display_id)||(displays.length===1?displays[0]:null);}
function arrowSummary(value){if(!value.arrow||!arrowWindow)return value;const display=displayForArrow(value);return display?{...value,arrow:{...value.arrow,viewport:sourceViewport(display.bounds,arrowWindow.getBounds(),value.arrow.width,value.arrow.height)}}:{...value,arrow:null};}
async function sendSummary(value){summary=value;miniWindow?.webContents.send('desktop:summary',summary);const revision=++arrowRevision;const display=displayForArrow(value);if(!value.arrow||value.status!=='跟踪中'||!display){arrowWindow?.hide();arrowWindow?.webContents.send('desktop:summary',{arrow:null});return {arrowVisible:false};}
 if(!arrowWindow){arrowWindow=makeWindow({x:display.bounds.x,y:display.bounds.y,width:display.bounds.width,height:display.bounds.height,title:'象棋走法箭头',type:'panel',enableLargerThanScreen:true,frame:false,transparent:true,hasShadow:false,show:false,focusable:false,resizable:false,skipTaskbar:true,alwaysOnTop:true});arrowWindow.setAlwaysOnTop(true,'floating');arrowWindow.setIgnoreMouseEvents(true);if(process.platform==='darwin')arrowWindow.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});arrowReady=arrowWindow.loadURL(APP_ORIGIN+'/arrow.html');for(const event of ['move','resize'])arrowWindow.on(event,()=>arrowWindow?.webContents.send('desktop:summary',arrowSummary(summary)));arrowWindow.on('closed',()=>{arrowWindow=null;arrowReady=null;});}
 await arrowReady;if(revision!==arrowRevision)return {arrowVisible:false};arrowWindow.setBounds(display.bounds);arrowWindow.webContents.send('desktop:summary',arrowSummary(value));arrowWindow.showInactive();return {arrowVisible:true};
}
app.whenReady().then(async()=>{
 try{const saved=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'overlay-window.json'),'utf8'));if(['x','y','width','height'].every(k=>Number.isFinite(saved[k])))miniSaved=saved;}catch{}
 if(LIVE_DEBUG)console.log('[displays]',JSON.stringify(screen.getAllDisplays()));
 if(MODEL_SELF_TEST){const {infer}=require('./model-runtime.cjs');const pose=await infer('pose',new Float32Array(3*256*256)),layout=await infer('layout',new Float32Array(3*315*280));if(pose[0].data.length!==2048||layout[0].data.length!==1440)throw Error('模型自检尺寸无效');console.log(JSON.stringify({modelRuntime:true,version:app.getVersion(),pose:pose.map(o=>o.dims),layout:layout.map(o=>o.dims)}));app.exit(0);return;}

 protocol.handle('app',async request=>{
  try{const u=new URL(request.url);if(u.host!=='local'||!['GET','HEAD'].includes(request.method))return new Response('Forbidden',{status:403});
   let root=ROOT,relative=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname);
   if(app.isPackaged&&(u.pathname==='/source.zip'||u.pathname.startsWith('/compliance/'))){root=process.resourcesPath;relative=decodeURIComponent(u.pathname);}
   if(TRACKING_SMOKE&&u.pathname==='/__tracking-test.js'){root=path.resolve(__dirname,'../tests');relative='/tracking-stream.js';}
   if((OVERLAY_SMOKE||OVERLAY_LAB)&&u.pathname==='/__overlay.html'){root=__dirname;relative='/overlay-fixture.html';}
   if(SMOKE&&u.pathname==='/__smoke.js'){root=__dirname;relative='/smoke-renderer.js';}
   if(SMOKE&&u.pathname==='/__capture.html')return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>象棋测试棋盘</title></head><body style="margin:0;padding:40px;background:#e9ede9;cursor:none"><canvas id="test" width="460" height="511"></canvas><script>const img=new Image(),ctx=document.querySelector('canvas').getContext('2d');img.onload=()=>ctx.drawImage(img,0,0);img.src='/__fixture.jpg';window.advance=()=>{ctx.drawImage(img,112,360,46,46,61,360,46,46);ctx.drawImage(img,61,360,46,46,214,360,46,46);};</script></body></html>`,{headers:{'Content-Type':'text/html'}});
   if(SMOKE&&u.pathname==='/__recognition.js'){root=path.resolve(__dirname,'../tests');relative='/recognition-fixtures.js';}
   if(SMOKE&&u.pathname==='/__traditional.png'){root=path.resolve(__dirname,'../evaluation/private/licensing-fixtures');relative='/traditional-board.png';}
   if(SMOKE&&u.pathname==='/__fixture.jpg'){root=path.resolve(__dirname,'../evaluation/private/licensing-fixtures');relative='/board-screenshot.jpg';}
   const file=path.resolve(root,'.'+relative),rel=path.relative(root,file);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))return new Response('Forbidden',{status:403});
   const response=await net.fetch(pathToFileURL(file).toString());const headers=new Headers(response.headers);
   headers.set('Cross-Origin-Opener-Policy','same-origin');headers.set('Cross-Origin-Embedder-Policy','require-corp');headers.set('Cross-Origin-Resource-Policy','same-origin');
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.gz':'application/gzip','.woff':'font/woff','.zip':'application/zip','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};if(types[path.extname(file)])headers.set('Content-Type',types[path.extname(file)]);
   if(path.extname(file)==='.zip')headers.set('Content-Disposition','attachment; filename="xiangqi-source-'+app.getVersion()+'.zip"');
   headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; media-src 'self' blob:; object-src 'none'; frame-src 'none'");
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }catch{return new Response('Not found',{status:404});}
 });
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback,details)=>{
  const videoOnly=!details.mediaTypes?.includes('audio');
  callback(wc===mainWindow?.webContents&&isLocal(wc.getURL())&&['display-capture','media'].includes(permission)&&Boolean(selectedSource)&&videoOnly);
 });
 session.defaultSession.setPermissionCheckHandler((wc,permission,origin)=>Boolean(wc===mainWindow?.webContents&&isLocal(wc.getURL())&&['display-capture','media'].includes(permission)&&isLocal(origin)&&selectedSource));
 session.defaultSession.setDisplayMediaRequestHandler((request,callback)=>{const source=selectedSource;selectedSource=null;if(!isLocal(request.securityOrigin)||!source||request.audioRequested){callback({});return;}callback({video:source});});

 handle('desktop:debug-frame',async(event,kind,data)=>{if(!LIVE_DEBUG||event.sender!==mainWindow?.webContents||!['clean','overlay','changed'].includes(kind)||typeof data!=='string'||data.length>35000000||!data.startsWith('data:image/png;base64,'))return;const dir=app.isPackaged?path.join(app.getPath('userData'),'diagnostics'):path.resolve(__dirname,'../evaluation/private');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'live-'+kind+'.png'),Buffer.from(data.split(',')[1],'base64'));});
 handle('desktop:trace',(event,value)=>{if(LIVE_DEBUG&&event.sender===mainWindow?.webContents&&JSON.stringify(value).length<3000){const line=JSON.stringify({time:new Date().toISOString(),...value});console.log('[live]',line);const dir=app.isPackaged?path.join(app.getPath('userData'),'diagnostics'):path.resolve(__dirname,'../evaluation/private');fs.mkdir(dir,{recursive:true}).then(()=>fs.appendFile(path.join(dir,'live-session.jsonl'),line+'\n')).catch(()=>{});}});
 handle('desktop:model-infer',(event,kind,input)=>{if(event.sender!==mainWindow?.webContents)throw Error('识别请求来源无效');return require('./model-runtime.cjs').infer(kind,input);});
 handle('desktop:sources',async()=>{
  const permission=process.platform==='darwin'?systemPreferences.getMediaAccessStatus('screen'):'granted';
  lastSources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:360,height:220},fetchWindowIcons:false});
  const ownIds=[mainWindow,miniWindow,arrowWindow].filter(Boolean).map(w=>w.getMediaSourceId());
  return {permission:process.platform==='darwin'?systemPreferences.getMediaAccessStatus('screen'):permission,sources:lastSources.filter(s=>!isOwnSource(s,ownIds)).map(s=>({id:s.id,name:s.name,displayId:s.display_id,thumbnail:s.thumbnail.toDataURL()}))};
 });
 handle('desktop:select',(_event,id)=>{if(typeof id!=='string')throw Error('采集来源无效');selectedSource=lastSources.find(s=>s.id===id);if(!selectedSource)throw Error('来源已失效，请重新选择');return true;});
 handle('desktop:still',async(_event,id,width,height)=>{
  if(!lastSources.some(s=>s.id===id)||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096)throw Error('截图来源或尺寸无效');
  const sources=await desktopCapturer.getSources({types:[id.startsWith('screen:')?'screen':'window'],thumbnailSize:{width,height},fetchWindowIcons:false});
  const source=sources.find(s=>s.id===id);if(!source||source.thumbnail.isEmpty())throw Error('没有收到当前画面');return source.thumbnail.toDataURL();
 });
 handle('desktop:occlusions',(_event,id)=>{
  const source=lastSources.find(s=>s.id===id);if(!source||!id.startsWith('screen:'))return [];
  const display=screen.getAllDisplays().find(d=>String(d.id)===source.display_id);if(!display)return [];
  return [mainWindow,miniWindow].filter(w=>w&&!w.isDestroyed()&&w.isVisible()&&!w.isMinimized()).map(w=>{const b=w.getBounds(),d=display.bounds;return {x:(b.x-d.x)/d.width,y:(b.y-d.y)/d.height,width:b.width/d.width,height:b.height/d.height};});
 });
 handle('desktop:summary',(_event,value)=>{if(!value||JSON.stringify(value).length>6000)throw Error('提示数据无效');const clean={};for(const key of ['status','move','evaluation','hint','level','detail','instruction','fromText','toText','coordinateNote','arrowNote','turn','turnSide','mySide','lastMove'])clean[key]=String(value[key]||'').slice(0,500);clean.arrow=sanitizeArrow(value.arrow,overlayLayout?.sourceId);return sendSummary(clean);});
 handle('desktop:get-summary',event=>event.sender===arrowWindow?.webContents?arrowSummary(summary):summary);
 handle('desktop:prepare-frame',()=>{
  if(captureHold)restoreCapture(captureHold.id);const id=++captureSerial,windows=[mainWindow,miniWindow,arrowWindow].filter(w=>w?.isVisible());windows.forEach(w=>w.hide());
  captureHold={id,windows,timer:setTimeout(()=>restoreCapture(id),4000)};return id;
 });
 handle('desktop:restore-frame',(_event,id)=>restoreCapture(id));
 handle('desktop:view',(_event,layout)=>{if(layout){if(!lastSources.some(s=>s.id===layout.sourceId))throw Error('读取来源已失效');const r=layout.board;if(r&&['x','y','width','height'].some(k=>!Number.isFinite(r[k])||r[k]<0||r[k]>1))throw Error('棋盘范围无效');}startViewing(layout);});
 handle('desktop:hide',()=>startViewing());
 handle('desktop:overlay-lock',(_event,value)=>toggleOverlayLock(Boolean(value)));
 handle('desktop:get-overlay-lock',()=>overlayLocked);
 handle('desktop:mini-state',()=>miniState());
 handle('desktop:mini-close',()=>closeMini());
 handle('desktop:mini-toggle',()=>{if(miniWanted===true)return closeMini();openMini();toggleOverlayLock(false);return miniState();});
 handle('desktop:mini-gesture',(event,mode,point)=>event.sender===miniWindow?.webContents&&beginMiniGesture(mode,point));
 handle('desktop:mini-move-gesture',(event,point)=>{if(event.sender===miniWindow?.webContents&&validPointer(point))updateMiniGesture(point);});
 handle('desktop:mini-end-gesture',event=>{if(event.sender===miniWindow?.webContents){updateMiniGesture();endMiniGesture();}});
 handle('desktop:mini-reset-size',()=>resizeMini(MINI_DEFAULT.width,MINI_DEFAULT.height));
 handle('desktop:mini-resize-by',(event,dx,dy)=>{if(event.sender!==miniWindow?.webContents||![dx,dy].every(v=>Number.isFinite(v)&&Math.abs(v)<=50))return;const b=miniWindow.getBounds();resizeMini(b.width+dx,b.height+dy);});
 handle('desktop:settings',()=>{if(process.platform==='darwin')shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');});
 handle('desktop:mini',()=>{openMini();toggleOverlayLock(false);});
 handle('desktop:show',()=>showMain());
 handle('desktop:pause',()=>mainWindow.webContents.send('desktop:command','pause'));
 handle('desktop:stop',()=>mainWindow.webContents.send('desktop:command','stop'));
 handle('desktop:restart',()=>{showMain();mainWindow.webContents.send('desktop:command','restart');});

 mainWindow=makeWindow({width:1340,height:940,minWidth:1040,minHeight:720,title:'象棋屏幕助手',backgroundColor:'#f4f1e9',autoHideMenuBar:true,show:!SMOKE&&!RELEASE_SELF_TEST});
 if(SMOKE||LIVE_DEBUG)mainWindow.webContents.on('console-message',event=>console.log('[renderer]',event.message));
 await mainWindow.loadURL(APP_ORIGIN+(SMOKE?'/?smoke=1':LIVE_DEBUG?'/?liveDebug=1':'/'));
 if(RELEASE_SELF_TEST){try{
  if(app.isPackaged){const noticeRoot=process.platform==='darwin'?process.resourcesPath:path.dirname(process.execPath);for(const name of ['LICENSE.electron.txt','LICENSES.chromium.html']){const info=await fs.stat(path.join(noticeRoot,name));if(!info.size)throw Error('Missing packaged Electron notice: '+name);}}
  const result=await mainWindow.webContents.executeJavaScript(`(async()=>{
   await window.rulesReady;if(!crossOriginIsolated||!window.desktopAPI)throw Error('release UI initialization failed');
   const html=await (await fetch('/licenses.html')).text(),doc=new DOMParser().parseFromString(html,'text/html');
   const links=[...new Set([...doc.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(h=>h.startsWith('/')))];
   for(const href of links){const r=await fetch(href,{method:'HEAD'});if(!r.ok)throw Error('broken release license/source link: '+href+' '+r.status);}
   const source=new Uint8Array(await (await fetch('/source.zip')).arrayBuffer());if(source[0]!==80||source[1]!==75)throw Error('source is not a ZIP');
   const pose=await window.desktopAPI.modelInfer('pose',new Float32Array(3*256*256));if(pose[0].data.length!==2048)throw Error('release model failed');
   const layout=await window.desktopAPI.modelInfer('layout',new Float32Array(3*315*280));if(layout[0].data.length!==1440)throw Error('release layout model failed');
   const {AnalysisEngine}=await import('/engine-client.js');const engine=new AnalysisEngine(()=>{});let done,error;
   engine.onEvent=e=>{if(e.type==='done')done=e;if(e.type==='error')error=e.text;};
   try{await engine.analyze({baseFen:'4k4/3R1R3/2N1P4/9/9/9/9/9/9/4K4 w - - 0 1',moves:[]},{time:200,hash:16,multi:false,strength:'enhanced'});for(let i=0;i<300&&!done&&!error;i++)await new Promise(r=>setTimeout(r,50));if(error||!done||done.mode!=='enhanced')throw Error(error||'release enhanced engine failed');}finally{engine.reset();}
   return {licenseLinks:links.length,sourceZipBytes:source.length,model:true,engine:done.mode,bestmove:done.bestmove};
  })()`);
  console.log(JSON.stringify({releaseSelfTest:true,version:app.getVersion(),...result}));app.exit(0);
 }catch(e){console.error(e);app.exit(1);}return;}
 globalShortcut.register('CommandOrControl+Shift+O',()=>{if(miniWanted!==true){openMini();toggleOverlayLock(false);}else toggleOverlayLock();});
 globalShortcut.register('CommandOrControl+Shift+X',()=>mainWindow.webContents.send('desktop:command','pause'));
 mainWindow.on('closed',()=>{mainWindow=null;miniWindow?.close();arrowWindow?.close();});
 if(OVERLAY_SMOKE||OVERLAY_LAB){try{
  const result=await require('./overlay-smoke.cjs').run({mainWindow,openMini,closeMini,startViewing,sendSummary,mini:()=>miniWindow,state:miniState,lock:toggleOverlayLock,resize:resizeMini,save:saveMini,position:positionMini,screen,fs,path,lab:OVERLAY_LAB});
  console.log(JSON.stringify({overlaySmoke:true,...result}));if(!OVERLAY_LAB)app.exit(0);
 }catch(e){console.error(e);app.exit(1);}return;}
 if(TRACKING_SMOKE){try{
  const display=screen.getPrimaryDisplay(),sourceId='screen:tracking-test:0';lastSources.push({id:sourceId,display_id:String(display.id)});
  const result=await mainWindow.webContents.executeJavaScript(`import('/__tracking-test.js').then(m=>m.run(${JSON.stringify(sourceId)}))`);
  const dir=path.resolve(__dirname,'../artifacts');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'tracking-desktop.png'),(await mainWindow.webContents.capturePage()).toPNG());
  if(miniWindow)await fs.writeFile(path.join(dir,'tracking-overlay.png'),(await miniWindow.webContents.capturePage()).toPNG());
  console.log(JSON.stringify(result,null,2));app.exit(0);
 }catch(e){console.error(e);await fs.writeFile(path.resolve(__dirname,'../artifacts/tracking-failed.png'),(await mainWindow.webContents.capturePage()).toPNG()).catch(()=>{});app.exit(1);}return;}
 if(SMOKE){let fixture;try{const permission=process.platform==='darwin'?systemPreferences.getMediaAccessStatus('screen'):'granted';if(CAPTURE_SMOKE&&permission==='granted'){fixture=makeWindow({x:20,y:60,width:620,height:720,title:'象棋测试棋盘'});await fixture.loadURL(APP_ORIGIN+'/__capture.html');if(process.platform==='darwin')fixture.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});fixture.setAlwaysOnTop(true,'floating');fixture.show();fixture.focus();}
 const result=await mainWindow.webContents.executeJavaScript(`import('/__smoke.js').then(m=>m.run(${Boolean(CAPTURE_SMOKE&&fixture)},${JSON.stringify(fixture?.getMediaSourceId()||'')}))`,Boolean(CAPTURE_SMOKE&&fixture));if(CAPTURE_SMOKE&&fixture){result.uiTracking=await mainWindow.webContents.executeJavaScript(`import('/__smoke.js').then(m=>m.runUI(${JSON.stringify(fixture.getMediaSourceId())}))`,true);await fixture.webContents.executeJavaScript('window.advance()');await fs.mkdir(path.resolve(__dirname,'../artifacts'),{recursive:true});await fs.writeFile(path.resolve(__dirname,'../artifacts/test-advanced.png'),(await fixture.webContents.capturePage()).toPNG());result.overlay={mainHidden:!mainWindow.isVisible(),visible:miniWindow?.isVisible(),allWorkspaces:process.platform==='darwin'?miniWindow?.isVisibleOnAllWorkspaces():undefined};if(!result.overlay.mainHidden||!result.overlay.visible)throw Error('automatic overlay handoff failed');result.liveMove=await mainWindow.webContents.executeJavaScript("import('/__smoke.js').then(m=>m.checkLiveMove())");}
 const previousSummary=summary,previousLayout=overlayLayout,display=screen.getPrimaryDisplay(),testId='screen:test-arrow:0';lastSources.push({id:testId,display_id:String(display.id)});overlayLayout={sourceId:testId};const testArrow={sourceId:testId,width:display.bounds.width*2,height:display.bounds.height*2,from:[display.bounds.width*.6,display.bounds.height*.7],to:[display.bounds.width*1.4,display.bounds.height*.7],step:100};const arrowShown=await sendSummary({status:'跟踪中',move:'红方 · 炮八平五',evaluation:'双方接近均衡',hint:'留意对方的下一步',instruction:'把红炮向右 3 格。',fromText:'第 2 列 · 第 8 行',toText:'第 5 列 · 第 8 行',coordinateNote:'列从左往右、行从上往下数',arrow:testArrow});if(!arrowShown.arrowVisible)throw Error('native arrow did not open');const arrowBounds=arrowWindow.getBounds();const arrowViewport=sourceViewport(display.bounds,arrowBounds,testArrow.width,testArrow.height);result.arrowBounds={actual:arrowBounds,display:display.bounds,viewport:arrowViewport};arrowWindow.hide();await arrowWindow.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const actualViewport=await arrowWindow.webContents.executeJavaScript('(()=>{const v=document.querySelector("svg").viewBox.baseVal;return {x:v.x,y:v.y,width:v.width,height:v.height};})()');if(['x','y','width','height'].some(k=>Math.abs(actualViewport[k]-arrowViewport[k])>.1))throw Error('native arrow viewport not aligned');const arrowPng=await arrowWindow.webContents.capturePage();await fs.writeFile(path.resolve(__dirname,'../artifacts/desktop-arrow.png'),arrowPng.toPNG());if(miniWindow){await miniWindow.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await fs.writeFile(path.resolve(__dirname,'../artifacts/desktop-guide.png'),(await miniWindow.webContents.capturePage()).toPNG());}overlayLayout=previousLayout;lastSources=lastSources.filter(s=>s.id!==testId);await sendSummary({...previousSummary,arrow:null});result.nativeArrow=true;const preview=await mainWindow.webContents.executeJavaScript('globalThis.__arrowPreview');if(preview)await fs.writeFile(path.resolve(__dirname,'../artifacts/chess-arrow-example.png'),Buffer.from(preview.split(',')[1],'base64'));
 result.screenPermission=permission;result.actualCapture=CAPTURE_SMOKE?(fixture?result.actualCapture:'skipped: screen permission not granted'):'not attempted';fixture?.close();console.log(JSON.stringify({...result,iconData:result.iconData?'generated':undefined},null,2));const png=await mainWindow.webContents.capturePage();const dir=path.resolve(__dirname,'../artifacts');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'desktop-smoke.png'),png.toPNG());if(result.iconData){await fs.writeFile(path.join(__dirname,'icon.png'),Buffer.from(result.iconData.split(',')[1],'base64'));}app.exit(0);}catch(e){console.error(e);const capture=await mainWindow.webContents.executeJavaScript('globalThis.__captureImage').catch(()=>null);if(capture){const dir=path.resolve(__dirname,'../artifacts');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'capture-debug.png'),Buffer.from(capture.split(',')[1],'base64'));}const calibrationImage=await mainWindow.webContents.executeJavaScript('globalThis.__calibrationImage').catch(()=>null);if(calibrationImage)await fs.writeFile(path.resolve(__dirname,'../artifacts/calibration-debug.png'),Buffer.from(calibrationImage.split(',')[1],'base64'));const raw=await mainWindow.webContents.executeJavaScript('globalThis.__rawCalibrationImage').catch(()=>null);if(raw)await fs.writeFile(path.resolve(__dirname,'../artifacts/raw-calibration-debug.png'),Buffer.from(raw.split(',')[1],'base64'));app.exit(1);}}
}).catch(e=>{console.error(e);app.exit(1);});
app.on('will-quit',()=>globalShortcut.unregisterAll());
app.on('window-all-closed',()=>app.quit());
