const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/game/mapData.ts');
let data = fs.readFileSync(file, 'utf8');

// Parse current state
let nodes = [];
data.replace(/id:\s*(\d+)[\s\S]*?x:\s*([\d.-]+),\s*y:\s*([\d.-]+)[\s\S]*?next:\s*\[([\d,\s]*)\]/g, (match, id, x, y, nextStr) => {
    let next = nextStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    nodes.push({ id: parseInt(id), x: parseFloat(x), y: parseFloat(y), next: next });
    return match;
});

// Create edges
let edges = [];
nodes.forEach(n => {
    n.next.forEach(t => {
        edges.push({ u: n.id, v: t });
    });
});

let nodeMap = {};
nodes.forEach(n => nodeMap[n.id] = n);

// constraint solver
const MAX_DIST = 160;
const MIN_DIST = 100;

for (let iter = 0; iter < 1000; iter++) {
    for (let e of edges) {
        let u = nodeMap[e.u];
        let v = nodeMap[e.v];
        if (!u || !v) continue;

        let dx = v.x - u.x;
        let dy = v.y - u.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist === 0) {
            v.x += Math.random() - 0.5;
            v.y += Math.random() - 0.5;
            dist = 1;
        }

        if (dist > MAX_DIST) {
            let diff = dist - MAX_DIST;
            let moveX = (dx / dist) * diff * 0.05;
            let moveY = (dy / dist) * diff * 0.05;
            v.x -= moveX; v.y -= moveY;
            u.x += moveX; u.y += moveY;
        } else if (dist < MIN_DIST) {
            let diff = MIN_DIST - dist;
            let moveX = (dx / dist) * diff * 0.05;
            let moveY = (dy / dist) * diff * 0.05;
            v.x += moveX; v.y += moveY;
            u.x -= moveX; u.y -= moveY;
        }
    }

    // add small repulsion between ALL nodes that are too close
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            let u = nodes[i];
            let v = nodes[j];
            let dx = v.x - u.x;
            let dy = v.y - u.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80 && dist > 0) {
                let diff = 80 - dist;
                let moveX = (dx / dist) * diff * 0.02;
                let moveY = (dy / dist) * diff * 0.02;
                v.x += moveX; v.y += moveY;
                u.x -= moveX; u.y -= moveY;
            }
        }
    }
}

// Write back
let newData = data.replace(/(id:\s*(\d+)[\s\S]*?)x:\s*([\d.-]+),\s*y:\s*([\d.-]+)/g, (match, prefix, idStr) => {
    let id = parseInt(idStr);
    let n = nodeMap[id];
    if (n) {
        return `${prefix}x: ${Math.round(n.x)}, y: ${Math.round(n.y)}`;
    }
    return match;
});

fs.writeFileSync(file, newData, 'utf8');
console.log("Map contracted non-linearly using constraint solver.");
