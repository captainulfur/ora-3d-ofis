import * as THREE from 'three'

// Monitörde canlı çalışan ORA: görevler tek tek yazılır, tamamlanınca işaretlenir
const GOREVLER = [
  ['48 e-posta okundu', '6 tanesi önemli, yanıt taslakları hazır'],
  ['Toplantı ayarlandı', 'Perşembe 10:00 · Deniz, Ayşe, Mert'],
  ['Fatura #2041 kesildi', 'Kuzey Mimarlık · ₺18.400 · gönderildi'],
  ['Rapor hazırlandı', 'Ekim satışları %12 arttı'],
  ['Müşteriye yanıt verildi', '“Siparişiniz yarın kargoda.”'],
]

export function ekranKur() {
  const tuval = document.createElement('canvas')
  tuval.width = 1024
  tuval.height = 588 // monitörün oranı: 61 × 35 cm
  const g = tuval.getContext('2d')
  const doku = new THREE.CanvasTexture(tuval)
  doku.colorSpace = THREE.SRGBColorSpace
  doku.flipY = false // glTF modellerinde dokular ters çevrilmez
  doku.anisotropy = 4

  let sonCizim = -1

  function ciz(t) {
    const W = tuval.width
    const H = tuval.height
    g.fillStyle = '#0d1214'
    g.fillRect(0, 0, W, H)

    // Kenar çubuğu
    g.fillStyle = '#131a1d'
    g.fillRect(0, 0, 210, H)
    g.fillStyle = '#5fd3c2'
    g.beginPath()
    g.arc(46, 52, 11, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#e8f1ef'
    g.font = '800 30px Manrope, sans-serif'
    g.fillText('ORA', 68, 63)
    g.font = '500 22px Manrope, sans-serif'
    ;['Gelen kutusu', 'Takvim', 'Faturalar', 'Raporlar'].forEach((ad, i) => {
      g.fillStyle = i === Math.floor(t / 3.2) % 4 ? '#e8f1ef' : '#62716f'
      g.fillText(ad, 36, 140 + i * 50)
    })

    // Görev listesi: her 3,2 saniyede bir yeni görev yazılmaya başlar
    const adim = t / 3.2
    const sira = Math.floor(adim)
    g.font = '700 25px Manrope, sans-serif'
    g.fillStyle = '#62716f'
    g.fillText('Bugün ORA', 250, 64)

    for (let i = 0; i < 4; i++) {
      const no = sira - 3 + i
      if (no < 0) continue
      const [baslik, alt] = GOREVLER[no % GOREVLER.length]
      const y = 120 + i * 112
      const yeni = i === 3
      const ilerleme = yeni ? adim - sira : 1

      g.fillStyle = yeni ? '#16262a' : '#121a1d'
      g.beginPath()
      g.roundRect(240, y - 6, 744, 92, 16)
      g.fill()

      // Durum: yazılıyorsa dönen halka, bittiyse onay işareti
      g.lineWidth = 4
      g.strokeStyle = '#5fd3c2'
      g.beginPath()
      if (ilerleme < 0.7) g.arc(282, y + 40, 15, t * 6, t * 6 + 4.2)
      else {
        g.moveTo(272, y + 40)
        g.lineTo(280, y + 49)
        g.lineTo(294, y + 30)
      }
      g.stroke()

      const harf = Math.floor(Math.min(1, ilerleme / 0.6) * (baslik.length + alt.length))
      g.fillStyle = '#e8f1ef'
      g.font = '700 27px Manrope, sans-serif'
      g.fillText(baslik.slice(0, harf), 320, y + 32)
      g.fillStyle = '#8a9a97'
      g.font = '500 22px Manrope, sans-serif'
      g.fillText(alt.slice(0, Math.max(0, harf - baslik.length)), 320, y + 66)
    }
    doku.needsUpdate = true
  }

  return {
    doku,
    // Saniyede 20 kare yeter: ekran her karede yeniden çizilmez
    guncelle(t) {
      const kare = Math.floor(t * 20)
      if (kare === sonCizim) return
      sonCizim = kare
      ciz(t)
    },
  }
}
