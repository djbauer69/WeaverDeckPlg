"use strict";
const fs=require('fs'),path=require('path');
const icons={};
for(const name of ['volumeUp','volumeDown'])icons[name]='data:image/svg+xml;base64,'+fs.readFileSync(path.join(__dirname,'icons',name+'.svg')).toString('base64');
// Application artwork uses these same badge coordinates on a 144px canvas.
function artwork(value,down=false) {
  const label=Number.isFinite(value)?Math.round(value)+'%':'?';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><image href="${icons[down?'volumeDown':'volumeUp']}" width="144" height="144"/><rect x="84" y="101" width="52" height="34" rx="12" fill="#111820" fill-opacity=".90"/><text x="110" y="124" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${label.length>2?15:22}" fill="#e3e2e6">${label}</text></svg>`;
  return 'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
}
module.exports={artwork};
