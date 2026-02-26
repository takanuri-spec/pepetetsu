const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/game/mapData.ts');
let data = fs.readFileSync(file, 'utf8');

const cx = 450;
const cy = 350;
const scale = 3.5;

data = data.replace(/x:\s*([\d.-]+),?/g, (match, xStr) => {
    let x = parseFloat(xStr);
    x = cx + (x - cx) * scale;
    return `x: ${Math.round(x)},`;
});

data = data.replace(/y:\s*([\d.-]+),?/g, (match, yStr) => {
    let y = parseFloat(yStr);
    y = cy + (y - cy) * scale;
    return `y: ${Math.round(y)},`;
});

fs.writeFileSync(file, data, 'utf8');
console.log("Map expanded.");
