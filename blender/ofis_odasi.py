# ORA ofisi: izometrik kesit oda. Blender'da kodla kurulur, web için tek bir GLB olarak dışa aktarılır.
# Çalıştırma: Blender -b -P blender/ofis_odasi.py -- <proje-klasoru>
# Birimler metre. Oda merkezde; arka duvarlar x = -2.5 ve y = -2.5 düzlemlerinde.

import bpy, bmesh, math, sys, os
from mathutils import Vector

arg = sys.argv[sys.argv.index('--') + 1:]
PROJE = arg[0]
DOKU = os.path.join(PROJE, 'blender', 'dokular')
MODEL = os.path.join(PROJE, 'blender', 'modeller')

bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- malzemeler
def malzeme(ad, renk, metal=0.0, puruz=0.5, doku=None, isik=0.0, saydam=False, renk_dokusu=True):
    m = bpy.data.materials.new(ad)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*renk, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = puruz
    if isik:
        b.inputs['Emission Color'].default_value = (*renk, 1)
        b.inputs['Emission Strength'].default_value = isik
    if saydam:
        b.inputs['Alpha'].default_value = 0.18
        m.surface_render_method = 'BLENDED'
    if doku:
        def resim(dosya, renkli):
            n = nt.nodes.new('ShaderNodeTexImage')
            n.image = bpy.data.images.load(os.path.join(DOKU, doku, dosya))
            n.image.colorspace_settings.name = 'sRGB' if renkli else 'Non-Color'
            return n
        if renk_dokusu:
            renk_n = resim('renk.jpg', True)
            # Dokunun rengini istenen tonla çarp (glTF'e renk çarpanı olarak gider)
            carp = nt.nodes.new('ShaderNodeMix')
            carp.data_type = 'RGBA'
            carp.blend_type = 'MULTIPLY'
            carp.inputs['Factor'].default_value = 1.0
            nt.links.new(renk_n.outputs['Color'], carp.inputs['A'])
            carp.inputs['B'].default_value = (*renk, 1)
            nt.links.new(carp.outputs['Result'], b.inputs['Base Color'])
        nt.links.new(resim('puruz.jpg', False).outputs['Color'], b.inputs['Roughness'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(resim('normal.jpg', False).outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m


PARKE = malzeme('parke', (0.86, 0.8, 0.74), puruz=0.45, doku='herringbone_parquet')
DUVAR = malzeme('duvar', (0.9, 0.88, 0.84), puruz=0.92, doku='grey_plaster_02', renk_dokusu=False)  # temiz sıva: sadece yüzey dokusu
BETON = malzeme('beton', (0.42, 0.41, 0.4), puruz=0.85)
BEYAZ = malzeme('beyaz_boya', (0.86, 0.85, 0.82), puruz=0.6)
SIYAH_METAL = malzeme('siyah_metal', (0.025, 0.025, 0.028), metal=0.6, puruz=0.45)
CAM = malzeme('cam', (0.8, 0.88, 0.9), puruz=0.05, saydam=True)
# Çalışma köşesi
MESE = malzeme('mese', (1.0, 0.95, 0.9), puruz=0.5, doku='mocha_oak_veneer')
ALUMINYUM = malzeme('aluminyum', (0.72, 0.72, 0.74), metal=1.0, puruz=0.28)
PLASTIK = malzeme('plastik', (0.08, 0.08, 0.09), puruz=0.55)
SERAMIK = malzeme('seramik', (0.9, 0.88, 0.84), puruz=0.3)
EKRAN = malzeme('ekran', (0.02, 0.025, 0.04), puruz=0.2, isik=0.5)
# Sunucu dolabı
SUNUCU = malzeme('sunucu', (0.05, 0.055, 0.06), metal=0.4, puruz=0.5)
LED = malzeme('led', (0.25, 0.85, 1.0), isik=6.0)
# Dinlenme köşesi
KUMAS = malzeme('kumas', (0.74, 0.71, 0.66), puruz=1.0, doku='wool_boucle', renk_dokusu=False)
HALI = malzeme('hali', (0.78, 0.74, 0.68), puruz=1.0, doku='wool_boucle', renk_dokusu=False)
SAKSI = malzeme('saksi', (0.55, 0.52, 0.48), puruz=0.8)
TOPRAK = malzeme('toprak', (0.12, 0.09, 0.07), puruz=1.0)


# ---------------------------------------------------------------- yardımcılar
def kutu_uv(o, olcek=0.5):
    """Dokuyu yüzeyin gerçek ölçüsüne göre sar (uzamasın)."""
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            p = o.matrix_world @ l.vert.co
            if abs(n.z) > 0.5:
                l[uv].uv = (p.x * olcek, p.y * olcek)
            elif abs(n.x) > 0.5:
                l[uv].uv = (p.y * olcek, p.z * olcek)
            else:
                l[uv].uv = (p.x * olcek, p.z * olcek)
    bm.to_mesh(me)
    bm.free()


def kutu(ad, mal, merkez, boyut, pah=0.0, uv_olcek=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=merkez)
    o = bpy.context.active_object
    o.name = o.data.name = ad
    o.scale = boyut
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mal)
    if pah:
        b = o.modifiers.new('pah', 'BEVEL')
        b.width = pah
        b.segments = 3
    if uv_olcek:
        kutu_uv(o, uv_olcek)
    return o


def silindir(ad, mal, merkez, r, h, r_ust=None, kose=48):
    bpy.ops.mesh.primitive_cone_add(vertices=kose, radius1=r, radius2=r if r_ust is None else r_ust,
                                    depth=h, location=merkez)
    o = bpy.context.active_object
    o.name = o.data.name = ad
    o.data.materials.append(mal)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    return o


def ice_aktar(ad, konum, don=0.0, sadece=None, kaydir=(0, 0, 0)):
    """Poly Haven modelini içe aktar, tek bir boş nesnenin altında topla."""
    once = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODEL, ad, ad + '.gltf'))
    yeni = [o for o in bpy.data.objects if o not in once]
    if sadece:
        for o in list(yeni):
            if o.type == 'MESH' and not any(s in o.name for s in sadece):
                yeni.remove(o)
                bpy.data.objects.remove(o)
    kok = bpy.data.objects.new(ad, None)
    bpy.context.collection.objects.link(kok)
    for o in yeni:
        if o.parent is None:
            o.location = Vector(o.location) + Vector(kaydir)
            o.parent = kok
    kok.location = konum
    kok.rotation_euler.z = math.radians(don)
    return kok


# ---------------------------------------------------------------- oda kabuğu
H = 3.0      # duvar yüksekliği
K = 0.12     # duvar kalınlığı
kutu('taban', BETON, (-K / 2, -K / 2, -0.15), (5 + K, 5 + K, 0.3))
kutu('zemin', PARKE, (0, 0, 0.0025), (5, 5, 0.005), uv_olcek=0.85)

# Sol duvar (x = -2.5)
kutu('duvar_sol', DUVAR, (-2.5 - K / 2, -K / 2, H / 2), (K, 5 + K, H), uv_olcek=0.35)
# Arka duvar (y = -2.5), pencere boşluğuyla dört parça
P0, P1, Z0, Z1 = 0.25, 2.05, 1.0, 2.45   # pencere: x aralığı ve yükseklik aralığı
y_duvar = -2.5 - K / 2
kutu('duvar_arka_sol', DUVAR, ((-2.5 + P0) / 2, y_duvar, H / 2), (P0 + 2.5, K, H), uv_olcek=0.35)
kutu('duvar_arka_sag', DUVAR, ((P1 + 2.5) / 2, y_duvar, H / 2), (2.5 - P1, K, H), uv_olcek=0.35)
kutu('duvar_arka_alt', DUVAR, ((P0 + P1) / 2, y_duvar, Z0 / 2), (P1 - P0, K, Z0), uv_olcek=0.35)
kutu('duvar_arka_ust', DUVAR, ((P0 + P1) / 2, y_duvar, (Z1 + H) / 2), (P1 - P0, K, H - Z1), uv_olcek=0.35)

# Pencere: ince siyah metal çerçeve, ortada dikey kayıt, cam
c = 0.035
for ad, merkez, boyut in [
    ('pencere_alt', ((P0 + P1) / 2, y_duvar, Z0 + c / 2), (P1 - P0, K + 0.02, c)),
    ('pencere_ust', ((P0 + P1) / 2, y_duvar, Z1 - c / 2), (P1 - P0, K + 0.02, c)),
    ('pencere_sol', (P0 + c / 2, y_duvar, (Z0 + Z1) / 2), (c, K + 0.02, Z1 - Z0)),
    ('pencere_sag', (P1 - c / 2, y_duvar, (Z0 + Z1) / 2), (c, K + 0.02, Z1 - Z0)),
    ('pencere_orta', ((P0 + P1) / 2, y_duvar, (Z0 + Z1) / 2), (0.025, K + 0.02, Z1 - Z0)),
]:
    kutu(ad, SIYAH_METAL, merkez, boyut)
kutu('cam', CAM, ((P0 + P1) / 2, y_duvar, (Z0 + Z1) / 2), (P1 - P0, 0.01, Z1 - Z0))
kutu('denizlik', BEYAZ, ((P0 + P1) / 2, -2.5 + 0.06, Z0 - 0.015), (P1 - P0 + 0.1, 0.16, 0.03), pah=0.004)

# Süpürgelikler
kutu('supurgelik_sol', BEYAZ, (-2.5 + 0.01, 0, 0.05), (0.02, 5, 0.1))
kutu('supurgelik_arka', BEYAZ, (0, -2.5 + 0.01, 0.05), (5, 0.02, 0.1))

# ---------------------------------------------------------------- çalışma köşesi
MX, MY = -2.5 + 0.42, -0.3   # masanın merkezi (sol duvara yaslı)
kutu('masa', MESE, (MX, MY, 0.74), (0.76, 1.7, 0.04), pah=0.006, uv_olcek=0.6)
for dx in (-0.32, 0.32):
    for dy in (-0.78, 0.78):
        kutu(f'masa_ayak_{dx}_{dy}', SIYAH_METAL, (MX + dx, MY + dy, 0.36), (0.035, 0.035, 0.72), pah=0.004)
kutu('masa_kiris', SIYAH_METAL, (MX - 0.32, MY, 0.66), (0.03, 1.56, 0.03))

# Monitör: ince gövde, ayak, ekran
ex = -2.5 + 0.2
kutu('monitor', SIYAH_METAL, (ex, MY, 1.08), (0.022, 0.64, 0.38), pah=0.004)
bpy.ops.mesh.primitive_plane_add(size=1, location=(ex + 0.0125, MY, 1.08), rotation=(math.pi / 2, 0, math.pi / 2))
ekran = bpy.context.active_object
ekran.name = ekran.data.name = 'ekran'
ekran.scale = (0.61, 0.35, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
ekran.data.materials.append(EKRAN)
kutu('monitor_boyun', ALUMINYUM, (ex - 0.03, MY, 0.86), (0.02, 0.05, 0.22), pah=0.005)
kutu('monitor_ayak', ALUMINYUM, (ex, MY, 0.765), (0.16, 0.22, 0.01), pah=0.004)

kutu('klavye', PLASTIK, (MX + 0.18, MY, 0.768), (0.13, 0.42, 0.014), pah=0.004)
kutu('fare', PLASTIK, (MX + 0.2, MY + 0.32, 0.772), (0.1, 0.06, 0.02), pah=0.009)
silindir('kupa', SERAMIK, (MX + 0.25, MY - 0.55, 0.81), 0.04, 0.1)

# Masa sukulenti ve çalışma koltuğu (Poly Haven)
ice_aktar('potted_plant_04', (MX - 0.2, MY + 0.62, 0.76))
ice_aktar('modern_arm_chair_01', (MX + 0.95, MY, 0), don=90)

# Duvarda çerçeve ve masanın üstünde sarkıt lamba
ice_aktar('hanging_picture_frame_02', (-2.5 + 0.02, MY + 0.5, 1.75), don=90)
ice_aktar('modern_ceiling_lamp_01', (MX + 0.2, MY, H - 1.17))

# ---------------------------------------------------------------- ORA çekirdeği: sunucu dolabı
SX, SY = -1.45, -2.5 + 0.34
# Gövde kısa tutulur: önde cam kapağın arkasındaki sunucular görünsün
kutu('sunucu', SUNUCU, (SX, SY - 0.055, 0.95), (0.6, 0.51, 1.9), pah=0.01)
for ad, merkez, boyut in [
    ('sunucu_yan_sol', (SX - 0.285, SY + 0.25, 0.95), (0.03, 0.12, 1.9)),
    ('sunucu_yan_sag', (SX + 0.285, SY + 0.25, 0.95), (0.03, 0.12, 1.9)),
    ('sunucu_ust', (SX, SY + 0.25, 1.88), (0.6, 0.12, 0.04)),
    ('sunucu_alt', (SX, SY + 0.25, 0.08), (0.6, 0.12, 0.16)),
]:
    kutu(ad, SUNUCU, merkez, boyut, pah=0.004)
kutu('sunucu_kapak', CAM, (SX, SY + 0.315, 0.95), (0.54, 0.008, 1.8))
for i in range(9):
    z = 0.28 + i * 0.17
    kutu(f'sunucu_kat_{i}', PLASTIK, (SX, SY + 0.25, z), (0.5, 0.06, 0.12), pah=0.004)
    kutu(f'led_{i}', LED, (SX - 0.16 + (i % 3) * 0.05, SY + 0.282, z + 0.03), (0.12, 0.004, 0.012))

# ---------------------------------------------------------------- dinlenme köşesi
KX, KY = 1.15, -2.5 + 0.5
# Modern kanepe: yumuşak buklé kumaş, minderler ve ince siyah ayaklar
def minder(ad, merkez, boyut, pah=0.05):
    o = kutu(ad, KUMAS, merkez, boyut, pah=pah, uv_olcek=1.2)
    o.modifiers['pah'].segments = 5
    yumusak = o.modifiers.new('yumusak', 'SUBSURF')
    yumusak.levels = yumusak.render_levels = 1
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    return o

minder('kanepe_govde', (KX, KY + 0.05, 0.27), (2.3, 0.88, 0.3), pah=0.04)
minder('kanepe_sirt', (KX, KY - 0.27, 0.62), (2.3, 0.24, 0.5), pah=0.08)
minder('kanepe_kol_sol', (KX - 1.08, KY + 0.05, 0.5), (0.2, 0.88, 0.32), pah=0.08)
minder('kanepe_kol_sag', (KX + 1.08, KY + 0.05, 0.5), (0.2, 0.88, 0.32), pah=0.08)
for i, dx in enumerate((-0.65, 0, 0.65)):
    minder(f'kanepe_minder_{i}', (KX + dx, KY + 0.12, 0.5), (0.64, 0.66, 0.16), pah=0.06)
    minder(f'kanepe_yaslanma_{i}', (KX + dx, KY - 0.12, 0.72), (0.6, 0.16, 0.4), pah=0.07)
for dx in (-1.05, 1.05):
    for dy in (-0.32, 0.4):
        kutu(f'kanepe_ayak_{dx}_{dy}', SIYAH_METAL, (KX + dx, KY + dy, 0.06), (0.04, 0.04, 0.12), pah=0.006)
kutu('hali', HALI, (KX, KY + 1.35, 0.008), (2.6, 1.9, 0.012), pah=0.003, uv_olcek=0.8)
ice_aktar('modern_coffee_table_01', (KX, KY + 1.3, 0.014), don=90)

# Raf ve para ağacı
ice_aktar('wooden_display_shelves_01', (-2.5 + 0.2, 1.55, 0))
silindir('saksi', SAKSI, (-2.0, 2.15, 0.2), 0.2, 0.4, r_ust=0.24)
silindir('saksi_toprak', TOPRAK, (-2.0, 2.15, 0.39), 0.22, 0.02)
ice_aktar('pachira_aquatica_01', (-2.0, 2.15, 0.37), sadece=['_d'], kaydir=(-4.06, 0, 0))

# Sitede neon tabelanın konacağı yer (arka duvar, sunucunun üstü)
tabela = bpy.data.objects.new('tabela_yeri', None)
bpy.context.collection.objects.link(tabela)
tabela.location = (-0.55, -2.5 + 0.01, 2.05)

# Hepsi tek bir ebeveyn altında
kok = bpy.data.objects.new('ofis', None)
bpy.context.collection.objects.link(kok)
for o in list(bpy.context.collection.objects):
    if o is not kok and o.parent is None:
        o.parent = kok

# ---------------------------------------------------------------- web için hafiflet
# Ekranda büyük görünen parke 1024 pikselde kalır; diğer bütün dokular 512 piksele indirilir
for im in bpy.data.images:
    if im.size[0] == 0:
        continue
    hedef = 1024 if 'herringbone' in im.filepath else 512
    if im.size[0] > hedef:
        im.scale(hedef, int(im.size[1] * hedef / im.size[0]))

glb = os.path.join(PROJE, 'public', 'model', 'ofis.glb')
# Draco: geometri sıkıştırma, JPEG: dokular küçük kalsın
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True, export_yup=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_image_format='JPEG', export_jpeg_quality=82)
print('GLB:', glb, round(os.path.getsize(glb) / 1e6, 2), 'MB')
