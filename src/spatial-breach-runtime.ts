const STYLE_ID='neeraj-spatial-breach-style';
const OVERLAY_CLASS='spatial-breach-overlay';

const installStyles=()=>{
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.live-avatar{position:relative;overflow:hidden;perspective:1100px}
.live-avatar.spatial-breach-active .avatar-render-layer{transform:translateZ(70px) scale(1.035);filter:saturate(1.18) contrast(1.05);transition:transform 900ms cubic-bezier(.2,.85,.2,1),filter 900ms ease}
.live-avatar.spatial-breach-active canvas{filter:drop-shadow(0 0 18px rgba(80,230,255,.28))}
.${OVERLAY_CLASS}{position:absolute;inset:0;z-index:12;pointer-events:none;overflow:hidden;opacity:0;transition:opacity 350ms ease}
.spatial-breach-active .${OVERLAY_CLASS}{opacity:1}
.${OVERLAY_CLASS} .breach-plane{position:absolute;inset:7%;border:1px solid rgba(126,241,255,.34);box-shadow:inset 0 0 45px rgba(39,210,255,.09),0 0 35px rgba(39,210,255,.1);transform:perspective(900px) rotateX(1deg)}
.${OVERLAY_CLASS} .breach-scan{position:absolute;left:4%;right:4%;top:50%;height:2px;background:rgba(142,247,255,.8);box-shadow:0 0 18px 4px rgba(46,220,255,.42);transform:translateY(-50%) scaleX(.25);opacity:.1}
.spatial-breach-active .${OVERLAY_CLASS} .breach-scan{animation:neerajBreachScan 1.35s ease-out forwards}
.${OVERLAY_CLASS} .breach-glow{position:absolute;left:50%;top:53%;width:46%;height:72%;transform:translate(-50%,-50%);background:radial-gradient(ellipse,rgba(73,230,255,.2) 0,rgba(73,230,255,.07) 36%,transparent 70%);filter:blur(7px);mix-blend-mode:screen}
.${OVERLAY_CLASS} .breach-crack{position:absolute;left:50%;top:53%;width:2px;height:68%;background:linear-gradient(transparent,rgba(184,252,255,.95),transparent);box-shadow:0 0 12px rgba(87,232,255,.9);transform:rotate(12deg) scaleY(.05);transform-origin:center;opacity:0}
.spatial-breach-active .${OVERLAY_CLASS} .breach-crack{animation:neerajCrack .7s .18s cubic-bezier(.2,.8,.2,1) forwards}
.${OVERLAY_CLASS} .breach-shard{position:absolute;width:12%;height:18%;border:1px solid rgba(125,242,255,.5);background:linear-gradient(135deg,rgba(105,235,255,.13),transparent 60%);clip-path:polygon(50% 0,100% 36%,74% 100%,8% 72%);opacity:0;transform:translateZ(0) scale(.3) rotate(0deg)}
.spatial-breach-active .${OVERLAY_CLASS} .s1{left:21%;top:30%;animation:neerajShard .9s .22s ease-out forwards}
.spatial-breach-active .${OVERLAY_CLASS} .s2{right:20%;top:37%;animation:neerajShard .95s .3s ease-out forwards reverse}
.spatial-breach-active .${OVERLAY_CLASS} .s3{left:38%;bottom:16%;animation:neerajShard 1.05s .36s ease-out forwards}

/* First-person hand/arm crossing the virtual display boundary. */
.${OVERLAY_CLASS} .breakout-arm{position:absolute;right:24%;top:47%;width:31%;height:22%;opacity:0;transform-origin:86% 50%;transform:translate3d(90px,36px,-120px) rotate(-14deg) scale(.72);filter:drop-shadow(0 0 14px rgba(91,234,255,.72));}
.spatial-breach-active .${OVERLAY_CLASS} .breakout-arm{animation:neerajArmBreach 1.05s .16s cubic-bezier(.18,.82,.18,1) forwards}
.${OVERLAY_CLASS} .breakout-arm:before{content:'';position:absolute;right:2%;top:28%;width:72%;height:42%;border-radius:48% 35% 38% 44%;background:linear-gradient(100deg,rgba(91,234,255,.12),rgba(187,252,255,.72) 46%,rgba(45,203,255,.16));border:1px solid rgba(185,251,255,.82);box-shadow:inset 0 0 16px rgba(111,239,255,.32),0 0 22px rgba(55,220,255,.48);transform:rotate(-8deg)}
.${OVERLAY_CLASS} .breakout-arm:after{content:'';position:absolute;left:0;top:39%;width:45%;height:24%;border-radius:30% 50% 40% 30%;background:linear-gradient(90deg,rgba(66,219,255,.05),rgba(146,245,255,.56));border:1px solid rgba(145,245,255,.62);box-shadow:0 0 16px rgba(64,225,255,.42);transform:rotate(-8deg)}
.${OVERLAY_CLASS} .breakout-hand{position:absolute;right:-1%;top:3%;width:31%;height:94%;transform:rotate(-13deg);}
.${OVERLAY_CLASS} .breakout-hand i{position:absolute;display:block;width:25%;height:68%;border-radius:90% 90% 42% 42%;background:linear-gradient(90deg,rgba(78,221,255,.08),rgba(209,255,255,.76),rgba(55,208,255,.1));border:1px solid rgba(195,253,255,.82);box-shadow:0 0 12px rgba(92,232,255,.48),inset 0 0 8px rgba(105,240,255,.26);transform-origin:50% 94%}
.${OVERLAY_CLASS} .breakout-hand .f1{left:0;top:14%;height:62%;transform:rotate(-22deg)}
.${OVERLAY_CLASS} .breakout-hand .f2{left:20%;top:1%;height:73%;transform:rotate(-8deg)}
.${OVERLAY_CLASS} .breakout-hand .f3{left:41%;top:0;height:76%;transform:rotate(3deg)}
.${OVERLAY_CLASS} .breakout-hand .f4{left:62%;top:8%;height:67%;transform:rotate(13deg)}
.${OVERLAY_CLASS} .breakout-hand .f5{left:18%;top:57%;width:38%;height:34%;border-radius:65% 45% 60% 50%;transform:rotate(38deg)}
.${OVERLAY_CLASS} .breakout-palm{position:absolute;right:2%;top:34%;width:27%;height:48%;border-radius:48% 44% 52% 45%;border:1px solid rgba(209,255,255,.78);background:radial-gradient(circle at 42% 35%,rgba(216,255,255,.62),rgba(67,220,255,.12) 58%,transparent 72%);box-shadow:0 0 20px rgba(76,229,255,.52),inset 0 0 16px rgba(160,250,255,.24);}
.${OVERLAY_CLASS} .breakout-rim{position:absolute;inset:12%;border:1px solid rgba(190,252,255,.3);border-radius:50%;box-shadow:0 0 22px rgba(74,229,255,.32);opacity:.55;animation:neerajHandPulse 1.2s ease-in-out infinite}

@keyframes neerajBreachScan{0%{transform:translateY(-50%) scaleX(.15);opacity:0}35%{opacity:1}100%{transform:translateY(-50%) scaleX(1);opacity:.05}}
@keyframes neerajCrack{0%{transform:rotate(12deg) scaleY(.05);opacity:0}45%{opacity:1}100%{transform:rotate(12deg) scaleY(1);opacity:.16}}
@keyframes neerajShard{0%{opacity:0;transform:translate(0,0) scale(.3) rotate(0)}35%{opacity:.8}100%{opacity:0;transform:translate(var(--dx,0),var(--dy,-30px)) scale(1) rotate(18deg)}}
@keyframes neerajArmBreach{0%{opacity:0;transform:translate3d(90px,36px,-120px) rotate(-14deg) scale(.72)}25%{opacity:.55}60%{opacity:.9;transform:translate3d(16px,4px,10px) rotate(-5deg) scale(.94)}100%{opacity:.72;transform:translate3d(-8px,-2px,80px) rotate(2deg) scale(1.08)}}
@keyframes neerajHandPulse{0%,100%{transform:scale(.94);opacity:.28}50%{transform:scale(1.04);opacity:.7}}
`;
  document.head.appendChild(style);
};

const ensureOverlay=(host:HTMLElement)=>{
  let overlay=host.querySelector<HTMLElement>(`.${OVERLAY_CLASS}`);
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.className=OVERLAY_CLASS;
  overlay.innerHTML='<div class="breach-plane"></div><div class="breach-glow"></div><div class="breach-scan"></div><div class="breach-crack"></div><div class="breakout-arm"><div class="breakout-rim"></div><div class="breakout-hand"><i class="f1"></i><i class="f2"></i><i class="f3"></i><i class="f4"></i><i class="f5"></i><div class="breakout-palm"></div></div></div><i class="breach-shard s1"></i><i class="breach-shard s2"></i><i class="breach-shard s3"></i>';
  host.appendChild(overlay);
  return overlay;
};

const activate=()=>{
  installStyles();
  document.querySelectorAll<HTMLElement>('.live-avatar').forEach(host=>{
    ensureOverlay(host);
    host.classList.add('spatial-breach-active');
  });
};
const deactivate=()=>document.querySelectorAll<HTMLElement>('.live-avatar').forEach(host=>host.classList.remove('spatial-breach-active'));

window.addEventListener('neeraj:spatial-breakout',event=>{
  const active=Boolean((event as CustomEvent<{active?:boolean}>).detail?.active);
  active?activate():deactivate();
});

installStyles();
