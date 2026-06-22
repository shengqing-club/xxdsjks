import{o as e}from"./index-Cft5N3Dr.js";var t=[`大模型思考中... 其实是在帮你搬文件...`,`AI正在深度学习如何更快地下载...`,`神经网络正在全速运转，文件传输中...`,`大模型推理中... 结论是：文件马上就好...`,`GPU正在满载运行，为你加速下载...`,`郝宇波正在努力搬砖Ing...`,`白雨轩正在殴打系统，很快就好了...`,`赵峰正在计算文件大小...`,`oi，赵锦欣在努力帮你找答案了...`];function n(){let e=document.documentElement.classList.contains(`dark`),n=document.createElement(`div`);n.id=`download-progress-overlay`;let r=Math.floor(Math.random()*t.length);n.innerHTML=`
    <style>
      #download-progress-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: ${e?`rgba(18, 22, 36, 0.95)`:`rgba(255,255,255,0.92)`};
        z-index: 99999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      }
      .dl-icon {
        width: 48px; height: 48px; margin-bottom: 24px;
        border: 3px solid ${e?`rgba(255,255,255,0.15)`:`#e0e0e0`};
        border-top-color: ${e?`#60a5fa`:`#1a56db`};
        border-radius: 50%;
        animation: dlSpin 0.8s linear infinite;
      }
      @keyframes dlSpin { to { transform: rotate(360deg); } }
      .progress-bar-wrap { width: 320px; height: 10px; background: ${e?`rgba(255,255,255,0.1)`:`#e8e8e8`}; border-radius: 5px; overflow: hidden; margin-bottom: 20px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.08); }
      .progress-bar-fill { height: 100%; background: ${e?`#60a5fa`:`#1a56db`}; border-radius: 5px; transition: width 0.35s ease; width: 0%; }
      .progress-text { font-size: 15px; color: ${e?`rgba(255,255,255,0.85)`:`#555`}; margin-bottom: 16px; font-weight: 500; }
      .comfort-text { font-size: 14px; color: ${e?`rgba(255,255,255,0.5)`:`#999`}; max-width: 320px; text-align: center; line-height: 1.7; min-height: 24px; transition: opacity 0.4s ease; }
    </style>
    <div class="dl-icon"></div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill" id="dl-progress-fill"></div></div>
    <div class="progress-text" id="dl-progress-text">准备中...</div>
    <div class="comfort-text" id="dl-comfort-text">${t[r]}</div>
  `,document.body.appendChild(n);let i=r;return n._comfortTimer=setInterval(()=>{let e=n.querySelector(`#dl-comfort-text`);e&&(e.style.opacity=`0`,setTimeout(()=>{i=(i+1)%t.length,e.textContent=t[i],e.style.opacity=`1`},400))},2500),n}function r(e,t){let n=e.querySelector(`#dl-progress-fill`),r=e.querySelector(`#dl-progress-text`);n&&(n.style.width=t+`%`),r&&(r.textContent=t>=100?`下载完成！`:`正在下载... ${t}%`)}function i(){let e=document.getElementById(`download-progress-overlay`);e&&(e._comfortTimer&&clearInterval(e._comfortTimer),e.remove())}async function a(e,t,n,r){let i=(localStorage.getItem(`token`)||``).replace(/^["']|["']$/g,``),a=`/api${e}`,o=new AbortController,s=setTimeout(()=>o.abort(),3e5),c=await fetch(a,{headers:{Authorization:`Bearer ${i}`},signal:o.signal});if(clearTimeout(s),c.status===401)throw localStorage.removeItem(`token`),localStorage.removeItem(`user`),window.location.href=`/login`,Error(`登录已过期`);if(!c.ok)throw Error(`HTTP ${c.status}`);let l=parseInt(c.headers.get(`Content-Length`))||0,u=c.body.getReader(),d=[],f=0;for(;;){let{done:e,value:t}=await u.read();if(e)break;d.push(t),f+=t.length,r&&l>0&&r(Math.round(f/l*100))}let p=new Uint8Array(f),m=0;for(let e of d)p.set(e,m),m+=e.length;return new Blob([p],{type:n||c.headers.get(`Content-Type`)||`application/octet-stream`})}function o(e,t){let n=document.createElement(`a`);n.href=URL.createObjectURL(e),n.download=t||`download`,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(n.href)}async function s(t,s,c,l,u){if((c.fileSize||0)>10*1024*1024){let e=(localStorage.getItem(`token`)||``).replace(/^["']|["']$/g,``),n=`/api${t}${t.includes(`?`)?`&`:`?`}token=${encodeURIComponent(e)}`;window.open(n,`_blank`),u&&u(100);return}let d=n(),f=e=>{r(d,e),u&&u(e)};try{r(d,10),o(await a(t,l,c.fileType,f),l),r(d,100),setTimeout(()=>{i(),e.success(`下载成功`)},500)}catch(t){throw i(),e.error(`下载失败: `+(t.message||`未知错误`)),t}}async function c(e,t,n){try{let t=await a(e,null,n.fileType||`image/png`);return URL.createObjectURL(t)}catch(e){return console.error(`图片加载失败:`,e),``}}export{c as n,s as t};