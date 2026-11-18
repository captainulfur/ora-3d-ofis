import 'lenis/dist/lenis.css'
import './style.css'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { sahneKur } from './sahne.js'
import { ekranKur } from './ekran.js'
import { ofisYukle } from './ofis.js'
import { tabelaKur } from './tabela.js'

gsap.registerPlugin(ScrollTrigger)

// Bütün dosyalar tek yöneticiden yüklenir; çizgi gerçek ilerlemeyi gösterir
const yonetici = new THREE.LoadingManager()
yonetici.onProgress = (_, yuklenen, toplam) => {
  gsap.to('#yuklemeCizgi', { width: `${(yuklenen / toplam) * 140}px`, duration: 0.3 })
}

const lenis = new Lenis({ lerp: 0.09 })
lenis.stop()
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(500, 33) // takılma olursa animasyon atlamasın, yavaşlasın

const s = await sahneKur(document.getElementById('sahne'), yonetici)
const ekran = ekranKur()
const o = await ofisYukle(yonetici, ekran.doku)
s.sahne.add(o.ofis)
const t = tabelaKur(o.tabelaYeri)
s.sahne.add(t.tabela, t.isik)

// Kaydırma bu değerleri değiştirir, her karede sahneye uygulanır
// h: bakılan nokta, zoom: yakınlık, ex/ey: odanın ekrandaki yeri, gece: 0 gündüz → 1 gece
const d = { hx: 0, hy: 1.1, hz: 0, zoom: 1, ex: 0.17, ey: 0, gece: 0 }

const duraklar = [
  { hx: -2.05, hy: 1, hz: 0.3, zoom: 2.7, ex: -0.2, ey: 0 },     // masa ve monitör
  { hx: -1.45, hy: 1.1, hz: 2, zoom: 2.4, ex: 0.2, ey: 0 },      // sunucu dolabı
  { hx: 1.1, hy: 0.6, hz: 1.5, zoom: 2, ex: -0.2, ey: 0 },       // kanepe köşesi
  { hx: 0, hy: 1.1, hz: 0, zoom: 1.05, ex: 0.17, ey: 0, gece: 1 }, // gece: bütün oda
  { hx: 0, hy: 1.1, hz: 0, zoom: 0.68, ex: 0, ey: -0.27 },       // son: oda aşağıda, yazı üstte
]

const tl = gsap.timeline({
  scrollTrigger: { trigger: '#hikaye', start: 'top top', end: 'bottom bottom', scrub: 1.2 },
})
duraklar.forEach((durak, i) => tl.to(d, { ...durak, duration: 1, ease: 'power2.inOut' }, i))

// Metinler bölüme girince yumuşakça belirir
document.querySelectorAll('.bolum:not(.giris)').forEach((bolum) => {
  gsap.from(bolum.querySelector('.kart')?.children ?? bolum.children, {
    y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: 'power3.out',
    scrollTrigger: { trigger: bolum, start: 'top 70%', toggleActions: 'play none none reverse' },
  })
})

// Gece olurken sayfanın renkleri de kararır
const kok = document.documentElement.style
const renkler = {
  '--zemin': gsap.utils.interpolate('#efebe4', '#111417'),
  '--yazi': gsap.utils.interpolate('#1d1c1a', '#eef2f0'),
  '--soluk': gsap.utils.interpolate('#6f6b64', '#8d9895'),
  '--vurgu': gsap.utils.interpolate('#2f6f68', '#7ff5e3'),
}
const gunesGunduz = new THREE.Color('#fff1dd')
const gunesGece = new THREE.Color('#9db8ff')
let sonGece = -1
function geceUygula(g) {
  if (g === sonGece) return
  sonGece = g
  for (const ad in renkler) kok.setProperty(ad, renkler[ad](g))
  s.sahne.background.set(renkler['--zemin'](g))
  s.sahne.environmentIntensity = 0.75 - g * 0.65
  s.gunes.color.lerpColors(gunesGunduz, gunesGece, g) // gece pencereden ay ışığı girer
  s.gunes.intensity = 3.6 - g * 3.2
}

// Fare ile hafif bakış açısı değişimi
const egim = { x: 0, y: 0, hx: 0, hy: 0 }
addEventListener('pointermove', (e) => {
  egim.hx = (e.clientX / innerWidth - 0.5) * 0.12
  egim.hy = (e.clientY / innerHeight - 0.5) * 0.08
})

const hedef = new THREE.Vector3()

// Bütün shader'ları perde kalkmadan derle: açılış animasyonu takılmasın
s.kameraAyarla(hedef.set(d.hx, d.hy, d.hz), d.zoom, d.ex, d.ey)
await s.renderer.compileAsync(s.sahne, s.kamera)
s.ciz()
let golgeAcik = true // oda kurulurken gölge her karede yeniden hesaplanır

gsap.ticker.add((zaman) => {
  egim.x += (egim.hx - egim.x) * 0.05
  egim.y += (egim.hy - egim.y) * 0.05
  s.kameraAyarla(hedef.set(d.hx, d.hy, d.hz), d.zoom, d.ex, d.ey, egim.x, egim.y)
  geceUygula(d.gece)
  ekran.guncelle(zaman)
  o.guncelle(zaman, d.gece)
  t.guncelle(zaman, d.gece)
  if (golgeAcik) s.golgeGuncelle()
  s.ciz()
})

// Yükleme bitti: perde açılır, oda parça parça kurulur
const acilis = gsap.timeline()
acilis.to('#yukleme', { opacity: 0, duration: 0.7, delay: 0.2, onComplete: () => document.getElementById('yukleme')?.remove() })
o.gruplar.forEach((parcalar, i) => {
  const yukseklik = i < o.kabukSayisi ? 0 : 3.5 // zemin ve duvarlar yerinde büyür, eşyalar yukarıdan düşer
  parcalar.forEach((p) => {
    if (yukseklik) acilis.from(p.position, { y: `+=${yukseklik}`, duration: 0.9, ease: 'bounce.out' }, 0.5 + i * 0.07)
    else acilis.from(p.scale, { y: 0.001, duration: 0.8, ease: 'power3.out' }, 0.3 + i * 0.08)
  })
})
acilis
  .from(d, { zoom: 0.8, duration: 2.6, ease: 'power3.out' }, 0.2)
  .from('.giris > *, .ust', { y: 24, opacity: 0, duration: 1, stagger: 0.08 }, 1.2)
  .add(() => {
    golgeAcik = false
    s.golgeGuncelle()
    lenis.start()
  })
