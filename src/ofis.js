import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

// Blender'da kodla kurulan oda: duvarlar, mobilyalar, sunucu dolabı (Draco ile sıkıştırılmış)
export async function ofisYukle(yonetici, ekranDokusu) {
  const draco = new DRACOLoader(yonetici).setDecoderPath(`${import.meta.env.BASE_URL}draco/`)
  const gltf = await new GLTFLoader(yonetici).setDRACOLoader(draco).loadAsync(`${import.meta.env.BASE_URL}model/ofis.glb`)
  const ofis = gltf.scene

  const ledler = []
  const lambaCamlari = new Set()
  let lambaCam = null

  ofis.traverse((o) => {
    if (!o.isMesh) return
    const m = o.material
    // Saydam yüzeyler (pencere camı, çerçeve camı) gölge düşürmesin
    o.castShadow = !m.transparent
    o.receiveShadow = true
    if (m.transparent) {
      m.depthWrite = false
      m.envMapIntensity = 0.25 // cam aynaya dönmesin, arkası görünsün
    }

    if (m.name === 'parke') {
      // Meşe parke: dokunun turuncusunu biraz söndür, yüzey pürüzünü yumuşat
      m.normalScale.setScalar(0.5)
      m.envMapIntensity = 0.6
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, 0.62);`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = max(roughnessFactor, 0.62); // cilalı ama ayna değil`)
      }
    }
    if (m.name === 'hanging_picture_frame_02_glass') {
      o.material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.08, depthWrite: false, envMapIntensity: 0.4 })
      o.castShadow = false
    }
    if (m.name === 'hanging_picture_frame_02_artwork') {
      o.material = new THREE.MeshStandardMaterial({ map: tabloDokusu(), roughness: 0.85 })
    }
    if (/modern_ceiling_(globe|lamp_01_glass)/.test(m.name)) lambaCamlari.add(m)

    if (o.name === 'ekran') {
      // Monitör: parlak siyah cam, içinde canlı arayüz
      o.material = new THREE.MeshStandardMaterial({
        color: '#050607', roughness: 0.18, metalness: 0,
        emissive: '#ffffff', emissiveMap: ekranDokusu, emissiveIntensity: 1,
      })
    }
    if (o.name.startsWith('led_')) {
      o.material = m.clone() // her LED kendi hızında yanıp sönsün
      ledler.push(o)
    }
    if (m.name === 'modern_ceiling_globe') lambaCam = o
  })

  // Sarkıt lambanın ampulü: gece yanar
  const lamba = new THREE.PointLight('#ffcf94', 0, 5, 2)
  if (lambaCam) lambaCam.getWorldPosition(lamba.position)
  lamba.position.y -= 0.05
  ofis.add(lamba)

  const tabelaYeri = ofis.getObjectByName('tabela_yeri').getWorldPosition(new THREE.Vector3())

  // Odayı kuran parçalar: önce zemin ve duvarlar, sonra mobilyalar sırayla düşer
  const gruplar = new Map()
  for (const o of ofis.getObjectByName('ofis').children) {
    const ad = /^(led|sunucu)/.test(o.name) ? 'sunucu'
      : /^(klavye|fare|kupa|ekran|monitor)/.test(o.name) ? 'monitor'
      : /^(pencere|cam|denizlik)/.test(o.name) ? 'pencere'
      : /_0\d/.test(o.name) ? o.name : o.name.split('_')[0]
    if (!gruplar.has(ad)) gruplar.set(ad, [])
    gruplar.get(ad).push(o)
  }
  const kabuk = ['zemin', 'taban', 'duvar', 'supurgelik', 'pencere', 'hali']
  const sirali = [...gruplar.entries()].sort(([a], [b]) => (kabuk.includes(b) ? 1 : 0) - (kabuk.includes(a) ? 1 : 0))

  return {
    ofis,
    lamba,
    tabelaYeri,
    gruplar: sirali.map(([, parcalar]) => parcalar),
    kabukSayisi: sirali.filter(([ad]) => kabuk.includes(ad)).length,
    guncelle(t, gece) {
      // Sunucu LED'leri: her biri farklı ritimde, gece daha parlak
      ledler.forEach((led, i) => {
        const yanik = Math.sin(t * (2 + i * 0.7) + i * 1.9) > -0.2 ? 1 : 0.15
        led.material.emissiveIntensity = (3 + gece * 5) * yanik
      })
      lamba.intensity = gece * 3.2
      // Opal cam küre içten aydınlanır
      for (const m of lambaCamlari) {
        m.emissive.set('#ffd8a8')
        m.emissiveIntensity = gece * 1.6
      }
    },
  }
}

// Duvardaki tablo: sıcak tonlarda soyut bir baskı (kodla çizilir, dosya indirmeye gerek yok)
function tabloDokusu() {
  const t = document.createElement('canvas')
  t.width = 512
  t.height = 384
  const g = t.getContext('2d')
  g.fillStyle = '#e9dfcf'
  g.fillRect(0, 0, 512, 384)
  g.fillStyle = '#c8643f'
  g.beginPath()
  g.arc(300, 170, 92, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#5f7f6c'
  g.fillRect(70, 230, 380, 100)
  g.fillStyle = '#23302b'
  g.beginPath()
  g.arc(170, 230, 70, Math.PI, 0)
  g.fill()
  // Kâğıt dokusu: hafif gren
  const veri = g.getImageData(0, 0, 512, 384)
  for (let i = 0; i < veri.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14
    veri.data[i] += n
    veri.data[i + 1] += n
    veri.data[i + 2] += n
  }
  g.putImageData(veri, 0, 0)
  const doku = new THREE.CanvasTexture(t)
  doku.colorSpace = THREE.SRGBColorSpace
  doku.flipY = false
  return doku
}
