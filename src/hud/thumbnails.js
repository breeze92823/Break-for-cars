import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { BLOCK_THEMES } from '../config.js'
import { buildCar } from '../lobby/cars.js'
import { canvasTex, paintBlockFace } from '../lobby/paint.js'
import { boxAt, plastic } from '../lego.js'
import { buildPickaxe, disposePickaxe } from '../game/pickaxe-model.js'

// HUD icons are the game's own 3D models rendered once into small PNGs (a
// throwaway renderer, disposed afterwards), so the hotbar cars and offer tiles
// match the world exactly.

let renderer = null
let scene = null
let camera = null

function setup(size) {
  renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(size, size)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.4
  pmrem.dispose()
  scene.add(new AmbientLight('#ffffff', 0.5))
  const key = new DirectionalLight('#ffffff', 2.2)
  key.position.set(4, 7, 6)
  const rim = new DirectionalLight('#bfe0ff', 1.4)
  rim.position.set(-5, 3, -4)
  scene.add(key, rim)
  camera = new PerspectiveCamera(30, 1, 0.1, 100)
}

function shot(obj, { dir = new Vector3(1, 0.62, 1.15), fill = 1.05 } = {}) {
  scene.add(obj)
  obj.updateMatrixWorld(true)
  // frame the object's bounding box
  const bounds = new Box3().setFromObject(obj)
  const center = bounds.getCenter(new Vector3())
  const radius = bounds.getSize(new Vector3()).length() / 2
  const dist = (radius * fill) / Math.sin((camera.fov * Math.PI) / 360)
  camera.position.copy(center).addScaledVector(dir.clone().normalize(), dist)
  camera.lookAt(center)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(obj)
  return url
}

function hammerModel() {
  const g = new Group()
  boxAt(g, plastic('#1f2c4a', 0.5), 0, 0, 0, 0.16, 1.6, 0.16)
  boxAt(g, plastic('#22c9ff', 0.35), 0, 0.85, 0, 0.95, 0.52, 0.52)
  boxAt(g, plastic('#9ff0ff', 0.3), -0.5, 0.85, 0, 0.12, 0.58, 0.58)
  boxAt(g, plastic('#9ff0ff', 0.3), 0.5, 0.85, 0, 0.12, 0.58, 0.58)
  boxAt(g, plastic('#0f1626', 0.6), 0, -0.6, 0, 0.2, 0.4, 0.2)
  g.rotation.z = -0.5
  return g
}

function pickaxeModel() {
  const g = new Group()
  boxAt(g, plastic('#2a2a30', 0.5), 0, 0, 0, 0.16, 1.8, 0.16)
  const white = plastic('#f4f6fb', 0.4)
  const black = plastic('#1b1c22', 0.4)
  // curved head from short segments, alternating stripes
  for (let i = -5; i <= 5; i++) {
    const a = i * 0.13
    const seg = boxAt(g, i % 2 ? black : white, Math.sin(a) * 1.25, 0.9 + Math.cos(a) * 0.25 - 0.25, 0, 0.26, 0.24, 0.24)
    seg.rotation.z = -a
  }
  g.rotation.z = 0.6
  return g
}

function blockModel(themeKey, rainbow = false) {
  const theme = BLOCK_THEMES[themeKey]
  const tex = canvasTex(paintBlockFace(theme).canvas)
  const mats = rainbow
    ? ['#ff3b4e', '#ffd21a', '#2dd84a', '#2f9bff', '#b23cff', '#ff8a1c'].map((c) => new MeshStandardMaterial({ map: tex, color: c, roughness: 0.4, emissive: c, emissiveIntensity: 0.3 }))
    : new MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.2 })
  const m = new Mesh(new BoxGeometry(1, 1, 1), mats)
  return m
}

function starterModel() {
  const g = new Group()
  const car = buildCar('redSport')
  car.scale.setScalar(0.32)
  car.position.set(-0.25, 0, 0.3)
  car.rotation.y = 0.5
  g.add(car)
  const crate = new Mesh(new BoxGeometry(0.75, 0.55, 0.6), new MeshStandardMaterial({ color: '#ffcf1f', roughness: 0.4, emissive: '#ffb000', emissiveIntensity: 0.2 }))
  crate.position.set(0.75, 0.3, -0.35)
  g.add(crate)
  const cash = new Mesh(new BoxGeometry(0.6, 0.18, 0.35), new MeshStandardMaterial({ color: '#39c24a', roughness: 0.6 }))
  cash.position.set(0.7, 0.68, -0.3)
  cash.rotation.y = 0.4
  g.add(cash)
  return g
}

// Renders every icon the HUD needs; returns { key: dataURL }.
export function renderIcons(carKeys, blockThemes) {
  setup(160)
  const out = {}
  try {
    for (const key of carKeys) {
      const car = buildCar(key)
      car.rotation.y = -0.35
      out[`car:${key}`] = shot(car, { dir: new Vector3(0.9, 0.5, 1.4), fill: 0.92 })
    }
    out.hammer = shot(hammerModel(), { dir: new Vector3(0.2, 0.25, 1), fill: 0.92 })
    out.pickaxe = shot(pickaxeModel(), { dir: new Vector3(0.1, 0.2, 1), fill: 0.92 })
    out.starter = shot(starterModel(), { dir: new Vector3(0.5, 0.45, 1), fill: 0.92 })
    for (const t of blockThemes) out[`block:${t}`] = shot(blockModel(t), { dir: new Vector3(1, 0.8, 1.2), fill: 0.92 })
    out.packs = shot(blockModel('divine', true), { dir: new Vector3(1, 0.8, 1.2), fill: 0.92 })
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = scene = camera = null
  }
  return out
}

// Side-on car pictures for the Sell Cars / Fuse Machine windows; returns { look: dataURL }.
export function renderSideCarIcons(looks) {
  setup(200)
  const out = {}
  try {
    for (const key of looks) {
      const car = buildCar(key)
      car.rotation.y = -0.5
      out[key] = shot(car, { dir: new Vector3(0.35, 0.32, 1), fill: 0.6 })
    }
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = scene = camera = null
  }
  return out
}

// Block icons (BLOCK_THEMES keys) for the Spin Wheel; returns { key: dataURL }.
export function renderBlockIcons(keys) {
  setup(160)
  const out = {}
  try {
    for (const k of keys) out[k] = shot(blockModel(k), { dir: new Vector3(1, 0.8, 1.2), fill: 0.92 })
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = scene = camera = null
  }
  return out
}

// Shop / hotbar icons for every pickaxe (config PICKAXES); returns { id: dataURL }.
export function renderPickaxeIcons(list) {
  setup(160)
  const out = {}
  try {
    for (const p of list) {
      const m = buildPickaxe(p.look)
      m.rotation.y = -0.25 // upright T, turned a touch to show depth
      out[p.id] = shot(m, { dir: new Vector3(0.12, 0.18, 1), fill: 0.7 })
      disposePickaxe(m)
    }
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = scene = camera = null
  }
  return out
}

// Hotbar icons for cars taken off their bays (CARS look keys); returns { look: dataURL }.
export function renderCarIcons(looks) {
  setup(160)
  const out = {}
  try {
    for (const key of looks) {
      const car = buildCar(key)
      car.rotation.y = -0.35
      out[key] = shot(car, { dir: new Vector3(0.9, 0.5, 1.4), fill: 0.92 })
    }
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = scene = camera = null
  }
  return out
}
