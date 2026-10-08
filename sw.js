// Service worker 的源文件：assemble.py 换掉两个缓存名里的版本，写到站点目录的 sw.js（发布时拷进 xiaowei-site）
//   CACHE：页面和图标，名字跟着源码里的 VERSION，发新版时整个换掉
//   OCR_CACHE：拍照识别的第三方文件（ocr/，约 20 MB），名字跟着这些文件的内容，文件没变就一直留着：发新版不用重新下载
const CACHE = "xiaowei-v8";
const OCR_CACHE = "xiaowei-ocr-23d7884a0e";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
// 网络超过这么久没回应、缓存里又有，先用缓存：信号弱时打开 App 不用干等
const NET_TIMEOUT = 3000;
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OCR_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// 识别文件：先用缓存，没有才下载并存进 OCR_CACHE
const cacheFirst = (req) => caches.open(OCR_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
  if (res && res.ok) c.put(req, res.clone());
  return res;
})));
// 其余：先走网络（拿到最新版）并更新缓存。NET_TIMEOUT 内没回应、缓存里有，先用缓存（网络回来后照样更新缓存）；
// 网络失败也用缓存；缓存里没有就接着等网络
const networkFirst = (req) => new Promise((resolve, reject) => {
  let done = false;
  const finish = (res) => { if (res && !done) { done = true; resolve(res); } };
  fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    finish(res);
  }, (err) => caches.match(req).then((hit) => { if (hit) finish(hit); else if (!done) { done = true; reject(err); } }));
  setTimeout(() => caches.match(req).then(finish), NET_TIMEOUT);
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(/\/ocr\//.test(e.request.url) ? cacheFirst(e.request) : networkFirst(e.request));
});
