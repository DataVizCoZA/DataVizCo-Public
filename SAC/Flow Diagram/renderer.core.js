/* =============================================================================
 * Order Flow Funnel — canonical renderer (v0.3)
 * -----------------------------------------------------------------------------
 * Pure function. No DOM dependency, no external libraries. Shared verbatim by
 * the SAC widget (inlined at build time) and preview.html (loaded as <script>).
 *
 * Data model:
 *   - Each *measure* is a stage; feed order = left-to-right order.
 *   - An optional dimension trellises the flow into one panel per member.
 *
 * Accepts either shape as the first argument:
 *   - flat stage array   -> [{ name, actual, target }]                 (single panel)
 *   - panel array        -> [{ title, stages:[{name,actual,target}] }] (trellis)
 *
 * v0.3: single-mode viewBox is ~16:9 with the flow band vertically centred, and
 * both modes reserve clearance above the bars so the value labels never collide
 * with the title/subtitle.
 * ========================================================================== */

function offDefaults() {
  return {
    title: "Order Fulfilment Flow",
    subtitle: "Rate at each stage vs target",
    goodColor: "#2FA84F",
    warnColor: "#E8A317",
    badColor:  "#E24C7B",
    inkColor:  "#33414A",
    mutedColor:"#8794A0",
    ghostColor:"#C4CDD5",
    amberThreshold: 2,
    redThreshold: 10,
    showTargetGhost: true,
    showLegend: true,
    decimalSeparator: ",",
    fontStack: "'72','72full',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  };
}

function offFmt(v, sep) {
  var s = (Math.round(v * 100) / 100).toFixed(2);
  return sep === "." ? s : s.replace(".", sep);
}
function offEsc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function offWrap(text, maxChars, maxLines) {
  var words = String(text).split(/\s+/), lines = [], cur = "";
  for (var i = 0; i < words.length; i++) {
    var probe = cur ? cur + " " + words[i] : words[i];
    if (probe.length > maxChars && cur) { lines.push(cur); cur = words[i]; }
    else { cur = probe; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1}$/, "…");
  }
  return lines;
}
function offColorFor(stage, o) {
  var gap = stage.actual - stage.target;
  if (gap >= -o.amberThreshold) return o.goodColor;
  if (gap >= -o.redThreshold)   return o.warnColor;
  return o.badColor;
}
function offToPanels(arg) {
  if (!arg || !arg.length) return [];
  if (arg[0] && arg[0].stages) return arg;
  return [{ title: null, stages: arg }];
}

/* Draw one flow panel (ribbons + bars + target ghosts + on-bar values). */
function offDrawPanel(stages, geo, o) {
  var frag = [], defs = [];
  var midY = (geo.plotTop + geo.plotBottom) / 2;
  var maxBarH = geo.plotBottom - geo.plotTop;
  function barH(v) { return Math.max(2, (v / 100) * maxBarH); }

  for (var i = 0; i < stages.length - 1; i++) {
    var a = stages[i], b = stages[i + 1];
    var xa = geo.cx(i) + geo.barW / 2, xb = geo.cx(i + 1) - geo.barW / 2;
    var ha = barH(a.actual), hb = barH(b.actual);
    var aT = midY - ha / 2, aB = midY + ha / 2, bT = midY - hb / 2, bB = midY + hb / 2;
    var mx = (xa + xb) / 2;
    var gid = "off-g-" + geo.pi + "-" + i;
    defs.push('<linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="' + offColorFor(a, o) + '" stop-opacity="0.30"/>' +
      '<stop offset="100%" stop-color="' + offColorFor(b, o) + '" stop-opacity="0.30"/></linearGradient>');
    frag.push('<path d="M' + xa + ',' + aT + ' C' + mx + ',' + aT + ' ' + mx + ',' + bT + ' ' + xb + ',' + bT +
      ' L' + xb + ',' + bB + ' C' + mx + ',' + bB + ' ' + mx + ',' + aB + ' ' + xa + ',' + aB + ' Z" fill="url(#' + gid + ')"/>');
  }
  for (var j = 0; j < stages.length; j++) {
    var s = stages[j], col = offColorFor(s, o), cx = geo.cx(j);
    var h = barH(s.actual), y0 = midY - h / 2, x = cx - geo.barW / 2;
    if (o.showTargetGhost && s.target > 0) {
      var th = barH(s.target), ty0 = midY - th / 2;
      frag.push('<rect x="' + (x - 4) + '" y="' + ty0 + '" width="' + (geo.barW + 8) + '" height="' + th +
        '" rx="4" fill="none" stroke="' + o.ghostColor + '" stroke-width="1.5" stroke-dasharray="4 3"/>');
    }
    frag.push('<rect x="' + x + '" y="' + y0 + '" width="' + geo.barW + '" height="' + h + '" rx="5" fill="' + col + '"/>');
    frag.push('<text x="' + cx + '" y="' + (y0 - 12) + '" text-anchor="middle" font-size="' + geo.valueSize +
      '" font-weight="700" fill="' + col + '">' + offFmt(s.actual, o.decimalSeparator) + '%</text>');
  }
  return '<defs>' + defs.join("") + '</defs>' + frag.join("");
}

function buildOrderFlowSVG(arg, opts) {
  var o = offDefaults();
  opts = opts || {};
  for (var k in opts) if (opts[k] !== undefined && opts[k] !== null) o[k] = opts[k];

  var panels = offToPanels(arg);
  if (!panels.length || !panels[0].stages.length) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 120" font-family="' + o.fontStack + '">' +
      '<text x="230" y="60" text-anchor="middle" font-size="14" fill="' + o.mutedColor +
      '">Add one measure per stage to begin.</text></svg>';
  }

  var isTrellis = panels.length > 1;
  var n = panels[0].stages.length;
  var colW = isTrellis ? 178 : 200;
  var barW = isTrellis ? 66 : 92;
  var padL = 40, padR = 40;
  var gutter = isTrellis ? 138 : 0;
  var plotLeft = padL + gutter;
  var W = plotLeft + n * colW + padR;
  var cx = function (i) { return plotLeft + i * colW + colW / 2; };

  var headerBottom = 78;                       // reserved for title/subtitle/legend
  var valueHeadroom = isTrellis ? 30 : 46;     // clearance for the big % above bars

  var out = [], H, geoOf, axisY = 0;

  if (isTrellis) {
    var panelPlotH = 118, panelPad = 30, panelH = panelPlotH + panelPad;
    var topStart = headerBottom + valueHeadroom;
    var sharedAxisH = 60;
    H = topStart + panels.length * panelPlotH + (panels.length - 1) * panelPad + sharedAxisH + 12;
    geoOf = function (pi) {
      var pTop = topStart + pi * panelH;
      return { pi: pi, cx: cx, barW: barW, plotTop: pTop, plotBottom: pTop + panelPlotH, valueSize: 17 };
    };
    axisY = topStart + panels.length * panelPlotH + (panels.length - 1) * panelPad + 24;
  } else {
    H = Math.round(W * 9 / 16);                 // 16:9 hero
    var labelZoneH = 84, botPad = 14;
    var topMin = headerBottom + valueHeadroom;
    var bandSpace = H - topMin - labelZoneH - botPad;
    var maxBarH = Math.min(360, Math.max(120, bandSpace));
    var slack = Math.max(0, bandSpace - maxBarH);
    var sTop = topMin + slack / 2;              // band vertically centred
    geoOf = function () {
      return { pi: 0, cx: cx, barW: barW, plotTop: sTop, plotBottom: sTop + maxBarH, valueSize: 27 };
    };
  }

  // ---- panels ------------------------------------------------------------
  for (var pi = 0; pi < panels.length; pi++) {
    var p = panels[pi];
    var geo = geoOf(pi);
    out.push(offDrawPanel(p.stages, geo, o));

    if (isTrellis && p.title != null) {
      var lines = offWrap(p.title, 16, 2);
      var midYp = (geo.plotTop + geo.plotBottom) / 2;
      var ly = midYp - (lines.length - 1) * 9;
      for (var li = 0; li < lines.length; li++) {
        out.push('<text x="' + padL + '" y="' + (ly + li * 18) + '" font-size="14.5" font-weight="700" fill="' +
          o.inkColor + '">' + offEsc(lines[li]) + '</text>');
      }
    }

    if (!isTrellis) {
      for (var j = 0; j < p.stages.length; j++) {
        var s = p.stages[j], c = offColorFor(s, o), X = cx(j);
        var nameLines = offWrap(s.name, 20, 2), ny = geo.plotBottom + 30;
        for (var q = 0; q < nameLines.length; q++) {
          out.push('<text x="' + X + '" y="' + (ny + q * 17) + '" text-anchor="middle" font-size="13.5" font-weight="600" fill="' +
            o.inkColor + '">' + offEsc(nameLines[q]) + '</text>');
        }
        var gap = s.actual - s.target, arrow = gap < 0 ? "▼" : "▲";
        out.push('<text x="' + X + '" y="' + (ny + nameLines.length * 17 + 6) + '" text-anchor="middle" font-size="12">' +
          '<tspan fill="' + o.mutedColor + '">Target ' + offFmt(s.target, o.decimalSeparator) + '%  </tspan>' +
          '<tspan fill="' + c + '" font-weight="600">' + arrow + ' ' + offFmt(Math.abs(gap), o.decimalSeparator) + '%</tspan></text>');
      }
    }
  }

  if (isTrellis) {
    for (var a2 = 0; a2 < n; a2++) {
      var nm = offWrap(panels[0].stages[a2].name, 18, 2), X2 = cx(a2);
      for (var r = 0; r < nm.length; r++) {
        out.push('<text x="' + X2 + '" y="' + (axisY + r * 15) + '" text-anchor="middle" font-size="12" font-weight="600" fill="' +
          o.inkColor + '">' + offEsc(nm[r]) + '</text>');
      }
    }
  }

  // ---- header + legend ---------------------------------------------------
  var head = [];
  head.push('<text x="' + padL + '" y="40" font-size="22" font-weight="700" fill="' + o.inkColor + '">' + offEsc(o.title) + '</text>');
  if (o.subtitle) head.push('<text x="' + padL + '" y="62" font-size="13" fill="' + o.mutedColor + '">' + offEsc(o.subtitle) + '</text>');
  if (o.showLegend) {
    var items = [["On / near target", o.goodColor], ["Below target", o.warnColor], ["Well below", o.badColor]];
    var widths = items.map(function (it) { return 16 + it[0].length * 6.6 + 22; });
    var total = widths.reduce(function (x, y) { return x + y; }, 0);
    var curx = W - padR - total;
    for (var m = 0; m < items.length; m++) {
      head.push('<circle cx="' + (curx + 6) + '" cy="30" r="5" fill="' + items[m][1] + '"/>');
      head.push('<text x="' + (curx + 16) + '" y="34" font-size="11.5" fill="' + o.mutedColor + '">' + offEsc(items[m][0]) + '</text>');
      curx += widths[m];
    }
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
    '" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" font-family="' + o.fontStack + '">' +
    head.join("") + out.join("") + '</svg>';
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildOrderFlowSVG: buildOrderFlowSVG };
}
