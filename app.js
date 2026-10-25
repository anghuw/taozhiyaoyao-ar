import * as THREE from 'three';
import { MindARThree } from './node_modules/mind-ar/dist/mindar-image-three.prod.js';

/* 桃之夭夭 · 阳山水蜜桃 AR 互动包装 */
(function(){
  'use strict';
  var params = new URLSearchParams(location.search);
  var MODE = params.get('mode') || 'ar';
  var DUR = 28.2;
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('c');
  var ui = {
    scan: document.getElementById('scan'),
    scanline: document.getElementById('scanline'),
    toast: document.getElementById('toast'),
    hint: document.getElementById('hint'),
    hintText: document.getElementById('hintText'),
    tap: document.getElementById('tap'),
    start: document.getElementById('start'),
    loading: document.getElementById('loading'),
    startBtn: document.getElementById('startBtn'),
    startDemo: document.getElementById('startDemo'),
    startWarn: document.getElementById('startWarn'),
    ceTitle: document.getElementById('ceTitle'),
    ceMsg: document.getElementById('ceMsg'),
    ceTip: document.getElementById('ceTip'),
    copyBtn: document.getElementById('copyBtn'),
    retryBtn: document.getElementById('retryBtn'),
    demoBtn: document.getElementById('demoBtn'),
    qrintro: document.getElementById('qrintro'),
    qrScanline: document.getElementById('qrScanline'),
    qrOk: document.getElementById('qrOk'),
    actions: document.getElementById('actions'),
    infocard: document.getElementById('infocard'),
    bless: document.getElementById('bless'),
    gamehud: document.getElementById('gamehud'),
    peachLayer: document.getElementById('peachLayer'),
    score: document.getElementById('score'),
    badge: document.getElementById('badge'),
    crown: document.getElementById('crown'),
    flash: document.getElementById('flash'),
    polaroid: document.getElementById('polaroid'),
    polaroidImg: document.getElementById('polaroidImg'),
    saved: document.getElementById('saved'),
    endcard: document.getElementById('endcard'),
    fallback: document.getElementById('fallback')
  };
  var renderer, scene, camera, C = null;
  var tex = {};
  var ar = null, arDetected = false, arStart = 0, arTapAt = -99, arMode = false;
  var arAttempted = false;
  var inApp = /MicroMessenger|QQ\/|QQBrowser|Douyin|aweme|XiaoHongShu|XHS|Weibo|AlipayClient/i.test(navigator.userAgent || '');
  var startMs = performance.now();
  var camShake = 0.0025;
  var S = {
    now: 0, spinAt: -99, infoAt: -99, petalsAt: -99, gameAt: -99, photoAt: -99,
    charTapAt: -99, badgeAt: -99, gameHudUntil: 0, crown: false, gameOn: false,
    score: 0, caught: [false,false,false,false,false], demo: {}, photoDone: false
  };
  var peachEls = [];
  var GAME_START = [0.15, 0.75, 1.35, 1.95, 2.55];
  var GAME_X = [24, 47, 69, 36, 58];

  function resetExtras(){
    S.spinAt = -99; S.infoAt = -99; S.petalsAt = -99; S.gameAt = -99; S.photoAt = -99;
    S.charTapAt = -99; S.badgeAt = -99; S.crown = false; S.gameOn = false;
    S.score = 0; S.caught = [false,false,false,false,false];
    ui.actions.style.opacity = '0';
    ui.infocard.style.opacity = '0';
    ui.bless.style.opacity = '0';
    ui.gamehud.style.opacity = '0';
    ui.badge.style.opacity = '0';
    ui.crown.style.opacity = '0';
    ui.polaroid.style.opacity = '0';
    ui.flash.style.opacity = '0';
    ui.saved.style.opacity = '0';
    for(var i=0;i<peachEls.length;i++){ peachEls[i].style.opacity = '0'; }
  }

  function doSpin(now){ S.spinAt = now; }
  function doInfo(now){ S.infoAt = now; }
  function doPetals(now){ S.petalsAt = now; }
  function doPhoto(now){
    S.photoAt = now;
    var url = capturePhoto();
    if(url && ui.polaroidImg){ ui.polaroidImg.src = url; }
  }
  function charTap(now){ S.charTapAt = now; }

  function startGame(now){
    S.gameAt = now; S.gameOn = true; S.score = 0; S.caught = [false,false,false,false,false];
    S.crown = false; S.badgeAt = -99; S.gameHudUntil = now + 30;
    ui.score.textContent = '0';
    ui.gamehud.style.opacity = '1';
    ui.badge.style.opacity = '0';
    ui.crown.style.opacity = '0';
  }

  function catchPeach(i){
    if(!S.gameOn || S.caught[i]) return;
    var u = (S.now - S.gameAt - GAME_START[i]) / 2.0;
    if(u < -0.05 || u > 1.1) return;
    S.caught[i] = true; S.score++;
    ui.score.textContent = String(S.score);
    if(S.score >= 5){
      S.crown = true; S.gameOn = false; S.badgeAt = S.now; S.gameHudUntil = S.now + 0.8;
      for(var k=0;k<peachEls.length;k++){ peachEls[k].style.opacity = '0'; }
    }
  }

  function capturePhoto(){
    try{
      if(!arMode){
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/jpeg', 0.9);
      }
      var v = document.querySelector('#ar-root video');
      var c = document.createElement('canvas');
      var w = renderer.domElement.width, h = renderer.domElement.height;
      c.width = w; c.height = h;
      var x = c.getContext('2d');
      if(v && v.videoWidth){
        var s = Math.max(w / v.videoWidth, h / v.videoHeight);
        var dw = v.videoWidth * s, dh = v.videoHeight * s;
        x.drawImage(v, (w-dw)/2, (h-dh)/2, dw, dh);
      } else {
        x.fillStyle = '#ffe3ea'; x.fillRect(0,0,w,h);
      }
      x.drawImage(renderer.domElement, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.9);
    }catch(e){ return 'assets/ip-sticker.png'; }
  }

  function clamp(v,a,b){ return Math.min(b, Math.max(a, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function smoothstep(a,b,x){ var t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
  function easeOutCubic(t){ return 1 - Math.pow(1-t,3); }
  function easeOutBack(t){ var c1=1.70158, c3=c1+1; var p=t-1; return 1 + c3*p*p*p + c1*p*p; }
  function easeInOut(t){ return t<0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
  function op(el,v){ el.style.opacity = String(Math.max(0, Math.min(1, v))); }
  function rng(seed){ var s = seed >>> 0; return function(){ s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function canvasTex(w,h,draw){
    var cv = document.createElement('canvas'); cv.width=w; cv.height=h;
    var ctx = cv.getContext('2d'); draw(ctx,w,h);
    var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  var IMG_TIMEOUT = 8000;
  var ASSET_BUDGET = 12000;
  function imageTexture(img){
    var t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  }
  /* 单张图片：必须有自己的超时，否则弱网下请求悬挂会让开始按钮永久停在“资源加载中” */
  function loadImage(src, timeoutMs){
    return new Promise(function(resolve, reject){
      var img = new Image(), done = false;
      var timer = setTimeout(function(){
        if(done) return; done = true; img.src = ''; reject(new Error('timeout ' + src));
      }, timeoutMs || IMG_TIMEOUT);
      img.onload = function(){ if(done) return; done = true; clearTimeout(timer); resolve(img); };
      img.onerror = function(){ if(done) return; done = true; clearTimeout(timer); reject(new Error('error ' + src)); };
      img.src = src;
    });
  }
  /* 依次尝试多个候选（webp → png），共用一个总预算，避免逐个超时越拖越久 */
  function loadTexAny(srcs, budgetMs){
    var deadline = Date.now() + (budgetMs || ASSET_BUDGET);
    var i = 0;
    function next(){
      if(i >= srcs.length) return Promise.reject(new Error('all failed'));
      var left = deadline - Date.now();
      if(left <= 400) return Promise.reject(new Error('budget exhausted'));
      return loadImage(srcs[i++], Math.min(IMG_TIMEOUT, left)).then(imageTexture, next);
    }
    return next();
  }
  /* iOS 14 以下 / 老 Android WebView 不认 webp，先探测一次 */
  function detectWebp(){
    return new Promise(function(res){
      var img = new Image();
      img.onload = function(){ res(img.width === 2 && img.height === 1); };
      img.onerror = function(){ res(false); };
      img.src = 'data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=';
    });
  }
  function fallbackBoxTex(a, b){
    return canvasTex(512,512,function(c,w,h){
      var g = c.createLinearGradient(0,0,0,h);
      g.addColorStop(0,a); g.addColorStop(1,b);
      c.fillStyle = g; c.fillRect(0,0,w,h);
      c.fillStyle = 'rgba(168,22,70,0.9)';
      c.font = 'bold 64px "Microsoft YaHei",sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('桃之夭夭', w/2, h/2 - 24);
      c.font = '30px "Microsoft YaHei",sans-serif';
      c.fillStyle = 'rgba(168,22,70,0.6)';
      c.fillText('阳山水蜜桃', w/2, h/2 + 40);
    });
  }

  function makeRenderer(){
    renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, alpha:false, preserveDrawingBuffer:true, powerPreference:'high-performance'});
    renderer.setPixelRatio(MODE === 'demo' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.80;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  function radialTexture(inner, outer){
    return canvasTex(256,256,function(c,w,h){
      var g = c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
      g.addColorStop(0, inner); g.addColorStop(0.45, inner); g.addColorStop(1, outer);
      c.fillStyle = g; c.fillRect(0,0,w,h);
    });
  }

  function buildEnvironment(){
    var bg = canvasTex(768,1366,function(c,w,h){
      var g = c.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#fffaf6'); g.addColorStop(0.5,'#ffeaef'); g.addColorStop(1,'#ffd1de');
      c.fillStyle = g; c.fillRect(0,0,w,h);
      var r = c.createRadialGradient(w*0.5,h*0.36,10,w*0.5,h*0.36,w*0.85);
      r.addColorStop(0,'rgba(255,255,255,0.92)'); r.addColorStop(0.5,'rgba(255,244,246,0.35)'); r.addColorStop(1,'rgba(255,220,230,0)');
      c.fillStyle = r; c.fillRect(0,0,w,h);
      var r2 = c.createRadialGradient(w*0.5,h*0.12,5,w*0.5,h*0.12,w*0.6);
      r2.addColorStop(0,'rgba(255,236,220,0.55)'); r2.addColorStop(1,'rgba(255,236,220,0)');
      c.fillStyle = r2; c.fillRect(0,0,w,h);
    });
    scene.background = bg;
    scene.fog = new THREE.Fog(0xffd9e3, 7.5, 18);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40,40),
      new THREE.MeshStandardMaterial({color:0xffedf0, roughness:0.96, metalness:0})
    );
    ground.rotation.x = -Math.PI/2; ground.position.y = 0; ground.receiveShadow = true;
    scene.add(ground);

    var shTex = radialTexture('rgba(90,20,40,0.55)','rgba(90,20,40,0)');
    var blob = new THREE.Mesh(new THREE.PlaneGeometry(3.4,2.1), new THREE.MeshBasicMaterial({map:shTex, transparent:true, opacity:0.65, depthWrite:false}));
    blob.rotation.x = -Math.PI/2; blob.position.set(0,0.006,0.05); scene.add(blob);

    var bokehTex = radialTexture('rgba(255,255,255,0.9)','rgba(255,255,255,0)');
    var rnd = rng(77);
    for(var i=0;i<14;i++){
      var s = new THREE.Sprite(new THREE.SpriteMaterial({map:bokehTex, color: i%3===0?0xffc2d2:0xffffff, transparent:true, opacity:0.06+rnd()*0.09, depthWrite:false, blending:THREE.AdditiveBlending}));
      s.position.set((rnd()*2-1)*4.2, 0.4+rnd()*3.4, -1.2-rnd()*3.4);
      var sc = 0.16+rnd()*0.42; s.scale.set(sc,sc,1);
      scene.add(s);
    }

    var hemi = new THREE.HemisphereLight(0xfff7f4, 0xffb7c8, 0.40); scene.add(hemi);
    var key = new THREE.DirectionalLight(0xfff2e8, 1.15);
    key.position.set(2.6,5.0,3.8); key.castShadow = true;
    key.shadow.mapSize.set(2048,2048); key.shadow.camera.near = 1; key.shadow.camera.far = 12;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.015;
    scene.add(key);
    var rim = new THREE.PointLight(0xff7ba6, 1.6, 12, 2); rim.position.set(-2.6,2.6,-1.4); scene.add(rim);
    var fill = new THREE.PointLight(0xffd9c2, 0.7, 10, 2); fill.position.set(0,0.6,3.2); scene.add(fill);
  }

  function makePetalTex(){
    return canvasTex(128,128,function(c,w,h){
      c.clearRect(0,0,w,h);
      var g = c.createLinearGradient(20,10,110,120);
      g.addColorStop(0,'#ffd2df'); g.addColorStop(0.45,'#ff9fbc'); g.addColorStop(1,'#ff7099');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(w*0.5,h*0.08);
      c.bezierCurveTo(w*0.93,h*0.12,w*0.98,h*0.66,w*0.5,h*0.95);
      c.bezierCurveTo(w*0.02,h*0.66,w*0.07,h*0.12,w*0.5,h*0.08);
      c.closePath(); c.fill();
      c.strokeStyle='rgba(255,255,255,0.55)'; c.lineWidth=3; c.stroke();
      c.strokeStyle='rgba(210,60,110,0.28)'; c.lineWidth=2;
      c.beginPath(); c.moveTo(w*0.5,h*0.16); c.lineTo(w*0.5,h*0.86); c.stroke();
    });
  }
  function makeHeartTex(){
    return canvasTex(128,128,function(c,w,h){
      c.clearRect(0,0,w,h);
      c.translate(w/2,h/2+6);
      var g = c.createLinearGradient(0,-46,0,50);
      g.addColorStop(0,'#ff9dbb'); g.addColorStop(1,'#ff4f7f');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0,42);
      c.bezierCurveTo(-64,-6,-44,-52,-12,-40);
      c.bezierCurveTo(-4,-37,0,-30,0,-26);
      c.bezierCurveTo(0,-30,4,-37,12,-40);
      c.bezierCurveTo(44,-52,64,-6,0,42);
      c.closePath(); c.fill();
      c.strokeStyle='rgba(255,255,255,0.85)'; c.lineWidth=5; c.stroke();
    });
  }
  function makeStarTex(){
    return canvasTex(128,128,function(c,w,h){
      c.clearRect(0,0,w,h);
      var g = c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
      g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.2,'rgba(255,232,240,0.95)'); g.addColorStop(0.55,'rgba(255,150,185,0.32)'); g.addColorStop(1,'rgba(255,150,185,0)');
      c.fillStyle=g; c.fillRect(0,0,w,h);
      c.fillStyle='rgba(255,255,255,0.98)';
      c.beginPath();
      c.moveTo(w/2,6); c.quadraticCurveTo(w/2+8,h/2-8,w-6,h/2);
      c.quadraticCurveTo(w/2+8,h/2+8,w/2,h-6);
      c.quadraticCurveTo(w/2-8,h/2+8,6,h/2);
      c.quadraticCurveTo(w/2-8,h/2-8,w/2,6); c.fill();
    });
  }

  function buildContent(){
    var group = new THREE.Group();
    var W=1.30, H=1.30, D=0.88;

    var frontMat = new THREE.MeshPhysicalMaterial({map:tex.boxFront, roughness:0.62, metalness:0.0, clearcoat:0.04, clearcoatRoughness:0.8});
    var sideMat = new THREE.MeshPhysicalMaterial({map:tex.boxSide, roughness:0.72, metalness:0.0, clearcoat:0.15});
    var pinkMat = new THREE.MeshStandardMaterial({color:0xffc6d6, roughness:0.68, metalness:0});
    var holeMat = new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false});
    var innerMat = new THREE.MeshStandardMaterial({color:0xb84863, roughness:0.9, side:THREE.BackSide});

    var body = new THREE.Mesh(new THREE.BoxGeometry(W,H,D), [sideMat,sideMat,holeMat,pinkMat,frontMat,sideMat]);
    body.position.y = H/2; body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    var inner = new THREE.Mesh(new THREE.BoxGeometry(W-0.06,H-0.04,D-0.06), innerMat);
    inner.position.y = H/2; group.add(inner);

    var rimMat = new THREE.MeshStandardMaterial({color:0xffa6c0, roughness:0.5});
    var rimF = new THREE.Mesh(new THREE.BoxGeometry(W+0.05,0.055,0.055), rimMat); rimF.position.set(0,H,D/2); group.add(rimF);
    var rimB = rimF.clone(); rimB.position.z = -D/2; group.add(rimB);
    var rimL = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.055,D+0.05), rimMat); rimL.position.set(-W/2,H,0); group.add(rimL);
    var rimR = rimL.clone(); rimR.position.x = W/2; group.add(rimR);

    var lidPivot = new THREE.Group(); lidPivot.position.set(0,H,-D/2);
    var lidTop = new THREE.MeshStandardMaterial({color:0xffd3df, roughness:0.55, metalness:0});
    var lidBottom = new THREE.MeshStandardMaterial({color:0xffd3df, roughness:0.9});
    var lid = new THREE.Mesh(new THREE.BoxGeometry(W+0.08,0.10,D+0.08), [sideMat,sideMat,lidTop,lidBottom,sideMat,sideMat]);
    lid.position.set(0,0.05,D/2); lid.castShadow = true; lid.receiveShadow = true;
    lidPivot.add(lid); group.add(lidPivot);

    var paperMatA = new THREE.MeshStandardMaterial({color:0xffe3ea, roughness:0.95, side:THREE.DoubleSide});
    var paperMatB = new THREE.MeshStandardMaterial({color:0xffc2d3, roughness:0.95, side:THREE.DoubleSide});
    for(var i=0;i<0;i++){
      var p = new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.32), i%2?paperMatA:paperMatB);
      p.rotation.x = -Math.PI/2; p.rotation.z = i*1.1;
      p.position.set((i-0.5)*0.30, 1.15+i*0.006, 0.02);
      group.add(p);
    }

    var chH = 1.30, chW = chH*1226/1944;
    var charGroup = new THREE.Group(); charGroup.position.set(0,0.45,0.02);
    var sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 320; sheetCanvas.height = 508;
    var sheetCtx = sheetCanvas.getContext('2d');
    if(tex.ipSheet && tex.ipSheet.image){ sheetCtx.drawImage(tex.ipSheet.image, 0, 0, 320, 508, 0, 0, 320, 508); }
    var sheetTex = new THREE.CanvasTexture(sheetCanvas);
    sheetTex.colorSpace = THREE.SRGBColorSpace;
    var charMat = new THREE.MeshStandardMaterial({map:sheetTex, transparent:true, alphaTest:0.05, side:THREE.DoubleSide, roughness:0.62, metalness:0, emissive:new THREE.Color(0xff5f8a), emissiveIntensity:0.05});
    var charMesh = new THREE.Mesh(new THREE.PlaneGeometry(chW,chH), charMat);
    charMesh.position.y = chH/2; charGroup.add(charMesh);

    var glowTex = radialTexture('rgba(255,170,195,0.55)','rgba(255,170,195,0)');
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, transparent:true, opacity:0.025, depthWrite:false, blending:THREE.AdditiveBlending}));
    glow.scale.set(1.32,1.55,1); glow.position.set(0,0.78,-0.03); charGroup.add(glow);
    var glow2 = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, transparent:true, opacity:0.06, depthWrite:false, blending:THREE.AdditiveBlending}));
    glow2.scale.set(1.85,1.85,1); glow2.position.set(0,1.5,-0.12); charGroup.add(glow2);
    group.add(charGroup);

    function wuxiTexture(){
      var c = document.createElement('canvas'); c.width = 512; c.height = 512;
      var g = c.getContext('2d');
      g.beginPath(); g.arc(256,256,238,0,Math.PI*2); g.fillStyle='rgba(255,250,247,0.96)'; g.fill();
      g.lineWidth=14; g.strokeStyle='#e889a8'; g.stroke();
      g.beginPath(); g.arc(256,256,204,0,Math.PI*2); g.lineWidth=3; g.strokeStyle='#f3b7c9'; g.stroke();
      g.fillStyle='#a81646'; g.textAlign='center'; g.textBaseline='middle';
      g.font='bold 150px "Microsoft YaHei"'; g.fillText('无锡',256,215);
      g.font='bold 38px "Microsoft YaHei"'; g.fillText('WUXI · YANGSHAN',256,325);
      g.font='30px "Microsoft YaHei"'; g.fillStyle='#b05a70'; g.fillText('阳 山 水 蜜 桃',256,384);
      return new THREE.CanvasTexture(c);
    }
    var badgeTex = wuxiTexture();
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    var badge = new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.36), new THREE.MeshBasicMaterial({map:badgeTex, transparent:true, side:THREE.DoubleSide, depthWrite:false}));
    badge.position.set(0.86,2.06,0.30); group.add(badge);

    var rippleMat = new THREE.MeshBasicMaterial({color:0xff8fb4, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending});
    var ripple = new THREE.Mesh(new THREE.RingGeometry(0.93,1.0,72), rippleMat);
    ripple.rotation.x = -Math.PI/2; ripple.position.y = 0.02; group.add(ripple);

    var petalTex = makePetalTex();
    var petalGeo = new THREE.PlaneGeometry(0.105,0.145);
    var petals = [];
    var prnd = rng(2024);
    for(var j=0;j<44;j++){
      var pm = new THREE.MeshBasicMaterial({map:petalTex, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide});
      var petal = new THREE.Mesh(petalGeo, pm);
      petal.userData = {x:(prnd()*2-1)*2.0, z:(prnd()*0.9-0.45), delay:prnd()*5.5, sp:0.7+prnd()*1.2, spin:prnd()*2-1};
      petal.visible = false; group.add(petal); petals.push(petal);
    }
    var burst = [];
    var brnd = rng(909);
    for(var k=0;k<26;k++){
      var bm = new THREE.MeshBasicMaterial({map:petalTex, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide});
      var bp = new THREE.Mesh(petalGeo, bm);
      bp.userData = {vx:(brnd()*2-1)*1.5, vy:1.5+brnd()*1.7, vz:(brnd()*2-1)*0.6, delay:brnd()*0.32, spin:brnd()*2-1};
      bp.visible=false; group.add(bp); burst.push(bp);
    }

    var rain = [];
    var rrnd = rng(515);
    for(var q=0;q<30;q++){
      var rm = new THREE.MeshBasicMaterial({map:petalTex, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide});
      var rp = new THREE.Mesh(petalGeo, rm);
      rp.userData = {x:(rrnd()*2-1)*1.7, z:(rrnd()*2-1)*0.7, delay:rrnd()*0.8, spin:rrnd()*2-1};
      rp.visible=false; group.add(rp); rain.push(rp);
    }

    var blossoms = [];
    for(var b=0;b<3;b++){
      var bg = new THREE.Group();
      for(var pp=0;pp<5;pp++){
        var pa = pp/5*Math.PI*2;
        var pmat = new THREE.MeshBasicMaterial({map:petalTex, color:0xffc0d0, transparent:true, opacity:0.95, side:THREE.DoubleSide, depthWrite:false});
        var pmesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.24), pmat);
        pmesh.position.set(Math.cos(pa)*0.10, Math.sin(pa)*0.10, 0);
        pmesh.rotation.z = pa + Math.PI/2;
        bg.add(pmesh);
      }
      var bcenter = new THREE.Mesh(new THREE.CircleGeometry(0.05,12), new THREE.MeshBasicMaterial({color:0xffd36e}));
      bcenter.position.z = 0.012; bg.add(bcenter);
      bg.userData = {off:b*2.1};
      bg.scale.setScalar(0.9);
      group.add(bg); blossoms.push(bg);
    }

    var heartTex = makeHeartTex();
    var hearts = [];
    for(var m=0;m<14;m++){
      var hm = new THREE.SpriteMaterial({map:heartTex, transparent:true, opacity:0, depthWrite:false});
      var hs = new THREE.Sprite(hm);
      hs.userData = {i:m, delay:m*0.032};
      hs.scale.set(0.13,0.13,1); hs.visible=false; group.add(hs); hearts.push(hs);
    }

    var starTex = makeStarTex();
    var sparkles = [];
    for(var n=0;n<20;n++){
      var sm = new THREE.SpriteMaterial({map:starTex, transparent:true, opacity:0.5, depthWrite:false, blending:THREE.AdditiveBlending});
      var sp = new THREE.Sprite(sm); sp.userData = {i:n};
      sp.scale.set(0.08,0.08,1); sp.visible=false; group.add(sp); sparkles.push(sp);
    }

    return {group:group, body:body, lidPivot:lidPivot, charGroup:charGroup, charMesh:charMesh, sheetCtx:sheetCtx, sheetTex:sheetTex, glow:glow, glow2:glow2, ripple:ripple, petals:petals, burst:burst, rain:rain, blossoms:blossoms, badge:badge, hearts:hearts, sparkles:sparkles, W:W, H:H, D:D};
  }

  function setOpen(x){
    C.lidPivot.rotation.x = -2.95 * x;
  }
  function basePose(t){
    var open = easeOutCubic(clamp((t-1.05)/1.05,0,1));
    setOpen(open);
    C.charGroup.visible = t > 1.25;
    var rise = clamp((t-1.95)/1.0,0,1);
    var rb = easeOutBack(rise);
    C.charGroup.position.y = lerp(0.45, C.H, rb);
    var sc = lerp(0.35, 1, clamp(rb,0,1.2));
    C.charGroup.scale.set(sc,sc,1);
    var idle = smoothstep(2.7,3.4,t);
    var bob = Math.sin((t-2.7)*2.05)*0.022*idle;
    var roll = Math.sin((t-2.7)*1.15)*0.030*idle;
    C.charGroup.position.y += bob;
    C.charGroup.rotation.z = roll;
    C.charGroup.rotation.y = Math.sin((t-2.7)*0.85)*0.10*idle;
    return {open:open, rise:rise, idle:idle};
  }

  function tapPose(t){
    var tp = clamp((t-7.0)/1.05,0,1);
    if(t < 7.0 || tp >= 1) return;
    var j = Math.sin(Math.PI*tp);
    C.charGroup.position.y += j*0.44;
    C.charGroup.rotation.y += easeInOut(tp)*Math.PI*2;
    var sq = Math.sin(Math.PI*clamp(tp*3.2,0,1))*0.16;
    C.charGroup.scale.set(1+sq, 1-sq, 1);
  }

  function wavePose(t){
    var env = smoothstep(11.0,11.5,t) * (1-smoothstep(13.5,14.05,t));
    if(env <= 0.001) return;
    C.charGroup.rotation.z += Math.sin((t-11.1)*13.0)*0.078*env;
    C.charGroup.position.y += Math.abs(Math.sin((t-11.1)*6.5))*0.022*env;
  }

  function updateEffects(t, demo){
    var open = C.lidPivot.rotation.x < -0.1;
    // 识别波纹
    var ru = clamp((t-1.35)/1.2,0,1);
    if(ru>0 && ru<1){
      C.ripple.visible = true;
      var s = 0.12 + easeOutCubic(ru)*1.9;
      C.ripple.scale.set(s,s,s);
      C.ripple.material.opacity = 0.55*(1-ru);
    } else { C.ripple.visible = false; }

    // 爆开花瓣
    for(var i=0;i<C.burst.length;i++){
      var bp = C.burst[i], u = (t - 1.75 - bp.userData.delay)/1.85;
      if(u>0 && u<1){
        bp.visible = true;
        bp.position.set(bp.userData.vx*u, 1.33 + bp.userData.vy*u - 1.45*u*u, bp.userData.vz*u);
        bp.rotation.set(u*5*bp.userData.spin, u*7, u*4*bp.userData.spin);
        bp.material.opacity = Math.sin(Math.PI*Math.min(1,u*1.05))*0.95;
      } else { bp.visible = false; }
    }
    // 常态花瓣雨
    for(var j=0;j<C.petals.length;j++){
      var p = C.petals[j], d = p.userData;
      var st = 2.4 + d.delay;
      if(t < st){ p.visible=false; continue; }
      var uu = ((t - st)/(6.2/d.sp)) % 1;
      p.visible = true;
      p.position.set(d.x + Math.sin(t*0.8 + j)*0.26, 3.15 - uu*3.2, d.z + Math.sin(t*0.55 + j*1.7)*0.12);
      p.rotation.set(t*0.6 + j, t*0.5 + j*1.3, t*0.9 + j*0.7);
      p.material.opacity = 0.9 * Math.pow(Math.sin(Math.PI*uu), 0.35);
    }
    // 星星
    for(var k=0;k<C.sparkles.length;k++){
      var sp = C.sparkles[k], idx = sp.userData.i;
      var vis = smoothstep(2.6,3.4,t) * (1-smoothstep(14.2,15.0,t));
      sp.visible = vis > 0.01;
      if(!sp.visible) continue;
      var a = t*0.55 + idx*2.4;
      var r = 0.55 + 0.22*Math.sin(t*0.9 + idx);
      sp.position.set(Math.sin(a)*r, 1.05 + ((idx*7)%13)/13*1.55 + Math.sin(t*1.9 + idx)*0.05, Math.cos(a)*r*0.55);
      var ss = 0.055 + 0.045*(0.5+0.5*Math.sin(t*3.1 + idx*1.7));
      sp.scale.set(ss,ss,1);
      sp.material.opacity = (0.25 + 0.55*(0.5+0.5*Math.sin(t*2.4+idx))) * vis;
    }
    // 爱心（点击后）
    for(var m=0;m<C.hearts.length;m++){
      var hs = C.hearts[m], hu = (t - 7.02 - hs.userData.delay)/1.0;
      if(hu>0 && hu<1){
        hs.visible = true;
        hs.position.set((hs.userData.i%7-3)*0.055 + Math.sin(hu*4+hs.userData.i)*0.05, 1.35 + hu*1.05, 0.16 + Math.cos(hu*3+hs.userData.i)*0.05);
        var hsc = 0.11 + 0.06*Math.sin(Math.PI*hu);
        hs.scale.set(hsc,hsc,1);
        hs.material.opacity = Math.sin(Math.PI*hu);
      } else { hs.visible = false; }
    }
    // 呼吸光
    if(C.glow){
      var gi = 0.055 + 0.025*Math.sin(t*2.2);
      C.glow.material.opacity = gi;
      C.glow2.material.opacity = 0.022 + 0.012*Math.sin(t*1.7+1.2);
    }
  }

  function updateCamera(t){
    var push = smoothstep(0,6,t)*0.10 + smoothstep(12.5,15,t)*0.16;
    var x = -0.16 + 0.10*Math.sin(t*0.32) + Math.sin(t*11.3)*camShake;
    var y = 1.44 + 0.02*Math.sin(t*0.47) + Math.cos(t*9.7)*camShake*0.6;
    camera.position.set(x, y, 6.35 - push);
    camera.lookAt(0.02, 1.24 + 0.02*Math.sin(t*0.4), 0);
  }

  function updateDemoUI(t){
    var scanA = 1 - smoothstep(1.05,1.6,t);
    ui.scan.style.opacity = String(scanA);
    ui.scan.style.transform = 'translateY(' + (smoothstep(1.6,2.4,t)*8).toFixed(2) + 'px)';
    var linePos = ((t*0.42) % 1) * 100;
    ui.scanline.style.top = linePos.toFixed(2) + '%';

    var toastA = smoothstep(1.35,1.6,t) * (1-smoothstep(2.35,2.7,t));
    ui.toast.style.opacity = String(toastA);
    ui.toast.style.transform = 'translate(-50%,' + (-1 + smoothstep(1.35,1.7,t)*1).toFixed(2) + 'vh)';

    var hintA = smoothstep(4.2,4.7,t) * (1-smoothstep(5.9,6.2,t));
    ui.hint.style.opacity = String(hintA);
    ui.hint.style.transform = 'translate(-50%,' + ((1-hintA)*1.2).toFixed(2) + 'vh)';
    ui.hintText.textContent = '小桃出箱啦 · 点一点';
  }

  function updateDemoExtras(t){
    S.now = t;
    function fire(k, at, fn){ if(t >= at && !S.demo[k]){ S.demo[k] = true; fn(at); } }
    fire('tap', 6.0, function(at){ charTap(at); });
    fire('spin', 7.4, function(at){ doSpin(at); });
    fire('info', 9.4, function(at){ doInfo(at); });
    fire('petals', 14.4, function(at){ doPetals(at); });
    fire('game', 16.4, function(at){ startGame(at); });
    fire('photo', 21.0, function(at){ doPhoto(at); });
    if(S.gameOn){
      var catches = [17.45,18.05,18.65,19.25,19.85];
      for(var i=0;i<catches.length;i++){
        if(t >= catches[i] && !S.caught[i] && !S.demo['c'+i]){ S.demo['c'+i] = true; catchPeach(i); }
      }
    }
  }

  function updateGame(now){
    for(var i=0;i<peachEls.length;i++){
      var el = peachEls[i];
      var u = (now - S.gameAt - GAME_START[i]) / 2.0;
      if(!S.gameOn || S.caught[i] || u < 0 || u > 1.05){ el.style.opacity = '0'; continue; }
      el.style.opacity = '1';
      el.style.left = (GAME_X[i] + Math.sin(now*2.0 + i)*2.2).toFixed(2) + '%';
      el.style.top = (16 + u*47).toFixed(2) + '%';
      el.style.transform = 'translate(-50%,-50%) scale(' + (1 - u*0.12).toFixed(3) + ')';
    }
  }

  function updateExtras(now){
    S.now = now;
    if(C.sheetCtx && tex.ipSheet && tex.ipSheet.image){
      var fi = Math.floor(now*12) % 24;
      var sx = (fi % 6) * 320, sy = Math.floor(fi / 6) * 508;
      C.sheetCtx.clearRect(0,0,320,508);
      C.sheetCtx.drawImage(tex.ipSheet.image, sx, sy, 320, 508, 0, 0, 320, 508);
      C.sheetTex.needsUpdate = true;
    }
    var chShader = C.charMesh && C.charMesh.material && C.charMesh.material.userData ? C.charMesh.material.userData.shader : null;
    if(chShader && chShader.uniforms.uTime) chShader.uniforms.uTime.value = now;
    if(C.blossoms){
      for(var bi=0;bi<C.blossoms.length;bi++){
        var bg = C.blossoms[bi];
        var ba = now*0.55 + bg.userData.off;
        bg.position.set(Math.cos(ba)*0.95, 1.18 + Math.sin(now*1.3 + bi)*0.10, 0.35 + Math.sin(ba)*0.22);
        bg.rotation.y = now*1.1 + bi;
        bg.rotation.z = Math.sin(now*1.4 + bi)*0.5;
      }
    }
    if(C.charGroup){
      C.charGroup.rotation.z = Math.sin(now*2.0)*0.10;
      C.charGroup.rotation.y = Math.sin(now*1.3)*0.16;
      C.charGroup.rotation.x = Math.sin(now*1.6+0.4)*0.035;
      // 时不时蹦一下，别让角色看起来是贴图
      var hopCycle = Math.max(0, Math.sin(now*1.15));
      C.charGroup.position.y += Math.pow(hopCycle, 14) * 0.07;
    }
    // 无锡徽章：左右摆动 + 上下浮动，像一枚会转的印章
    if(C.badge){
      C.badge.position.y = 2.06 + Math.sin(now*1.15)*0.05;
      C.badge.rotation.y = Math.sin(now*0.8)*0.62;
      C.badge.rotation.z = Math.sin(now*0.95+0.5)*0.06;
    }
    var idt = now - S.infoAt;
    var ia = S.infoAt > 0 ? smoothstep(0,0.35,idt) * (1 - smoothstep(4.5,5.0,idt)) : 0;
    if(!arMode){ C.group.position.x = -0.28 * ia; }
    ui.infocard.style.opacity = String(ia);
    ui.infocard.style.transform = 'translateX(' + ((1-ia)*6).toFixed(2) + 'vh)';
    // 花瓣雨
    var pa = now - S.petalsAt;
    var blessA = S.petalsAt > 0 ? smoothstep(0,0.25,pa) * (1 - smoothstep(2.4,2.8,pa)) : 0;
    ui.bless.style.opacity = String(blessA);
    for(var i=0;i<C.rain.length;i++){
      var rp = C.rain[i], d = rp.userData;
      var u = (pa - 0.05 - d.delay) / 1.9;
      if(S.petalsAt > 0 && u > 0 && u < 1){
        rp.visible = true;
        rp.position.set(d.x + Math.sin(pa*1.6 + i)*0.22, 3.2 - u*3.15, d.z + Math.cos(pa*1.2+i)*0.1);
        rp.rotation.set(pa*2.2 + i, pa*1.7 + i*1.3, pa*2.6 + i*0.7);
        rp.material.opacity = Math.sin(Math.PI*u) * 0.95;
      } else { rp.visible = false; }
    }
    // 游戏
    if(S.gameOn) updateGame(now);
    else { for(var pi=0; pi<peachEls.length; pi++){ peachEls[pi].style.opacity = '0'; } }
    ui.gamehud.style.opacity = (S.gameOn || now < S.gameHudUntil) ? '1' : '0';
    if(!arMode && now > 21.5) ui.gamehud.style.opacity = '0';
    // 皇冠 / 徽章
    ui.crown.style.opacity = S.crown ? '1' : '0';
    var ba = S.badgeAt > 0 ? smoothstep(0,0.3,now-S.badgeAt) * (1 - smoothstep(4.6,5.1,now-S.badgeAt)) : 0;
    ui.badge.style.opacity = String(ba);
    // 合影
    var ph = now - S.photoAt;
    ui.flash.style.opacity = ph >= 0 ? String(1 - smoothstep(0.08,0.32,ph)) : '0';
    var polaA = ph >= 0 ? smoothstep(0.25,0.65,ph) * (1 - smoothstep(4.4,4.9,ph)) : 0;
    ui.polaroid.style.opacity = String(polaA);
    ui.polaroid.style.transform = 'translate(-50%,' + ((1-polaA)*14).toFixed(2) + 'vh) rotate(-3deg)';
    ui.saved.style.opacity = ph >= 0 ? String(smoothstep(0.9,1.2,ph) * (1 - smoothstep(2.5,2.9,ph))) : '0';
  }

  function updateActionUI(t){
    var a = smoothstep(6.2,6.7,t) * (1 - smoothstep(20.85,21.15,t));
    ui.actions.style.opacity = String(a);
    ui.actions.style.transform = 'translate(-50%,' + ((1-a)*2).toFixed(2) + 'vh)';
    var map = {spin:[7.35,7.75], info:[9.35,9.75], petals:[14.35,14.75], game:[16.35,16.75], photo:[20.95,21.35]};
    var bs = document.querySelectorAll('.act');
    for(var i=0;i<bs.length;i++){
      var k = bs[i].getAttribute('data-act');
      var r = map[k];
      if(r && t >= r[0] && t <= r[1]) bs[i].classList.add('hot'); else bs[i].classList.remove('hot');
    }
  }

  function updateEndCard(t){
    var ea = smoothstep(25.6,26.5,t);
    ui.endcard.style.opacity = String(ea);
    ui.endcard.style.transform = 'scale(' + (0.985 + 0.015*ea).toFixed(4) + ')';
    canvas.style.opacity = String(Math.max(0, 1 - 1.15*ea));
    if(ea > 0.01){
      ui.crown.style.opacity = '0'; ui.badge.style.opacity = '0'; ui.gamehud.style.opacity = '0';
      ui.infocard.style.opacity = '0'; ui.bless.style.opacity = '0';
      ui.actions.style.opacity = '0'; ui.polaroid.style.opacity = '0'; ui.saved.style.opacity = '0';
      for(var pi=0; pi<peachEls.length; pi++){ peachEls[pi].style.opacity = '0'; }
    }
    var chromeA = 1 - smoothstep(25.2,25.9,t);
    var sb = document.querySelector('.statusbar'), tb = document.querySelector('.topbar');
    if(sb) sb.style.opacity = String(chromeA);
    if(tb) tb.style.opacity = String(chromeA);
  }

  function updateQRIntro(t){
    if(!ui.qrintro) return;
    var introA = 1 - smoothstep(2.0, 2.55, t);
    ui.qrintro.style.opacity = String(introA);
    if(introA <= 0.001) return;
    var line = clamp((t - 0.15) / 1.65, 0, 1);
    ui.qrScanline.style.top = (18 + line * 54).toFixed(2) + '%';
    ui.qrOk.style.opacity = String(smoothstep(1.15, 1.42, t) * (1 - smoothstep(1.9, 2.2, t)));
  }

  function renderAt(t){
    if(!C) return;
    updateQRIntro(t);
    var tt = Math.max(0, t - 2.2);
    basePose(tt);
    updateDemoExtras(t);
    updateExtras(t);
    updateEffects(tt, true);
    updateCamera(tt);
    updateDemoUI(tt);
    updateActionUI(t);
    updateEndCard(t);
    renderer.render(scene, camera);
  }

  function initExtras(){
    ui.peachLayer.innerHTML = '';
    peachEls = [];
    for(var i=0;i<5;i++){
      var b = document.createElement('button');
      b.className = 'peach'; b.type = 'button'; b.setAttribute('data-i', String(i));
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        catchPeach(parseInt(this.getAttribute('data-i'), 10));
      });
      ui.peachLayer.appendChild(b); peachEls.push(b);
    }
    var acts = document.querySelectorAll('.act');
    for(var j=0;j<acts.length;j++){
      acts[j].addEventListener('click', function(ev){
        ev.stopPropagation();
        var now = performance.now()/1000;
        var a = this.getAttribute('data-act');
        if(a === 'spin') doSpin(now);
        else if(a === 'info') doInfo(now);
        else if(a === 'petals') doPetals(now);
        else if(a === 'game') startGame(now);
        else if(a === 'photo') doPhoto(now);
        this.classList.add('hot');
        var el = this;
        setTimeout(function(){ el.classList.remove('hot'); }, 380);
      });
    }
    var close = document.getElementById('icClose');
    if(close) close.addEventListener('click', function(ev){
      ev.stopPropagation(); S.infoAt = -99;
    });
  }

  function setupDemo(){
    makeRenderer();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, window.innerWidth/window.innerHeight, 0.1, 60);
    buildEnvironment();
    C = buildContent(); window.__C = C;
    scene.add(C.group);
    window.__C = C; window.__renderer = renderer; window.__scene = scene; window.__camera = camera;
    initExtras();
    resetExtras();
    S.demo = {};
    if(ui.start) ui.start.style.display = 'none';
    if(ui.loading) ui.loading.style.display = 'none';
    if(ui.fallback) ui.fallback.style.display = 'none';
    ui.actions.style.pointerEvents = 'none';
    ui.peachLayer.style.pointerEvents = 'none';
    window.addEventListener('resize', function(){
      camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    renderAt(0);
    var qt = params.get('t');
    if(qt !== null){ renderAt(clamp(parseFloat(qt) || 0, 0, DUR)); }
    window.renderAt = renderAt;
    window.__C = C; window.__scene = scene; window.__camera = camera; window.__renderer = renderer;
    window.__duration = DUR;
    window.__ready = true;
    if(MODE === 'demo' && params.get('play') === '1'){
      var t0 = performance.now();
      renderer.setAnimationLoop(function(){ renderAt(((performance.now()-t0)/1000)%DUR); });
    }
  }

  function showCameraError(e){
    var n = (e && e.name) || '';
    var title = '相机没有打开', msg = '请允许相机权限后重试。';
    if(inApp){
      title = '请在浏览器中打开';
      msg = '微信 / 小红书内无法直接调用相机。请点右上角 ···，选择“在浏览器打开”。';
    } else if(n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError'){
      title = '相机权限被拒绝';
      msg = '请在浏览器设置里允许相机权限，然后点“重新授权”。';
    } else if(n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError'){
      title = '没有找到摄像头';
      msg = '请确认设备有摄像头，或换一台手机再试。';
    } else if(n === 'NotReadableError' || n === 'TrackStartError'){
      title = '摄像头被占用';
      msg = '请关闭其他正在使用相机的应用，然后重试。';
    } else if(n === 'NotSupportedError'){
      title = '当前浏览器不支持相机';
      msg = '请用 Safari / Chrome 打开这个链接。';
    } else if(n === 'TimeoutError'){
      title = '相机启动超时';
      msg = '请点“重新授权”再试；如果一直卡住，请换 Safari / Chrome 或重启浏览器。';
    }
    ui.ceTitle.textContent = title;
    ui.ceMsg.textContent = msg;
    ui.start.style.display = 'none';
    ui.loading.style.display = 'none';
    ui.fallback.style.display = 'flex';
    ui.copyBtn.style.display = inApp ? 'inline-block' : 'none';
  }

  function copyLink(){
    var url = location.href;
    function done(){ ui.copyBtn.textContent = '已复制'; setTimeout(function(){ ui.copyBtn.textContent = '复制当前链接'; }, 1600); }
    function fallback(){
      var ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch(e){}
      ta.remove();
    }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done).catch(fallback); }
    else fallback();
  }

  async function beginAR(){
    if(!assetsReady){ return; }
    ui.start.style.display = 'none';
    ui.fallback.style.display = 'none';
    ui.loading.style.display = 'flex';
    var finished = false;
    var timer = setTimeout(function(){
      if(!finished){ finished = true; showCameraError({name:'TimeoutError'}); }
    }, 15000);
    var md = navigator.mediaDevices;
    var orig = md && md.getUserMedia;
    var stream = null;
    try{
      if(!md || !orig){ var err = new Error('mediaDevices unavailable'); err.name = 'NotSupportedError'; throw err; }
      try{
        stream = await orig.call(md, {video:{facingMode:{ideal:'environment'}}, audio:false});
      }catch(e1){
        if(e1.name === 'OverconstrainedError' || e1.name === 'NotFoundError'){
          stream = await orig.call(md, {video:true, audio:false});
        } else { throw e1; }
      }
      // 复用同一条相机流，避免 iOS 第二次申请时卡住/黑屏
      try { md.getUserMedia = function(){ return Promise.resolve(stream); }; } catch(e2){}
      arAttempted = true;
      await startAR();
      if(!finished){ finished = true; clearTimeout(timer); ui.loading.style.display = 'none'; }
      var v = document.querySelector('#ar-root video');
      if(v){ v.setAttribute('playsinline',''); v.muted = true; var pr = v.play(); if(pr && pr.catch) pr.catch(function(){}); }
    }catch(e){
      if(stream){ try{ stream.getTracks().forEach(function(tr){ tr.stop(); }); }catch(e3){} }
      if(!finished){ finished = true; clearTimeout(timer); showCameraError(e); }
    }finally{
      if(md && orig){ try{ md.getUserMedia = orig; }catch(e4){} }
    }
  }

  function showStart(){
    ui.start.style.display = 'flex';
    ui.start.style.opacity = '1';
    ui.loading.style.display = 'none';
    ui.fallback.style.display = 'none';
    if(inApp){ ui.startWarn.style.display = 'block'; }
    ui.startBtn.addEventListener('click', beginAR);
    ui.startDemo.addEventListener('click', function(){ location.href = '?mode=demo&play=1'; });
    ui.retryBtn.addEventListener('click', function(){ if(arAttempted) location.reload(); else beginAR(); });
    ui.demoBtn.addEventListener('click', function(){ location.href = '?mode=demo&play=1'; });
    ui.copyBtn.addEventListener('click', copyLink);
  }

  window.playFallback = function(){
    location.href = '?mode=demo&play=1';
  };

  function startAR(){
    return new Promise(function(resolve, reject){
      try { initAR(resolve, reject); } catch(e){ reject(e); }
    });
  }

  function initAR(resolve, reject){
    var arRoot = document.getElementById('ar-root');
    arRoot.style.display = 'block';
    canvas.style.display = 'none';
    ar = new MindARThree({
      container: arRoot,
      imageTargetSrc: 'targets.mind',
      maxTrack: 1,
      filterMinCF: 0.0001,
      filterBeta: 0.001,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no'
    });
    renderer = ar.renderer; scene = ar.scene; camera = ar.camera;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene.add(new THREE.HemisphereLight(0xfff7f4, 0xffb7c8, 1.15));
    var key = new THREE.DirectionalLight(0xfff2e8, 2.1); key.position.set(2,4,3); scene.add(key);
    var rim = new THREE.PointLight(0xff86ab, 8, 8, 2); rim.position.set(-2,2,-1); scene.add(rim);

    var anchor = ar.addAnchor(0);
    C = buildContent(); window.__C = C;
    C.group.scale.setScalar(0.62);
    C.group.position.set(0, -0.405, 0);
    anchor.group.add(C.group);
    window.__C = C; window.__renderer = renderer; window.__scene = scene; window.__camera = camera;
    initExtras();

    anchor.onTargetFound = function(){
      arDetected = true; arStart = performance.now()/1000;
      resetExtras(); S.demo = {};
      ui.scan.style.opacity = '0';
      ui.toast.style.opacity = '1';
      setTimeout(function(){ ui.toast.style.opacity = '0'; }, 1400);
      ui.hint.style.opacity = '1';
      ui.hintText.textContent = '点一点小桃 · 或试试下方玩法';
      C.charGroup.visible = true;
      setTimeout(function(){
        if(arDetected){ ui.actions.style.opacity = '1'; }
        ui.hint.style.opacity = '0';
      }, 1800);
    };
    anchor.onTargetLost = function(){
      arDetected = false;
      resetExtras();
      C.lidPivot.rotation.x = 0;
      C.charGroup.position.y = 0.45; C.charGroup.scale.set(0.35,0.35,1);
      C.charGroup.rotation.set(0,0,0);
      ui.hint.style.opacity = '0';
      ui.actions.style.opacity = '0';
      ui.scan.style.opacity = '1';
    };

    window.addEventListener('pointerdown', function(ev){
      if(!arDetected) return;
      var tg = ev.target;
      if(tg && tg.closest && tg.closest('.actions,.infocard,.peach,.polaroid,.endcard,.qrintro')) return;
      charTap(performance.now()/1000);
    });

    ar.start().then(function(){
      resolve();
      ui.scan.style.opacity = '1';
      renderer.setAnimationLoop(function(){
        var now = performance.now()/1000;
        var t = arDetected ? now - arStart : 0;
        if(arDetected){
          var open = easeOutCubic(clamp(t/1.0,0,1));
          setOpen(open);
          var rise = clamp((t-0.45)/1.0,0,1);
          var rb = easeOutBack(rise);
          C.charGroup.position.y = lerp(0.45, C.H, rb);
          var sc = lerp(0.35,1,clamp(rb,0,1.2));
          C.charGroup.scale.set(sc,sc,1);
          var idle = smoothstep(1.3,2.0,t);
          C.charGroup.position.y += Math.sin(now*2.05)*0.018*idle;
          C.charGroup.rotation.z = Math.sin(now*1.2)*0.028*idle;
          C.charGroup.rotation.y = Math.sin(now*0.9)*0.10*idle;
          updateExtras(now);
          updateEffectsAR(now, t);
        }
        renderer.render(scene, camera);
      });
    }).catch(reject);
  }

  function updateEffectsAR(now, t){
    // 花瓣雨 + 星星，用实时时间
    for(var j=0;j<C.petals.length;j++){
      var p=C.petals[j], d=p.userData;
      var st = 1.0 + d.delay*0.35;
      if(t < st){ p.visible=false; continue; }
      var uu = ((now*0.12*d.sp + d.delay) % 1);
      p.visible=true;
      p.position.set(d.x*0.75 + Math.sin(now*0.8+j)*0.15, 2.35 - uu*2.2, d.z*0.6 + Math.sin(now*0.55+j)*0.08);
      p.rotation.set(now*0.6+j, now*0.5+j, now*0.9+j);
      p.material.opacity = 0.85*Math.pow(Math.sin(Math.PI*uu),0.35);
    }
    for(var k=0;k<C.sparkles.length;k++){
      var sp=C.sparkles[k], idx=sp.userData.i;
      sp.visible = t > 1.1;
      if(!sp.visible) continue;
      var a = now*0.5 + idx*2.4, r=0.42+0.16*Math.sin(now+idx);
      sp.position.set(Math.sin(a)*r, 0.55 + ((idx*7)%13)/13*1.25 + Math.sin(now*1.8+idx)*0.04, Math.cos(a)*r*0.55);
      var ss=0.035+0.025*(0.5+0.5*Math.sin(now*3+idx));
      sp.scale.set(ss,ss,1); sp.material.opacity=0.3+0.5*(0.5+0.5*Math.sin(now*2.3+idx));
    }
    if(C.glow){
      C.glow.material.opacity = 0.28+0.08*Math.sin(now*2.2);
      C.glow2.material.opacity = 0.14+0.05*Math.sin(now*1.7);
    }
    // 点击爱心
    for(var m=0;m<C.hearts.length;m++){
      var hs=C.hearts[m];
      var hu=(now - arTapAt - hs.userData.delay*0.25)/0.9;
      if(arTapAt>0 && hu>0 && hu<1){
        hs.visible=true;
        hs.position.set((hs.userData.i%7-3)*0.045 + Math.sin(hu*4+hs.userData.i)*0.04, 0.95+hu*0.75, 0.12);
        var hsc=0.08+0.05*Math.sin(Math.PI*hu); hs.scale.set(hsc,hsc,1);
        hs.material.opacity=Math.sin(Math.PI*hu);
      } else { hs.visible=false; }
    }
  }

  var assetsReady = false;
  var WEBP_OK = true;
  function assetJobs(){
    return [
      { key:'boxFront', srcs:['assets/box-front.png'] },
      { key:'boxSide',  srcs:['assets/box-side.png'] },
      { key:'ipSheet',  srcs:(WEBP_OK ? ['assets/ip-sheet-320.webp'] : []).concat(['assets/ip-sheet-320.png']) }
    ];
  }
  /* 三项并行加载；单张失败不阻塞整体，用兜底贴图保证 AR 仍能进得去 */
  async function loadAssets(onProgress){
    var jobs = assetJobs();
    var done = 0, failed = 0;
    await Promise.all(jobs.map(function(job){
      return loadTexAny(job.srcs).then(function(t){
        tex[job.key] = t;
      }, function(e){
        failed++;
        console.warn('贴图加载失败: ' + job.key + ' (' + (e && e.message) + ')');
      }).then(function(){
        done++;
        if(onProgress) { try { onProgress(done, jobs.length); } catch(e2){} }
      });
    }));
    if(!tex.boxFront) tex.boxFront = fallbackBoxTex('#ffd7e2','#ffb9cf');
    if(!tex.boxSide)  tex.boxSide  = fallbackBoxTex('#ffe4ec','#ffcadb');
    return failed;
  }

  function hideBootHelp(){
    var bh = document.getElementById('bootHelp');
    if(bh) bh.classList.remove('on');
  }

  async function main(){
    WEBP_OK = await detectWebp();
    if(MODE === 'demo'){
      await loadAssets();
      setupDemo();
      return;
    }
    // 先显示开始页并绑定按钮，资源加载完再启用，避免“点了没反应”
    showStart();
    ui.startBtn.disabled = true;
    ui.startBtn.textContent = '资源加载中… 0/3';
    var failed = 0;
    try{
      failed = await loadAssets(function(done, total){
        ui.startBtn.textContent = '资源加载中… ' + done + '/' + total;
      });
    }catch(e){
      console.error('资源加载失败', e);
      failed = 3;
    }
    assetsReady = true;
    window.__peachReady = true;
    hideBootHelp();
    ui.startBtn.disabled = false;
    ui.startBtn.innerHTML = '<span>📷</span> 开启相机 · 开始 AR';
    if(failed){ ui.startBtn.textContent = '开启相机 · 开始 AR'; }
  }

  main();
})();
