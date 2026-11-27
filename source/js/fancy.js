/* ======== 个性化小组件：问候语 / 每日一言 / 时间进度 / IP 属地 ======== */
(function () {
  'use strict';

  var HOME = { lat: 34.7466, lon: 113.6254 }; // 博主位置：郑州

  var PROV_CN = {
    Beijing: '北京', Tianjin: '天津', Shanghai: '上海', Chongqing: '重庆',
    Hebei: '河北', Shanxi: '山西', Liaoning: '辽宁', Jilin: '吉林',
    Heilongjiang: '黑龙江', Jiangsu: '江苏', Zhejiang: '浙江', Anhui: '安徽',
    Fujian: '福建', Jiangxi: '江西', Shandong: '山东', Henan: '河南',
    Hubei: '湖北', Hunan: '湖南', Guangdong: '广东', Hainan: '海南',
    Sichuan: '四川', Guizhou: '贵州', Yunnan: '云南', Shaanxi: '陕西',
    Gansu: '甘肃', Qinghai: '青海', Taiwan: '台湾', 'Inner Mongolia': '内蒙古',
    Guangxi: '广西', Tibet: '西藏', Ningxia: '宁夏', Xinjiang: '新疆',
    'Hong Kong': '香港', Macau: '澳门'
  };

  /* ---------- 问候语 ---------- */
  function setGreeting() {
    var el = document.getElementById('greeting-text');
    if (!el) return;
    var h = new Date().getHours();
    var g = '你好';
    if (h < 5) g = '夜深了';
    else if (h < 9) g = '早上好';
    else if (h < 12) g = '上午好';
    else if (h < 14) g = '中午好';
    else if (h < 18) g = '下午好';
    else if (h < 23) g = '晚上好';
    else g = '夜深了';
    el.textContent = g;
  }

  /* ---------- 每日一言 ---------- */
  function loadHitokoto() {
    var el = document.getElementById('hitokoto-text');
    if (!el) return;
    fetch('https://v1.hitokoto.cn/?c=i&encode=json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        el.textContent = '「' + d.hitokoto + '」—— ' + (d.from || '佚名');
      })
      .catch(function () {
        el.textContent = '保持热爱，奔赴山海。';
      });
  }

  /* ---------- IP 属地与距离（依赖 Cloudflare Worker 的 /api/geo） ---------- */
  function toRad(d) { return d * Math.PI / 180; }

  function distanceKm(a, b) {
    var R = 6371;
    var dLat = toRad(b.lat - a.lat);
    var dLon = toRad(b.lon - a.lon);
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(x)));
  }

  function loadGeo() {
    var locEl = document.getElementById('geo-loc');
    var distEl = document.getElementById('geo-dist');
    if (!locEl) return;
    fetch('/api/geo', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (g) {
        if (!g || (!g.city && !g.region)) throw new Error('no geo');
        var region = PROV_CN[g.region] || g.region || '';
        var city = g.city || '';
        var place = g.country === 'CN' || !g.country ? (region + (city ? ' · ' + city : '')) : (city || region || g.country);
        locEl.textContent = '📍 来自 ' + place + ' 的朋友';
        if (distEl && g.lat && g.lon) {
          var km = distanceKm(HOME, { lat: parseFloat(g.lat), lon: parseFloat(g.lon) });
          distEl.textContent = '📏 距离博主约 ' + km + ' 公里';
        }
      })
      .catch(function () {
        locEl.style.display = 'none';
        if (distEl) distEl.style.display = 'none';
      });
  }

  /* ---------- 时间进度卡片 ---------- */
  function bar(label, pct) {
    pct = Math.max(0, Math.min(100, pct));
    return '<div class="tp-row"><span class="tp-label">' + label + '</span>' +
      '<span class="tp-track"><span class="tp-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
      '<span class="tp-pct">' + pct.toFixed(1) + '%</span></div>';
  }

  function updateCard() {
    var now = new Date();
    var y = now.getFullYear();
    var target = new Date(y + 1, 0, 1);
    var days = Math.ceil((target - now) / 86400000);
    var dEl = document.getElementById('tp-days');
    if (dEl) dEl.textContent = days;
    var tEl = document.getElementById('tp-target-date');
    if (tEl) tEl.textContent = (y + 1) + '-01-01';

    var startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var dayPct = ((now - startDay) / 86400000) * 100;
    var weekStart = new Date(startDay);
    weekStart.setDate(startDay.getDate() - ((startDay.getDay() + 6) % 7));
    var weekPct = ((now - weekStart) / (7 * 86400000)) * 100;
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    var monthPct = ((now - monthStart) / (monthEnd - monthStart)) * 100;
    var yearStart = new Date(now.getFullYear(), 0, 1);
    var yearEnd = new Date(now.getFullYear() + 1, 0, 1);
    var yearPct = ((now - yearStart) / (yearEnd - yearStart)) * 100;

    var box = document.getElementById('tp-progress');
    if (box) {
      box.innerHTML = bar('今日', dayPct) + bar('本周', weekPct) + bar('本月', monthPct) + bar('本年', yearPct);
    }
  }

  function buildCard() {
    var aside = document.getElementById('aside-content');
    if (!aside || document.getElementById('time-progress-card')) return;
    var card = document.createElement('div');
    card.id = 'time-progress-card';
    card.className = 'card-widget card-announcement';
    card.innerHTML = '<div class="item-headline"><i class="fas fa-hourglass-half"></i><span>时间进度</span></div>' +
      '<div class="tp-countdown">' +
      '<div class="tp-cd-label">距离 元旦</div>' +
      '<div class="tp-cd-days"><span id="tp-days">--</span><span class="tp-days-unit">天</span></div>' +
      '<div class="tp-cd-date" id="tp-target-date"></div>' +
      '</div><div class="tp-progress" id="tp-progress"></div>';

    var ann = aside.querySelector('.card-announcement');
    if (ann && ann.parentNode === aside) {
      aside.insertBefore(card, ann.nextSibling);
    } else {
      aside.appendChild(card);
    }
    updateCard();
  }

  function init() {
    setGreeting();
    loadHitokoto();
    loadGeo();
    buildCard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
  setInterval(function () {
    if (document.getElementById('time-progress-card')) updateCard();
  }, 60000);
})();
