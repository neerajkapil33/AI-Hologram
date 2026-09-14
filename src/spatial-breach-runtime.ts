const STYLE_ID='neeraj-spatial-breach-style';
const OVERLAY_CLASS='spatial-breach-overlay';

const installStyles=()=>{
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.live-avatar{position:relative;overflow:hidden;perspective:1100px}
.live-avatar.spatial-breach-active .avatar-render-layer{filter:saturate(1.12) contrast(1.03);transition:filter 700ms ease}
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

@keyframes neerajBreachScan{0%{transform:translateY(-50%) scaleX(.15);opacity:0}35%{opacity:1}100%{transform:translateY(-50%) scaleX(1);opacity:.05}}
@keyframes neerajCrack{0%{transform:rotate(12deg) scaleY(.05);opacity:0}45%{opacity:1}100%{transform:rotate(12deg) scaleY(1);opacity:.16}}
@keyframes neerajShard{0%{opacity:0;transform:translate(0,0) scale(.3) rotate(0)}35%{opacity:.8}100%{opacity:0;transform:translate(var(--dx,0),var(--dy,-30px)) scale(1) rotate(18deg)}}
`;
  document.head.appendChild(style);
};

const ensureOverlay=(host:HTMLElement)=>{
  let overlay=host.querySelector<HTMLElement>(`.${OVERLAY_CLASS}`);
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.className=OVERLAY_CLASS;
  overlay.innerHTML='<div class="breach-plane"></div><div class="breach-glow"></div><div class="breach-scan"></div><div class="breach-crack"></div><i class="breach-shard s1"></i><i class="breach-shard s2"></i><i class="breach-shard s3"></i>';
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
