/**
 * Compact in-world orientation map of the expanded, contiguous preview.
 * Canvas is decorative / informational. Location buttons remain the controls.
 */
export function createMinimap({camera,extent}) {
  const canvas=document.querySelector('#worldMap');
  const container=document.querySelector('#mapPanel');
  const toggle=document.querySelector('#mapToggle');
  if(!canvas||!container)return {update(){}};
  const ctx=canvas.getContext('2d',{alpha:true});
  const W=200,H=176;
  canvas.width=W;canvas.height=H;
  const X=x=>(x+70)/140*W;
  const Z=z=>(80-z)/182*H;
  const destinations=[
    {x:0,z:55,label:'望月台',dx:-20,dy:-8},
    {x:-33,z:-21,label:'竹影庭',dx:-31,dy:15},
    {x:33,z:-21,label:'星愿湖',dx:6,dy:15},
    {x:0,z:-74,label:'旧梦驿',dx:-22,dy:16},
    {x:0,z:-8,label:'灯火巷',dx:-14,dy:-7},
  ];
  toggle?.addEventListener('click',()=>{
    const next=container.classList.toggle('map-collapsed');
    toggle.setAttribute('aria-expanded',String(!next));
  });
  if(innerWidth<430){container.classList.add('map-collapsed');toggle?.setAttribute('aria-expanded','false');}

  function path(x1,z1,x2,z2,width=6) {
    ctx.strokeStyle='#9c8972';
    ctx.globalAlpha=.62;
    ctx.lineWidth=width;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(X(x1),Z(z1));ctx.lineTo(X(x2),Z(z2));ctx.stroke();
    ctx.globalAlpha=1;ctx.lineWidth=1;
    ctx.strokeStyle='rgba(235,207,171,.55)';
    ctx.beginPath();ctx.moveTo(X(x1),Z(z1));ctx.lineTo(X(x2),Z(z2));ctx.stroke();
  }
  function circle(x,z,r,col){
    ctx.beginPath();ctx.arc(X(x),Z(z),r,0,Math.PI*2);
    ctx.fillStyle=col;ctx.fill();
  }
  function draw() {
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#141f2d';ctx.fillRect(0,0,w,h);
    for(let i=0;i<8;i++){
      const yy=i*h/8;
      ctx.strokeStyle='rgba(197,171,141,.065)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w,yy);ctx.stroke();
    }
    circle(50,-21,19,'rgba(57,119,147,.52)');
    circle(-43,-21,16,'rgba(55,99,84,.38)');
    path(0,69,0,-40,10);
    path(0,69,0,28,10);
    path(-33,18,33,18,7);
    path(-33,18,-33,-64,6.5);
    path(33,18,33,-64,6.5);
    path(-33,-55,33,-55,7);
    path(0,-55,0,-85,8);
    for(const [x,z,r] of [[0,55,7],[-33,-21,7],[33,-21,7],[0,-73,8]])circle(x,z,r,'#7b6958');
    for(const d of destinations){
      circle(d.x,d.z,3.2,'#e1b47c');
      ctx.font='10px serif';ctx.fillStyle='#f1e1ce';ctx.textAlign='left';
      ctx.shadowColor='#000';ctx.shadowBlur=5;
      ctx.fillText(d.label,X(d.x)+d.dx,Z(d.z)+d.dy);
      ctx.shadowBlur=0;
    }
    const x=X(camera.position.x),z=Z(camera.position.z);
    ctx.save();ctx.translate(x,z);ctx.rotate(-camera.rotation.y);
    ctx.fillStyle='#ffe8b8';ctx.strokeStyle='#332333';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-4.4,5);ctx.lineTo(4.4,5);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.restore();
  }
  let stamp=-1;
  return {
    update(t){
      if(t-stamp>.18){stamp=t;draw();}
    },
    redraw:draw,
  };
}
