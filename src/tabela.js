import * as THREE from 'three'

// Duvardaki "ORA" neon tabelası: her harf bükülmüş gerçek bir cam boru (TubeGeometry)
const HARFLER = [
  // O: elips
  Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2
    return [0.13 + Math.cos(a) * 0.13, 0.17 + Math.sin(a) * 0.17]
  }),
  // R: gövde, kıvrım ve bacak
  [[0.36, 0], [0.36, 0.34], [0.5, 0.34], [0.57, 0.3], [0.59, 0.25], [0.57, 0.2], [0.5, 0.17], [0.36, 0.17], [0.47, 0.17], [0.6, 0]],
  // A: iki eğik çizgi ve ara çizgi
  [[0.68, 0], [0.8, 0.34], [0.92, 0]],
  [[0.72, 0.11], [0.88, 0.11]],
]

export function tabelaKur(yer) {
  const tabela = new THREE.Group()
  // Neon kendi ışığını yayar: renk 1'in üstüne çıkınca son işlemdeki hâle (bloom) parlar
  const malzeme = new THREE.MeshBasicMaterial({ color: '#7ff5e3' })
  const renk = new THREE.Color('#7ff5e3')

  for (const harf of HARFLER) {
    const yol = new THREE.CatmullRomCurve3(harf.map(([x, y]) => new THREE.Vector3(x, y, 0)), harf.length === 33, 'centripetal', 0.1)
    tabela.add(new THREE.Mesh(new THREE.TubeGeometry(yol, harf.length * 8, 0.011, 8, harf.length === 33), malzeme))
  }

  // Arkada şeffaf akrilik levha ve duvara tutturan dört vida
  const levha = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.52, 0.012),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, transmission: 0.9, thickness: 0.01, transparent: true, opacity: 0.35 }),
  )
  levha.position.set(0.46, 0.17, -0.025)
  tabela.add(levha)

  // Sola bakan duvar düzleminde dur, kameraya dönük oku
  tabela.position.copy(yer).add(new THREE.Vector3(0.46, -0.17, -0.04))
  tabela.rotation.y = Math.PI

  // Duvara düşen renkli ışık
  const isik = new THREE.PointLight('#7ff5e3', 0, 2.6, 2)
  isik.position.copy(yer).add(new THREE.Vector3(0, -0.1, -0.5))

  return {
    tabela,
    isik,
    // parlaklik: 0 = gündüz (soluk), 1 = gece (tam parlak), titreme: neonun hafif kıpırtısı
    guncelle(t, gece) {
      const titreme = 1 - Math.max(0, Math.sin(t * 23) * Math.sin(t * 3.1) - 0.85) * 2
      malzeme.color.copy(renk).multiplyScalar((0.9 + gece * 1.5) * titreme)
      isik.intensity = gece * 0.8 * titreme
    },
  }
}
