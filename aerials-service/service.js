'use strict';
var Service=require('webos-service');
var SERVICE_ID=require('./package.json').name,APP_ID=SERVICE_ID.replace(/\.(aerials|service)$/,'');
var service=new Service(SERVICE_ID);
// Lives inside the package like the renewal service's state dir, so it is wiped by a
// reinstall; the launcher simply fills it again.
var cache=require('./cache').createCache({dir:__dirname+'/cache',log:function(){console.log.apply(console,arguments);}});

var activity=null;
// Keep the process alive while something is downloading; let it exit when idle.
function keepAlive(on){
 if(on&&!activity){activity='pending';service.activityManager.create('aerials-download',function(a){activity=a;});}
 else if(!on&&activity&&activity!=='pending'){service.activityManager.complete(activity,function(){});activity=null;}
}
cache.subscribe(function(s){keepAlive(!!s.downloading||cache.busy());});

function fromLauncher(m){
 try{var raw=m.ls2Message,id=raw&&raw.applicationID&&raw.applicationID();return typeof id==='string'&&id.split(' ')[0]===APP_ID;}catch(_){return false;}
}
function reply(m,s,subscribed){m.respond(Object.assign({returnValue:true,subscribed:!!subscribed},s));}

// Which app was in front, so a screensaver hand-off can return to it. Web apps may not ask the
// application manager (ACG) and a new SSAP pairing would prompt on the TV, so read what the
// Clean Your TV Home Helper already logs on every foreground change.
var fs=require('fs');
var HELPER_LOG='/media/developer/apps/usr/palm/applications/com.local.nativehome/state/controller.log';
function lastForeground(skip){
 var text;
 try{
  var fd=fs.openSync(HELPER_LOG,'r'),size=fs.fstatSync(fd).size,len=Math.min(size,16384),buf=Buffer.alloc(len);
  fs.readSync(fd,buf,0,len,size-len);fs.closeSync(fd);text=buf.toString('utf8');
 }catch(e){return null;}
 var lines=text.split('\n');
 for(var i=lines.length-1;i>=0;i--){
  var e;try{e=JSON.parse(lines[i]);}catch(_){continue;}
  if(e&&e.event==='foreground'&&typeof e.id==='string'&&e.id&&skip.indexOf(e.id)<0)return e.id;
 }
 return null;
}
service.register('foreground',function(m){
 if(!fromLauncher(m)){m.respond({returnValue:false,errorText:'caller-not-authorized'});return;}
 var skip=[APP_ID,'com.lfkdsk.aerials','com.webos.app.home'].concat((m.payload||{}).skip||[]);
 m.respond({returnValue:true,appId:lastForeground(skip)});
});

service.register('status',function(m){reply(m,cache.status());});
service.register('clear',function(m){
 if(!fromLauncher(m)){m.respond({returnValue:false,errorText:'caller-not-authorized'});return;}
 reply(m,cache.clear());
});
// sync {wanted:[{id,quality,url}]} — with subscribe:true the caller gets progress pushes
// while it stays subscribed (the launcher does this while it is on screen).
var subs=[];
service.register('sync',function(m){
 if(!fromLauncher(m)){m.respond({returnValue:false,errorText:'caller-not-authorized'});return;}
 var s=cache.sync((m.payload||{}).wanted);
 if(m.isSubscription){
  var off=cache.subscribe(function(st){reply(m,st,true);});
  subs.push({m:m,off:off});
 }
 reply(m,s,m.isSubscription);
},function(m){
 for(var i=subs.length-1;i>=0;i--)if(subs[i].m===m){subs[i].off();subs.splice(i,1);}
});
