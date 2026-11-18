import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'

// Ekranda dikey olarak kaç metre görünsün (zoom = 1 iken)
const BOY = 7.4

export async function sahneKur(canvas, yonetici) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)) // retina ekranda bile akıcı kalsın
  renderer.toneMapping = THREE.NeutralToneMapping // renkleri bozmayan, mimari görselleştirme tonu
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false // oda kımıldamıyor: gölgeyi yalnızca gerektiğinde hesapla

  const sahne = new THREE.Scene()
  sahne.background = new THREE.Color('#efebe4')

  // İzometrik görünüm: perspektifsiz (ortografik) kamera
  const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60)

  // Ortam ışığı ve yansımalar: stüdyo HDRI
  const hdr = await new HDRLoader(yonetici).loadAsync(`${import.meta.env.BASE_URL}hdri/studio_small_09_1k.hdr`)
  hdr.mapping = THREE.EquirectangularReflectionMapping
  const pmrem = new THREE.PMREMGenerator(renderer)
  sahne.environment = pmrem.fromEquirectangular(hdr).texture
  hdr.dispose()
  pmrem.dispose()

  // Güneş: arka duvardaki pencereden içeri süzülür, yumuşak gölge düşürür
  const gunes = new THREE.DirectionalLight('#fff1dd', 3.6)
  gunes.position.set(3, 6, 8)
  gunes.castShadow = true
  gunes.shadow.mapSize.set(2048, 2048)
  gunes.shadow.radius = 5
  gunes.shadow.bias = -0.0004
  gunes.shadow.normalBias = 0.02
  Object.assign(gunes.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 })
  sahne.add(gunes)

  // Son işlem: köşelerde yumuşak gölgelenme (AO) + parlak ışıkların hafif hâlesi
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(sahne, kamera))
  const ao = new GTAOPass(sahne, kamera, innerWidth, innerHeight)
  ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 })
  ao.blendIntensity = 0.9
  composer.addPass(ao)
  const hale = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.3, 2.4)
  composer.addPass(hale)
  composer.addPass(new OutputPass())
  // Kenar yumuşatma: MSAA yerine SMAA (aynı görüntü, yaklaşık iki kat hızlı)
  composer.addPass(new SMAAPass())

  function boyutla() {
    const oran = innerWidth / innerHeight
    Object.assign(kamera, { left: (-BOY * oran) / 2, right: (BOY * oran) / 2, top: BOY / 2, bottom: -BOY / 2 })
    kamera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(innerWidth, innerHeight)
  }
  addEventListener('resize', boyutla)
  boyutla()

  // İzometrik bakış yönü (sağ önden, yukarıdan)
  const yon = new THREE.Vector3()
  const sag = new THREE.Vector3()
  const yukari = new THREE.Vector3()
  // hedef: bakılan nokta; ekranX/ekranY: o noktanın ekranda kaydırılacağı oran (-0.5..0.5)
  function kameraAyarla(hedef, zoom, ekranX, ekranY, egimX = 0, egimY = 0) {
    yon.set(1, 0.8 + egimY, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, egimX).normalize()
    kamera.position.copy(hedef).addScaledVector(yon, 25)
    kamera.zoom = zoom
    kamera.updateProjectionMatrix()
    kamera.lookAt(hedef)
    kamera.updateMatrixWorld()
    sag.setFromMatrixColumn(kamera.matrixWorld, 0)
    yukari.setFromMatrixColumn(kamera.matrixWorld, 1)
    const genislik = (kamera.right - kamera.left) / zoom
    kamera.position.addScaledVector(sag, -ekranX * genislik).addScaledVector(yukari, (-ekranY * BOY) / zoom)
  }

  return {
    renderer, sahne, kamera, gunes, kameraAyarla,
    golgeGuncelle: () => (renderer.shadowMap.needsUpdate = true),
    ciz: () => composer.render(),
  }
}
