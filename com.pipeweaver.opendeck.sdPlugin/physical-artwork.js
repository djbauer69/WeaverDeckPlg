'use strict';
const shapes={
 microphone:'<rect x="61" y="25" width="22" height="48" rx="11"/><path d="M50 58v7a22 22 0 0 0 44 0v-7M72 87v20m-15 0h30"/>',
 'electric-guitar':'<path d="m52 70 32-32 9 9-32 33c17 5 15 21 1 28-14 8-34-2-35-17-1-11 10-17 16-12l8-10 1 13 9-3M87 36l9-12 10 10-12 9M50 86l8 8"/><path d="m57 82 34-37"/>',
 'acoustic-guitar':'<path d="m76 60 20-30 10 6-21 33c12 14 11 30-3 39-16 10-37 2-43-14-5-13 6-23 16-21 1-13 12-19 21-13Z"/><circle cx="70" cy="83" r="8"/><path d="m61 98 13 6M74 77l26-43"/>',
 drums:'<ellipse cx="72" cy="74" rx="24" ry="9"/><path d="M48 74v27c0 12 48 12 48 0V74M57 81v23m15-20v24m15-27v23M30 59v37m84-37v37"/><ellipse cx="30" cy="54" rx="17" ry="5"/><ellipse cx="114" cy="54" rx="17" ry="5"/><path d="m53 33 32 30m-1-31L59 62"/>',
 keyboard:'<rect x="24" y="49" width="96" height="48" rx="5"/><path d="M40 50v46m16-46v46m16-46v46m16-46v46m16-46v46"/><path d="M40 51v25m16-25v25m32-25v25m16-25v25" stroke-width="8"/>',
 webcam:'<rect x="28" y="40" width="88" height="45" rx="16"/><circle cx="72" cy="62" r="15"/><circle cx="101" cy="58" r="2"/><path d="M63 86v12h18V86M47 107l16-9m18 0 16 9"/>',
 speakers:'<rect x="29" y="31" width="34" height="77" rx="5"/><rect x="81" y="31" width="34" height="77" rx="5"/><circle cx="46" cy="81" r="11"/><circle cx="98" cy="81" r="11"/><circle cx="46" cy="49" r="5"/><circle cx="98" cy="49" r="5"/>',
 headphones:'<path d="M34 79V66a38 38 0 0 1 76 0v13M44 60a28 28 0 0 1 56 0"/><rect x="29" y="72" width="20" height="35" rx="7"/><rect x="95" y="72" width="20" height="35" rx="7"/>',
 soundbar:'<rect x="17" y="59" width="110" height="29" rx="8"/><circle cx="36" cy="73" r="7"/><circle cx="108" cy="73" r="7"/><path d="M51 67h42M51 74h42M51 81h42M25 94h94"/>',
 airpods:'<path d="M39 35c-13 0-19 10-16 21 2 8 11 13 19 10v36c0 8 12 8 12 0V53c0-11-5-18-15-18ZM105 35c13 0 19 10 16 21-2 8-11 13-19 10v36c0 8-12 8-12 0V53c0-11 5-18 15-18Z"/><path d="M30 47h10m64 0h10"/>'
};
const input=['microphone','electric-guitar','acoustic-guitar','drums','keyboard','webcam'],output=['speakers','headphones','soundbar','airpods'];
function valid(icon,kind){return (kind==='input'?input:kind==='output'?output:[]).includes(icon)}
function svg(icon,{volume=null,muted=null,mute=false,preview=false}={}){
 const color=mute?(muted===true?'#ef7979':muted===false?'#7ecb95':'#aeb9c4'):'#dce7ef';
 const badge=mute?(muted===true?'MUTE':muted===false?'LIVE':'?'):(Number.isFinite(volume)?Math.round(volume)+'%':'?');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect x="3" y="3" width="138" height="138" rx="22" fill="#18212b" stroke="#657585" stroke-width="3"/><g fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${shapes[icon]||shapes.microphone}${mute&&muted===true?'<path d="m29 30 85 85" stroke="#ef7979" stroke-width="6"/>':''}</g>${preview?'':`<rect x="84" y="104" width="52" height="31" rx="11" fill="#10151c"/><text x="110" y="125" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="${color}">${badge}</text>`}</svg>`;
}
function artwork(icon,options){return 'data:image/svg+xml;base64,'+Buffer.from(svg(icon,options)).toString('base64')}
module.exports={shapes,input,output,valid,svg,artwork};
