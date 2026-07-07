/* Calendar Heatmap — SAC custom widget (main component). Self-contained; no external libraries. */

/* =============================================================================
 * Calendar Heatmap — canonical renderer (v0.2)
 * -----------------------------------------------------------------------------
 * Pure function. No DOM dependency, no external libraries. Shared verbatim by
 * the SAC widget (inlined at build time) and preview.html (loaded as <script>).
 *
 * records : [{ date: JS Date (UTC day), value: number }]
 * opts    : see calDefaults() below.
 *
 * v0.2:
 *   - header/legend no longer overlap when the calendar is narrow (the legend
 *     drops onto its own row and a minimum width is enforced);
 *   - calendarType "retail" lays the year out as a 4-4-5 (or 4-5-4 / 5-4-4)
 *     retail calendar from a configurable start date. Because the grid is
 *     week-indexed, a retail period is a whole-week block (rectangular outline).
 * ========================================================================== */

function calDefaults() {
  return {
    title: "Calendar View",
    subtitle: "Daily values by date",
    orientation: "horizontal",
    weekStart: "sunday",
    calendarType: "standard",          // "standard" | "retail"
    retailPattern: "4-4-5",            // "4-4-5" | "4-5-4" | "5-4-4"
    retailStartDate: "",               // e.g. "2013-02-03"; blank => auto
    cellSize: 15,
    colorLow:  "#1A9850",
    colorMid:  "#FFFFBF",
    colorHigh: "#D73027",
    reverseScale: false,
    scaleMode: "auto",
    domainMin: 0, domainMid: 50, domainMax: 100,
    emptyColor: "#EEF1F4",
    showLegend: true,
    showMonthLabels: true,
    showWeekdayLabels: true,
    showYearLabels: true,
    inkColor:  "#33414A",
    mutedColor:"#8794A0",
    gridLine:  "#333333",
    fontStack: "'72','72full',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  };
}

function calEsc(s){ return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
function calHexToRgb(h){ h=h.replace("#",""); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function calRgb(r){ return "#"+r.map(function(v){var s=Math.max(0,Math.min(255,Math.round(v))).toString(16);return s.length<2?"0"+s:s;}).join(""); }
function calLerp(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function calFmt(v){
  if(v==null||!isFinite(v)) return "";
  var neg=v<0; v=Math.abs(v);
  var s=(Math.round(v*100)/100).toString();
  var p=s.split("."); p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g," ");
  return (neg?"-":"")+p.join(".");
}
function calMedian(sorted){ var n=sorted.length; if(!n) return 0; var m=Math.floor(n/2); return n%2? sorted[m] : (sorted[m-1]+sorted[m])/2; }
function calKey(d){ return d.getUTCFullYear()+"-"+(d.getUTCMonth()+1)+"-"+d.getUTCDate(); }

function calParseDate(s){
  if(s instanceof Date) return isNaN(s.getTime())?null:s;
  if(s==null||s==="") return null;
  s=String(s).trim();
  var digits=s.replace(/[^0-9]/g,"");
  if(digits.length>=8){ var y=+digits.slice(0,4),m=+digits.slice(4,6),d=+digits.slice(6,8);
    if(y>1900&&m>=1&&m<=12&&d>=1&&d<=31) return new Date(Date.UTC(y,m-1,d)); }
  var iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(iso) return new Date(Date.UTC(+iso[1],+iso[2]-1,+iso[3]));
  var t=Date.parse(s); if(!isNaN(t)){ var dt=new Date(t); return new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate())); }
  return null;
}

function calMakeColorFn(o, values){
  var lo, mid, hi;
  if(o.scaleMode==="manual"){ lo=+o.domainMin; mid=+o.domainMid; hi=+o.domainMax; }
  else { var s=values.slice().sort(function(a,b){return a-b;}); lo=s[0]; hi=s[s.length-1]; mid=calMedian(s); }
  var cLow=calHexToRgb(o.reverseScale?o.colorHigh:o.colorLow);
  var cMid=calHexToRgb(o.colorMid);
  var cHigh=calHexToRgb(o.reverseScale?o.colorLow:o.colorHigh);
  function fn(v){
    if(v==null||!isFinite(v)) return o.emptyColor;
    if(hi<=lo) return calRgb(cMid);
    var t;
    if(v<=mid){ t=mid>lo?(v-lo)/(mid-lo):1; t=Math.max(0,Math.min(1,t)); return calRgb(calLerp(cLow,cMid,t)); }
    t=hi>mid?(v-mid)/(hi-mid):0; t=Math.max(0,Math.min(1,t)); return calRgb(calLerp(cMid,cHigh,t));
  }
  fn.domain={lo:lo,mid:mid,hi:hi};
  return fn;
}

var CAL_MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ----- standard Gregorian year -> grid with month spans ------------------- */
function calStandardGrid(year, weekStartNum){
  var firstWeekStart=Date.UTC(year,0,1)-((new Date(Date.UTC(year,0,1)).getUTCDay()-weekStartNum+7)%7)*86400000;
  var days=[], maxWk=0, d=new Date(Date.UTC(year,0,1)), end=Date.UTC(year,11,31);
  while(d.getTime()<=end){
    var wd=(d.getUTCDay()-weekStartNum+7)%7, wk=Math.floor((d.getTime()-firstWeekStart)/(7*86400000));
    if(wk>maxWk)maxWk=wk;
    days.push({date:new Date(d.getTime()),wd:wd,wk:wk});
    d=new Date(d.getTime()+86400000);
  }
  var spans=[];
  for(var m=0;m<12;m++){
    var f=new Date(Date.UTC(year,m,1)), l=new Date(Date.UTC(year,m+1,0));
    function pos(dt){ return {wk:Math.floor((dt.getTime()-firstWeekStart)/(7*86400000)), wd:(dt.getUTCDay()-weekStartNum+7)%7}; }
    var pf=pos(f), pl=pos(l);
    spans.push({first:pf,last:pl,label:CAL_MONTHS[m],labelWk:pf.wk});
  }
  return {yearLabel:""+year, days:days, maxWk:maxWk, spans:spans};
}

/* ----- retail 4-4-5 year -> grid with period spans ------------------------ */
function calRetailPattern(p){
  var m=String(p||"4-4-5").split("-").map(Number).filter(function(x){return x>0;});
  if(m.length!==3) m=[4,4,5];
  var base=[]; for(var q=0;q<4;q++) base=base.concat(m); // 12 periods, 52 weeks
  return base;
}
function calSnapWeekStart(date, weekStartNum){
  var wd=(date.getUTCDay()-weekStartNum+7)%7;
  return new Date(date.getTime()-wd*86400000);
}
function calRetailStarts(minDate, maxDate, start, weekStartNum){
  var s=calSnapWeekStart(start, weekStartNum), yearMs=52*7*86400000;
  while(s.getTime()>minDate.getTime()) s=new Date(s.getTime()-yearMs);
  var out=[], cur=s;
  while(cur.getTime()<=maxDate.getTime()){ out.push(new Date(cur.getTime())); cur=new Date(cur.getTime()+yearMs); }
  if(!out.length) out.push(s);
  return out;
}
function calRetailGrid(start, pattern){
  var total=pattern.reduce(function(a,b){return a+b;},0), days=[];
  for(var i=0;i<total*7;i++){ var d=new Date(start.getTime()+i*86400000); days.push({date:d,wd:i%7,wk:Math.floor(i/7)}); }
  var spans=[], acc=0, startMonth=start.getUTCMonth();
  for(var p=0;p<pattern.length;p++){
    var fWk=acc, lWk=acc+pattern[p]-1;
    // fiscal periods are named sequentially from the fiscal-year start month
    spans.push({first:{wk:fWk,wd:0}, last:{wk:lWk,wd:6}, label:CAL_MONTHS[(startMonth+p)%12], labelWk:fWk});
    acc+=pattern[p];
  }
  return {yearLabel:"FY"+start.getUTCFullYear(), days:days, maxWk:total-1, spans:spans};
}

/* month/period outline; horizontal: x=week,y=weekday ; vertical: x=weekday,y=week */
function calSpanPath(orientation, ox, oy, cell, w0,d0,w1,d1){
  function X(a){ return ox+a*cell; } function Y(b){ return oy+b*cell; }
  if(orientation==="horizontal")
    return "M"+X(w0+1)+","+Y(d0)+" H"+X(w0)+" V"+Y(7)+" H"+X(w1)+" V"+Y(d1+1)+" H"+X(w1+1)+" V"+Y(0)+" H"+X(w0+1)+" Z";
  return "M"+X(d0)+","+Y(w0+1)+" V"+Y(w0)+" H"+X(7)+" V"+Y(w1)+" H"+X(d1+1)+" V"+Y(w1+1)+" H"+X(0)+" V"+Y(w0+1)+" Z";
}

function buildCalendarSVG(records, opts){
  var o=calDefaults();
  opts=opts||{};
  for(var k in opts) if(opts[k]!==undefined && opts[k]!==null && opts[k]!=="") o[k]=opts[k];
  o.cellSize=+o.cellSize||15;

  var byDay={}, values=[], years={}, minD=null, maxD=null;
  (records||[]).forEach(function(r){
    if(!r||!r.date||isNaN(r.date.getTime())) return;
    var v=Number(r.value);
    byDay[calKey(r.date)]= isFinite(v)?v:null;
    if(isFinite(v)) values.push(v);
    years[r.date.getUTCFullYear()]=true;
    if(!minD||r.date<minD) minD=r.date;
    if(!maxD||r.date>maxD) maxD=r.date;
  });
  var yearList=Object.keys(years).map(Number).sort(function(a,b){return a-b;});
  if(!yearList.length || !values.length){
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 120" font-family="'+o.fontStack+'">'+
      '<text x="240" y="60" text-anchor="middle" font-size="14" fill="'+o.mutedColor+'">Bind a date dimension and a measure to begin.</text></svg>';
  }

  var weekStartNum = o.weekStart==="monday"?1:0;
  var color=calMakeColorFn(o, values);
  var cell=o.cellSize, gap=1, horiz=(o.orientation!=="vertical");

  // ---- build grids (standard years or retail years) ----------------------
  var grids;
  if(o.calendarType==="retail"){
    var pattern=calRetailPattern(o.retailPattern);
    var start=calParseDate(o.retailStartDate) || new Date(Date.UTC(yearList[0],0,1));
    grids=calRetailStarts(minD,maxD,start,weekStartNum).map(function(s){ return calRetailGrid(s,pattern); });
  } else {
    grids=yearList.map(function(y){ return calStandardGrid(y,weekStartNum); });
  }
  var nWeeks=grids.reduce(function(mx,g){ return Math.max(mx,g.maxWk); },0)+1;

  var wdFull=weekStartNum===1?["Mo","Tu","We","Th","Fr","Sa","Su"]:["Su","Mo","Tu","We","Th","Fr","Sa"];
  var wdShort=wdFull.map(function(s){return s[0];});
  var padL=18, padR=18, padB=20;

  // ---- horizontal / vertical X-metrics + content width -------------------
  var W, gx0, bandH, bandGap, monthH, monthGutter, yearLabelH, wdHeaderH, colBlock, colGap;
  if(horiz){
    var yearGutter=o.showYearLabels?40:6, wdGutter=o.showWeekdayLabels?16:0; monthH=o.showMonthLabels?15:2; bandGap=24;
    gx0=padL+yearGutter+wdGutter; bandH=monthH+7*cell;
    W=gx0+nWeeks*cell+padR;
  } else {
    monthGutter=o.showMonthLabels?30:6; yearLabelH=o.showYearLabels?20:2; wdHeaderH=o.showWeekdayLabels?15:0; colGap=26;
    colBlock=monthGutter+7*cell;
    W=padL+grids.length*(colBlock+colGap)-colGap+padR;
  }

  // ---- header + legend placement (fixes the narrow-width overlap) ---------
  var titleY=34, subY=o.subtitle?54:34;
  var legendW=o.showLegend?150:0;
  var titleRight=padL+(o.title?o.title.length*11.5:0);
  var minW=Math.max(titleRight+padR, padL+legendW+padR, 300);
  if(W<minW) W=minW;
  var legendInline = o.showLegend && ((W-padR-legendW) > (titleRight+16));
  var legendX, legendY, headerH;
  if(o.showLegend && !legendInline){ legendX=padL; legendY=subY+16; headerH=legendY+10+14+12; }
  else { legendX=W-padR-legendW; legendY=30; headerH=subY+22; }

  var cells=[], outlines=[], labels=[], H;

  if(horiz){
    H=headerH+grids.length*(bandH+bandGap)-bandGap+padB;
    grids.forEach(function(g, yi){
      var bandY=headerH+yi*(bandH+bandGap), gy=bandY+monthH;
      g.days.forEach(function(day){
        var v=byDay[calKey(day.date)];
        cells.push('<rect x="'+(gx0+day.wk*cell)+'" y="'+(gy+day.wd*cell)+'" width="'+(cell-gap)+'" height="'+(cell-gap)+'" rx="1.5" fill="'+color(v==null?null:v)+'"/>');
      });
      g.spans.forEach(function(sp){
        outlines.push('<path d="'+calSpanPath("horizontal",gx0,gy,cell,sp.first.wk,sp.first.wd,sp.last.wk,sp.last.wd)+'" fill="none" stroke="'+o.gridLine+'" stroke-width="1"/>');
        if(o.showMonthLabels) labels.push('<text x="'+(gx0+sp.labelWk*cell)+'" y="'+(bandY+monthH-4)+'" font-size="10.5" fill="'+o.mutedColor+'">'+sp.label+'</text>');
      });
      if(o.showWeekdayLabels) for(var wd=0;wd<7;wd++)
        labels.push('<text x="'+(gx0-4)+'" y="'+(gy+wd*cell+cell*0.72)+'" text-anchor="end" font-size="9.5" fill="'+o.mutedColor+'">'+wdShort[wd]+'</text>');
      if(o.showYearLabels) labels.push('<text x="'+padL+'" y="'+(gy+3.5*cell+4)+'" font-size="13" font-weight="700" fill="'+o.inkColor+'">'+g.yearLabel+'</text>');
    });
  } else {
    var gy0=headerH+yearLabelH+wdHeaderH;
    H=gy0+nWeeks*cell+padB;
    grids.forEach(function(g, yi){
      var blockX=padL+yi*(colBlock+colGap), gx=blockX+monthGutter;
      g.days.forEach(function(day){
        var v=byDay[calKey(day.date)];
        cells.push('<rect x="'+(gx+day.wd*cell)+'" y="'+(gy0+day.wk*cell)+'" width="'+(cell-gap)+'" height="'+(cell-gap)+'" rx="1.5" fill="'+color(v==null?null:v)+'"/>');
      });
      g.spans.forEach(function(sp){
        outlines.push('<path d="'+calSpanPath("vertical",gx,gy0,cell,sp.first.wk,sp.first.wd,sp.last.wk,sp.last.wd)+'" fill="none" stroke="'+o.gridLine+'" stroke-width="1"/>');
        if(o.showMonthLabels) labels.push('<text x="'+(gx-6)+'" y="'+(gy0+sp.labelWk*cell+cell*0.72)+'" text-anchor="end" font-size="10.5" fill="'+o.mutedColor+'">'+sp.label+'</text>');
      });
      if(o.showWeekdayLabels) for(var wd=0;wd<7;wd++)
        labels.push('<text x="'+(gx+wd*cell+cell*0.5)+'" y="'+(gy0-4)+'" text-anchor="middle" font-size="9.5" fill="'+o.mutedColor+'">'+wdShort[wd]+'</text>');
      if(o.showYearLabels) labels.push('<text x="'+(gx+3.5*cell)+'" y="'+(headerH+14)+'" text-anchor="middle" font-size="13" font-weight="700" fill="'+o.inkColor+'">'+g.yearLabel+'</text>');
    });
  }

  // ---- header markup + legend --------------------------------------------
  var head=[];
  head.push('<text x="'+padL+'" y="'+titleY+'" font-size="22" font-weight="700" fill="'+o.inkColor+'">'+calEsc(o.title)+'</text>');
  if(o.subtitle) head.push('<text x="'+padL+'" y="'+subY+'" font-size="13" fill="'+o.mutedColor+'">'+calEsc(o.subtitle)+'</text>');
  if(o.showLegend){
    var c0=color(color.domain.lo), c1=color(color.domain.mid), c2=color(color.domain.hi);
    head.push('<defs><linearGradient id="cal-leg" x1="0" y1="0" x2="1" y2="0">'+
      '<stop offset="0%" stop-color="'+c0+'"/><stop offset="50%" stop-color="'+c1+'"/><stop offset="100%" stop-color="'+c2+'"/></linearGradient></defs>');
    head.push('<rect x="'+legendX+'" y="'+legendY+'" width="'+legendW+'" height="10" rx="2" fill="url(#cal-leg)" stroke="#D5DBE0" stroke-width="0.5"/>');
    head.push('<text x="'+legendX+'" y="'+(legendY+23)+'" font-size="10" fill="'+o.mutedColor+'">'+calFmt(color.domain.lo)+'</text>');
    head.push('<text x="'+(legendX+legendW/2)+'" y="'+(legendY+23)+'" text-anchor="middle" font-size="10" fill="'+o.mutedColor+'">'+calFmt(color.domain.mid)+'</text>');
    head.push('<text x="'+(legendX+legendW)+'" y="'+(legendY+23)+'" text-anchor="end" font-size="10" fill="'+o.mutedColor+'">'+calFmt(color.domain.hi)+'</text>');
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+
    '" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" font-family="'+o.fontStack+'">'+
    head.join("")+cells.join("")+outlines.join("")+labels.join("")+'</svg>';
}

if(typeof module!=="undefined" && module.exports){ module.exports={ buildCalendarSVG:buildCalendarSVG }; }

/* =============================================================================
 * Calendar Heatmap — SAC main web component (v0.1)
 * -----------------------------------------------------------------------------
 * Data model:
 *   - 1 dimension = the date field (day granularity).
 *   - 1 measure   = the value to heat-map.
 * ========================================================================== */

(function () {
  "use strict";

  var template = document.createElement("template");
  template.innerHTML =
    '<style>' +
    '  :host { display:block; width:100%; height:100%; }' +
    '  #root { width:100%; height:100%; overflow:hidden; }' +
    '  #root svg { display:block; width:100%; height:100%; }' +
    '  .cal-msg { width:100%; height:100%; display:flex; align-items:center; justify-content:center;' +
    '             font-family:\'72\',-apple-system,\'Segoe UI\',Roboto,sans-serif; color:#8794A0; font-size:13px; text-align:center; padding:0 16px; }' +
    '</style>' +
    '<div id="root"></div>';

  function parseMetadata(metadata) {
    var dims = [], meas = [];
    var dMap = (metadata && metadata.dimensions) || {};
    var mMap = (metadata && metadata.mainStructureMembers) || {};
    for (var dk in dMap) dims.push(Object.assign({ key: dk }, dMap[dk]));
    for (var mk in mMap) meas.push(Object.assign({ key: mk }, mMap[mk]));
    return { dims: dims, meas: meas };
  }

  // Turn a SAC date-dimension cell into a UTC JS Date. SAC day members arrive in
  // varied shapes (YYYYMMDD, YYYY-MM-DD, ISO timestamps, or a formatted label),
  // so try id then label and normalise defensively.
  function parseSacDate(cell) {
    if (!cell) return null;
    var candidates = [cell.id, cell.label, cell.description];
    for (var i = 0; i < candidates.length; i++) {
      var raw = candidates[i];
      if (raw == null) continue;
      var s = String(raw).trim();

      var digits = s.replace(/[^0-9]/g, "");
      if (digits.length >= 8) {                    // YYYYMMDD... (ignore any time part)
        var y = +digits.slice(0, 4), m = +digits.slice(4, 6), d = +digits.slice(6, 8);
        if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31)
          return new Date(Date.UTC(y, m - 1, d));
      }
      var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));

      var t = Date.parse(s);
      if (!isNaN(t)) { var dt = new Date(t); return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())); }
    }
    return null;
  }

  function buildRecords(dataBinding) {
    var data = dataBinding.data || [];
    var meta = parseMetadata(dataBinding.metadata);
    if (!meta.dims.length || !meta.meas.length) return [];
    var dateKey = meta.dims[0].key, measKey = meta.meas[0].key;
    var recs = [];
    data.forEach(function (row) {
      var date = parseSacDate(row[dateKey]);
      if (!date || isNaN(date.getTime())) return;
      var v = Number(row[measKey] && row[measKey].raw);
      recs.push({ date: date, value: isFinite(v) ? v : null });
    });
    return recs;
  }

  class CalendarHeatmap extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(template.content.cloneNode(true));
      this._root = this._shadowRoot.getElementById("root");
      this._props = {};
    }

    onCustomWidgetBeforeUpdate(changedProps) { this._props = Object.assign({}, this._props, changedProps); }
    onCustomWidgetAfterUpdate() { this.render(); }
    onCustomWidgetResize() { this.render(); }
    onCustomWidgetDestroy() { this._root.innerHTML = ""; }

    render() {
      if (!document.contains(this)) { setTimeout(this.render.bind(this), 0); return; }
      var binding = this.dataBinding;
      if (!binding || binding.state !== "success") {
        this._root.innerHTML = '<div class="cal-msg">Bind a date dimension and a measure to see the calendar.</div>';
        return;
      }
      var records = buildRecords(binding);
      if (!records.length) {
        this._root.innerHTML = '<div class="cal-msg">No parseable dates in the bound dimension. Use a day-granularity date field.</div>';
        return;
      }
      this._root.innerHTML = buildCalendarSVG(records, this._props);
    }
  }

  customElements.define("com-dvc-sac-calendarheatmap", CalendarHeatmap);
})();
