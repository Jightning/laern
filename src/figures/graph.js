/* Figure kind: graph */
import { esc, tone, attr, txt } from "./base.js";

/* ---------- kind: graph -------------------------------------------------
 * nodes: [{id, label, x?, y?, accent?, here?, state?, note?, title?}]
 * edges: [{from, to, label?, self?, curve?}]
 * layout: "circle" | "row" | "layered" | "manual"
 * Good for state machines, block diagrams, dependency graphs.
 * ----------------------------------------------------------------------*/
export function graph (spec) {
  var nodes = spec.nodes || [], edges = spec.edges || [],
      layout = spec.layout || (nodes.length > 5 ? "layered" : "circle"),
      r = spec.r || 27,
      W = spec.w || 640,
      H = spec.h || (layout === "row" ? 150 : layout === "circle" ? 360 : 320),
      pos = {};

  /* --- Fit every label before laying anything out. Wrap on spaces, drop the
     font a step at a time (11 → 8), and grow the node up to ~1.7× rather than
     distort the glyphs to squeeze a long word in. The grown radius then feeds
     the layout spacing and the edge geometry, so bigger nodes push apart
     instead of colliding. --- */
  var SIZES = [11, 10, 9, 8];
  function fit(raw, base) {
    var words = String(raw == null ? "" : raw).replace(/\n/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) words = [""];
    for (var s = 0; s < SIZES.length; s++) {
      var fs = SIZES[s], cw = fs * 0.6, maxW = 2 * (base - 4), lines = [], cur = "";
      words.forEach(function (w) {
        var cand = cur ? cur + " " + w : w;
        if (!cur || cand.length * cw <= maxW) cur = cand;
        else { lines.push(cur); cur = w; }
      });
      if (cur) lines.push(cur);
      var longest = lines.reduce(function (m, t) { return Math.max(m, t.length); }, 0) * cw;
      var textH = lines.length * (fs + 2);
      if ((longest <= maxW && textH <= maxW) || s === SIZES.length - 1) {
        var need = Math.max(longest / 2 + 6, textH / 2 + 4);
        return { lines: lines, fs: fs, lh: fs + 2,
                 rEff: Math.round(Math.min(base * 1.7, Math.max(base, need))) };
      }
    }
  }
  var FI = {};
  nodes.forEach(function (n) { FI[n.id] = fit(n.label == null ? n.id : n.label, r); });
  var radOf = function (id) { return (FI[id] || { rEff: r }).rEff; };
  var maxR = nodes.reduce(function (m, n) { return Math.max(m, radOf(n.id)); }, r);

  if (layout === "manual") {
    nodes.forEach(function (n) { pos[n.id] = { x: n.x, y: n.y }; });
  } else if (layout === "row") {
    W = Math.max(W, nodes.length * (maxR * 2 + 26) + 40);
    var gap = W / (nodes.length + 1);
    nodes.forEach(function (n, k) { pos[n.id] = { x: gap * (k + 1), y: H / 2 }; });
  } else if (layout === "layered") {
    /* layer by longest path from a root, so prerequisites sit left */
    var indeg = {}, adj = {};
    nodes.forEach(function (n) { indeg[n.id] = 0; adj[n.id] = []; });
    edges.forEach(function (e) {
      if (e.from === e.to || !(e.to in indeg)) return;
      indeg[e.to]++; if (adj[e.from]) adj[e.from].push(e.to);
    });
    var layer = {}, queue = nodes.filter(function (n) { return !indeg[n.id]; })
      .map(function (n) { return n.id; });
    nodes.forEach(function (n) { layer[n.id] = 0; });
    if (!queue.length && nodes.length) queue = [nodes[0].id];
    var guard = 0;
    while (queue.length && guard++ < 5000) {
      var id = queue.shift();
      (adj[id] || []).forEach(function (t) {
        if (layer[t] < layer[id] + 1) { layer[t] = layer[id] + 1; queue.push(t); }
      });
    }
    /* A node with no edge either way has no position in a dependency flow. Left
       in the columns it lands in layer 0 and stretches the canvas for every
       other node: 24 of a 62-section map were edgeless, and they were most of
       why it was unreadable. They are packed into a band underneath instead —
       still drawn, still clickable, still ringable when one is the focus. */
    var touched = {};
    edges.forEach(function (e) {
      if (e.from === e.to) return;
      if (e.from in indeg) touched[e.from] = 1;
      if (e.to in indeg) touched[e.to] = 1;
    });
    var loose = nodes.filter(function (n) { return !touched[n.id]; });
    var flow = nodes.filter(function (n) { return touched[n.id]; });

    var byL = {};
    flow.forEach(function (n) { (byL[layer[n.id]] = byL[layer[n.id]] || []).push(n.id); });
    if (!Object.keys(byL).length) byL[0] = [];

    /* Order the nodes inside each layer by the mean position of their
       neighbours in the adjacent layer, swept in both directions.
       Layering alone fixes the columns but leaves the order within a column
       arbitrary, and an arbitrary order makes long edges cross short ones for
       no reason: a 62-section map was an unreadable hairball before this, with
       most nodes sharing layer 0 and their edges fanning across the whole
       canvas. This is the barycentre heuristic, which is cheap and gets most
       of the available crossing reduction. */
    var pred = {}, succ = {}, idx = {};
    nodes.forEach(function (n) { pred[n.id] = []; succ[n.id] = []; });
    edges.forEach(function (e) {
      if (e.from === e.to || !(e.to in layer) || !(e.from in layer)) return;
      succ[e.from].push(e.to); pred[e.to].push(e.from);
    });
    var lkeys = Object.keys(byL).map(Number).sort(function (a, b) { return a - b; });
    var reindex = function () {
      lkeys.forEach(function (k) { byL[k].forEach(function (id, j) { idx[id] = j; }); });
    };
    var bary = function (id, rel) {
      var ns = rel[id] || [], s = 0;
      if (!ns.length) return idx[id];
      ns.forEach(function (m) { s += idx[m]; });
      return s / ns.length;
    };
    reindex();
    for (var sw = 0; sw < 6; sw++) {
      var rel = sw % 2 ? succ : pred;
      (sw % 2 ? lkeys.slice().reverse() : lkeys).forEach(function (k) {
        byL[k] = byL[k].slice().sort(function (a, b) {
          var d = bary(a, rel) - bary(b, rel);
          return d || (idx[a] - idx[b]);
        });
      });
      reindex();
    }

    var L = Math.max.apply(null, Object.keys(byL).map(Number)) + 1;
    var pitch = maxR * 2 + 30;
    W = Math.max(W, (L + 1) * (maxR * 2 + 40));
    var flowH = Math.max(200, Object.keys(byL).reduce(function (m, k) {
      return Math.max(m, byL[k].length); }, 0) * pitch + 40);
    /* the packed band: as many per row as fit at the node's own pitch */
    var perRow = Math.max(1, Math.floor((W - 40) / (maxR * 2 + 26))),
        looseRows = Math.ceil(loose.length / perRow),
        bandH = loose.length ? looseRows * (maxR * 2 + 26) + 26 : 0;
    H = spec.h || (flowH + bandH);
    loose.forEach(function (n, k) {
      var row = Math.floor(k / perRow), col = k % perRow,
          wide2 = Math.min(perRow, loose.length - row * perRow);
      pos[n.id] = { x: (W / (wide2 + 1)) * (col + 1),
                    y: flowH + 13 + row * (maxR * 2 + 26) + maxR };
    });
    Object.keys(byL).forEach(function (k) {
      var col = byL[k], cx2 = (W / (L + 1)) * (Number(k) + 1);
      col.forEach(function (id, j) {
        pos[id] = { x: cx2, y: (flowH / (col.length + 1)) * (j + 1) };
      });
    });
  } else { /* circle */
    var cx = W / 2, cy = H / 2, rad = Math.min(W, H) / 2 - maxR - 26;
    nodes.forEach(function (n, k) {
      var ang = (k / nodes.length) * Math.PI * 2 - Math.PI / 2;
      pos[n.id] = { x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang) };
    });
  }

  /* Size the canvas to the finished layout plus room for each node's grown
     radius, its "here" ring, a note line below it, and any self-loop that
     bulges outward — so nothing is clipped and the figure frame only scrolls
     when the graph is genuinely large. */
  var selfOf = {};
  edges.forEach(function (e) { if (e.from === e.to || e.self) selfOf[e.from] = e.label || " "; });
  var pad = Object.keys(selfOf).length || edges.some(function (e) { return e.label; }) ? 40 : 26;
  var xs = [], ys = [];
  nodes.forEach(function (n) {
    var p = pos[n.id]; if (!p) return;
    var rr = radOf(n.id) + (n.here ? 7 : 0);
    var loop = selfOf[n.id] != null ? rr + 34 + String(selfOf[n.id]).length * 2.7 : rr;
    xs.push(p.x - loop, p.x + loop);
    ys.push(p.y - loop, p.y + loop + (n.note ? 20 : 0));
  });
  var vx = 0, vy = 0, vw = W, vh = H;
  if (xs.length) {
    vx = Math.min.apply(null, xs) - pad; vy = Math.min.apply(null, ys) - pad;
    vw = Math.max.apply(null, xs) + pad - vx; vh = Math.max.apply(null, ys) + pad - vy;
  }

  /* A graph past a handful of nodes is unreadable once the browser shrinks it
     to the column width, so it keeps an intrinsic minimum and the figure frame
     (overflow-x:auto) scrolls instead. Small graphs still scale to fit. */
  var big = nodes.length >= 8 || vw > 720;
  var out = '<svg viewBox="' + vx.toFixed(1) + " " + vy.toFixed(1) + " " +
    vw.toFixed(1) + " " + vh.toFixed(1) + '" class="fx"' +
    (big ? ' style="min-width:' + Math.min(Math.round(vw), 760) + 'px"' : "") +
    ' role="img">';
  out += '<defs><marker id="fxa" viewBox="0 0 10 10" refX="9" refY="5" ' +
    'markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
    '<path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)"/></marker></defs>';

  /* an edge label with a background chip, so it stays readable where it
     crosses a line or sits near another label */
  function elabel(x, y, s) {
    var w = String(s).length * 5.4 + 10;
    return '<rect x="' + (x - w / 2).toFixed(1) + '" y="' + (y - 9).toFixed(1) +
      '" width="' + w.toFixed(1) + '" height="14" rx="3" class="fx-eh"/>' +
      txt(x, y + 1.5, s, "fx-el");
  }

  /* the layout centroid, so a self-loop can bulge away from the crowd rather
     than always upward into it */
  var cenX = 0, cenY = 0, nc = 0;
  nodes.forEach(function (n) { var p = pos[n.id]; if (p) { cenX += p.x; cenY += p.y; nc++; } });
  cenX /= (nc || 1); cenY /= (nc || 1);

  /* edges first so nodes sit on top */
  edges.forEach(function (e) {
    var a = pos[e.from], b = pos[e.to];
    if (!a) return;
    if (e.from === e.to || e.self) {
      var rr = radOf(e.from);
      var ox = a.x - cenX, oy = a.y - cenY, horiz = Math.abs(ox) > Math.abs(oy);
      var sx = horiz ? (ox >= 0 ? 1 : -1) : 0, sy = horiz ? 0 : (oy >= 0 ? 1 : -1);
      if (!horiz && sy === 0) sy = -1;
      var bulge = rr + 26, p1, p2, c1, c2, lx, ly;
      if (horiz) {
        p1 = [a.x + sx * rr, a.y - 11]; p2 = [a.x + sx * rr, a.y + 11];
        c1 = [a.x + sx * bulge, a.y - 30]; c2 = [a.x + sx * bulge, a.y + 30];
        lx = a.x + sx * (bulge + String(e.label || "").length * 2.7 + 4); ly = a.y;
      } else {
        p1 = [a.x - 11, a.y + sy * rr]; p2 = [a.x + 11, a.y + sy * rr];
        c1 = [a.x - 30, a.y + sy * bulge]; c2 = [a.x + 30, a.y + sy * bulge];
        lx = a.x; ly = a.y + sy * (bulge + 12);
      }
      out += '<path d="M' + p1[0] + " " + p1[1] + " C" + c1[0] + " " + c1[1] +
        " " + c2[0] + " " + c2[1] + " " + p2[0] + " " + p2[1] +
        '" class="fx-e" marker-end="url(#fxa)"/>';
      if (e.label) out += elabel(lx, ly, e.label);
      return;
    }
    if (!b) return;
    var ra = radOf(e.from), rb = radOf(e.to);
    var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1,
        ux = dx / d, uy = dy / d,
        x1 = a.x + ux * ra, y1 = a.y + uy * ra,
        x2 = b.x - ux * (rb + 6), y2 = b.y - uy * (rb + 6);
    var bend = e.curve == null ? (layout === "circle" ? 0.16 : 0) : e.curve;
    if (bend) {
      var mx = (x1 + x2) / 2 - uy * d * bend, my = (y1 + y2) / 2 + ux * d * bend;
      out += '<path d="M' + x1 + " " + y1 + " Q" + mx + " " + my + " " + x2 + " " + y2 +
        '" class="fx-e" marker-end="url(#fxa)"/>';
      if (e.label) out += elabel(mx, my, e.label);
    } else {
      out += '<line ' + attr({ x1: x1, y1: y1, x2: x2, y2: y2 }) +
        ' class="fx-e" marker-end="url(#fxa)"/>';
      /* nudge the label off the line, perpendicular to it */
      if (e.label) out += elabel((x1 + x2) / 2 - uy * 11, (y1 + y2) / 2 + ux * 11, e.label);
    }
  });

  nodes.forEach(function (n) {
    var p = pos[n.id]; if (!p) return;
    var f = FI[n.id] || fit(n.id, r), rr = f.rEff;
    var accent = n.accent != null ? tone(n.accent) : "var(--rule)";
    out += '<g class="fx-node' + (n.here ? " is-here" : "") +
      (n.state ? " is-" + n.state.replace(/\s+/g, "-") : "") +
      '" data-node="' + esc(n.id) + '">';
    if (n.title) out += '<title>' + esc(n.title) +
      (n.state ? " — " + esc(n.state) : "") + '</title>';
    if (n.here) out += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (rr + 6) +
      '" class="fx-here"/>';
    out += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + rr +
      '" class="fx-n" style="stroke:' + accent + '"/>';
    f.lines.forEach(function (ln, j) {
      var ly2 = p.y + f.fs * 0.34 + (j - (f.lines.length - 1) / 2) * f.lh;
      out += '<text x="' + p.x + '" y="' + ly2.toFixed(1) +
        '" class="fx-t fx-nl" text-anchor="middle" style="font-size:' + f.fs + 'px">' +
        esc(ln) + '</text>';
    });
    if (n.note) out += elabel(p.x, p.y + rr + 14, n.note);
    out += '</g>';
  });
  return out + "</svg>";
}
