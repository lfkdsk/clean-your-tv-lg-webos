(function(){
 'use strict';
 var panel=document.createElement('section');panel.id='renewalPanel';panel.className='hidden';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Home settings');
 panel.innerHTML='<div class="renewal-card"><div class="renewal-heading"><h2>Home settings</h2><span class="renewal-beta">BETA</span></div><h3>Developer Mode auto-renewal</h3><p>Renew your Developer Mode session directly with LG. No external server or computer needed.</p><p class="renewal-warning">Real renewal on TVs without root still needs community validation. Keep checking your Developer Mode timer until renewal is confirmed. A TV that stays off or offline cannot renew.</p><div id="renewalStatus" aria-live="polite">Loading status…</div><div class="renewal-actions"><button id="renewalToggle">Enable Beta</button><button id="renewalCheck">Check session</button><button id="renewalDiagnostics">Diagnostics</button><button id="renewalUpdates">Software updates</button><button id="renewalTV">TV settings</button><button id="renewalSaver">航拍屏保</button><button id="renewalClose">Back</button></div><pre id="renewalDetails" class="hidden"></pre></div>';
 document.body.appendChild(panel);
 var status=document.getElementById('renewalStatus'),toggle=document.getElementById('renewalToggle'),check=document.getElementById('renewalCheck'),details=document.getElementById('renewalDetails');
 var buttons=Array.prototype.slice.call(panel.querySelectorAll('button')),index=0,state=null,busy=false;
 function openNow(){return !panel.classList.contains('hidden');}
 function focus(i){var direction=i<index?-1:1;for(var n=0;n<buttons.length;n++,i+=direction){var j=(i+buttons.length*2)%buttons.length;if(!buttons[j].disabled){index=j;buttons[index].focus();return;}}}
 function rpc(method,callback){
  var bridge,done=false,timer=setTimeout(function(){finish(null);},45000);
  function finish(r){if(done)return;done=true;clearTimeout(timer);if(bridge)try{bridge.cancel();}catch(_){}callback(r);}
  try{bridge=new PalmServiceBridge();bridge.onservicecallback=function(raw){try{finish(JSON.parse(raw));}catch(_){finish(null);}};bridge.call('luna://com.gathin.tvhome.renewal/'+method,'{}');}catch(_){finish(null);}
 }
 function date(v){return typeof v==='number'?new Date(v).toLocaleString():'Not yet';}
 var labels={healthy:'Session checked',renewed:'Renewal confirmed',retry:'Connection failed — retry scheduled',unverified:'LG response could not confirm renewal',expired:'Session expired — open Developer Mode',unavailable:'No readable Developer Mode session', 'session-changed':'Session changed — retry scheduled','storage-error':'Could not save state','internal-error':'Check failed'};
 function render(){
  toggle.textContent=state&&state.enabled?'Disable Beta':'Enable Beta';
  check.disabled=busy||!state||!state.enabled;toggle.disabled=busy||!state;
  if(!state)return;
  var last=state.last||{};
  var text=state.enabled?'Auto-renewal enabled (Beta)':'Auto-renewal off';
  if(last.status)text+='\n'+(labels[last.status]||'Check pending');
  if(typeof last.remainingSeconds==='number')text+=' · '+Math.floor(Math.max(0,last.remainingSeconds-(Date.now()-last.checkedAt)/1000)/3600)+' hours remaining (estimate)';
  text+='\nLast checked: '+date(last.checkedAt)+'\nLast confirmed renewal: '+date(state.lastRenewedAt);
  if(state.error==='disable-not-saved')text+='\nDisable could not be saved. Retry before restarting the service.';
  if(state.error)text+='\nSetup error: '+state.error+'. Use Developer Mode manually.';
  status.textContent=text;if(openNow())focus(index);
 }
 function action(method){if(busy)return;busy=true;status.textContent='Working…';toggle.disabled=true;check.disabled=true;
  rpc(method,function(r){busy=false;if(!r||r.returnValue!==true){state=null;status.textContent='Service unavailable. Install the complete Home package and try again. Manage your Developer Mode timer manually.';toggle.disabled=true;check.disabled=true;if(openNow())focus(index);return;}state=r.state;render();});
 }
 toggle.onclick=function(){if(state)action(state.enabled?'disable':'enable');};
 check.onclick=function(){action('check');};
 document.getElementById('renewalDiagnostics').onclick=function(){
  var last=state&&state.last||{};
  details.textContent='Share this with your TV model and firmware at:\ngithub.com/Razdva122/clean-your-tv-lg-webos/issues\n'+JSON.stringify({launcher:'1.2.0',beta:true,enabled:!!(state&&state.enabled),status:last.status||'not-checked',checkedAt:last.checkedAt||null,remainingSeconds:typeof last.remainingSeconds==='number'?last.remainingSeconds:null,lastRenewedAt:state&&state.lastRenewedAt||null,error:state&&state.error||null},null,2);
  details.classList.toggle('hidden');
 };
 function close(){panel.classList.add('hidden');}
 document.getElementById('renewalClose').onclick=close;
 document.getElementById('renewalSaver').onclick=function(){close();if(window.SaverPanel)window.SaverPanel.open();};
 document.getElementById('renewalUpdates').onclick=function(){close();window.HomeUpdates.open();};
 document.getElementById('renewalTV').onclick=function(){close();try{var b=new PalmServiceBridge();b.onservicecallback=function(){b.cancel();};b.call('luna://com.webos.applicationManager/launch',JSON.stringify({id:'com.palm.app.settings',params:{}}));}catch(_){}};
 buttons.forEach(function(b,i){b.addEventListener('mouseover',function(){focus(i);});});
 document.addEventListener('keydown',function(e){if(!openNow())return;var k=e.keyCode;
  if([37,38,39,40,13,461,27].indexOf(k)<0)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(k===461||k===27)close();else if(k===13){if(!e.repeat)buttons[index].click();}else focus(index+(k===37||k===38?-1:1));
 },true);
 window.RenewalPanel={isOpen:openNow,open:function(){panel.classList.remove('hidden');details.classList.add('hidden');focus(0);action('status');}};
 // No session request, token access or scheduler setup happens on launcher startup.
}());
