/* 悬浮音乐播放器：APlayer + Meting 歌单接口（开源组件） */
(function () {
  'use strict';
  var API = 'https://api.i-meto.com/meting/api?server=netease&type=playlist&id=3778678';

  function mount() {
    if (document.getElementById('music-dock')) return;
    if (typeof APlayer === 'undefined') return;
    var dock = document.createElement('div');
    dock.id = 'music-dock';
    document.body.appendChild(dock);

    fetch(API)
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) throw new Error('empty playlist');
        new APlayer({
          container: dock,
          theme: '#eebfc3',
          loop: 'all',
          order: 'random',
          preload: 'none',
          volume: 0.6,
          listFolded: true,
          listMaxHeight: '240px',
          audio: list.map(function (t) {
            return { name: t.title, artist: (t.author || '').replace(/^[\s\-–—]+/, ''), url: t.url, cover: t.pic, lrc: t.lrc };
          })
        });
      })
      .catch(function () { dock.style.display = 'none'; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  document.addEventListener('pjax:complete', mount);
})();
