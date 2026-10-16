'use client';

import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Text,
  RoundedBox,
  Float,
  Billboard,
} from '@react-three/drei';
import * as THREE from 'three';
import type { Profile, AttendanceSession } from '@/types/database';

interface EmployeeWithState {
  profile: Profile;
  session: AttendanceSession | null;
  team?: { name: string; color: string };
  deskPosition: [number, number, number];
}

interface OfficeZone {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number];
  color: string;
}

interface OfficeSceneProps {
  employees: EmployeeWithState[];
  onSelectEmployee: (employee: EmployeeWithState) => void;
  selectedEmployeeId: string | null;
  zones: OfficeZone[];
}

type V3 = [number, number, number];

// Kept for backwards compatibility with page / sidebar imports.
const DEFAULT_ZONES: OfficeZone[] = [
  { id: 'workspace', name: 'Workspace', position: [0, 0, 0], size: [20, 20], color: '#3b82f6' },
];

// ---------------------------------------------------------------------------
// Floor plan
// ---------------------------------------------------------------------------

const HUB: V3 = [0, 0, 0];

type DoorSide = 'east' | 'west' | 'north' | 'south';

interface RoomDef {
  id: string;
  name: string;
  color: string;
  cx: number;
  cz: number;
  w: number; // x extent
  d: number; // z extent
  door: DoorSide;
}

interface Room extends RoomDef {
  hw: number;
  hd: number;
  doorV: V3; // point at the doorway
  frontV: V3; // just outside the door, toward the hub
  interiorV: V3; // inside the room
  seatFaceY: number; // facing for someone seated inside
}

const ROOM_DEFS: RoomDef[] = [
  { id: 'president', name: "President's Office", color: '#f59e0b', cx: -15, cz: -11, w: 10, d: 8, door: 'east' },
  { id: 'meeting', name: 'Meeting Room', color: '#ec4899', cx: 15, cz: -11, w: 10, d: 8, door: 'west' },
  { id: 'cr', name: 'Restroom', color: '#38bdf8', cx: 0, cz: -16, w: 8, d: 5, door: 'south' },
  { id: 'living', name: 'Living Room', color: '#a78bfa', cx: -15, cz: 9, w: 10, d: 8, door: 'east' },
  { id: 'gaming', name: 'Gaming Room', color: '#22d3ee', cx: 15, cz: 9, w: 10, d: 8, door: 'west' },
  { id: 'cafe', name: 'Cafe & Bar', color: '#10b981', cx: 0, cz: 15.5, w: 16, d: 6, door: 'north' },
];

function makeRoom(def: RoomDef): Room {
  const hw = def.w / 2;
  const hd = def.d / 2;
  let doorV: V3;
  let frontV: V3;
  let seatFaceY = 0;
  switch (def.door) {
    case 'east':
      doorV = [def.cx + hw, 0, def.cz];
      frontV = [def.cx + hw + 1.9, 0, def.cz];
      seatFaceY = Math.PI / 2; // face +x toward door
      break;
    case 'west':
      doorV = [def.cx - hw, 0, def.cz];
      frontV = [def.cx - hw - 1.9, 0, def.cz];
      seatFaceY = -Math.PI / 2;
      break;
    case 'north':
      doorV = [def.cx, 0, def.cz - hd];
      frontV = [def.cx, 0, def.cz - hd - 1.9];
      seatFaceY = 0;
      break;
    case 'south':
      doorV = [def.cx, 0, def.cz + hd];
      frontV = [def.cx, 0, def.cz + hd + 1.9];
      seatFaceY = Math.PI;
      break;
  }
  return {
    ...def,
    hw,
    hd,
    doorV,
    frontV,
    interiorV: [def.cx, 0, def.cz],
    seatFaceY,
  };
}

const ROOMS: Room[] = ROOM_DEFS.map(makeRoom);
const ROOM_BY_ID = new Map(ROOMS.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Desks (bullpen)
// ---------------------------------------------------------------------------

const DESK_COLS = 5;
const DESK_SX = 3.4;
const DESK_SZ = 3.3;
const DESK_START_Z = -6;
const MIN_DESKS = 15;

function deskPositionForIndex(i: number): V3 {
  const col = i % DESK_COLS;
  const row = Math.floor(i / DESK_COLS);
  const x = (col - (DESK_COLS - 1) / 2) * DESK_SX;
  const z = DESK_START_Z + row * DESK_SZ;
  return [x, 0, z];
}

function seatForDesk(desk: V3): V3 {
  return [desk[0], 0, desk[2] + 0.85];
}

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export function OfficeScene({ employees, onSelectEmployee, selectedEmployeeId }: OfficeSceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }} style={{ background: 'transparent' }}>
      <Suspense fallback={null}>
        <SceneContent
          employees={employees}
          onSelectEmployee={onSelectEmployee}
          selectedEmployeeId={selectedEmployeeId}
        />
      </Suspense>
    </Canvas>
  );
}

function SceneContent({
  employees,
  onSelectEmployee,
  selectedEmployeeId,
}: Omit<OfficeSceneProps, 'zones'>) {
  const active = useMemo(
    () =>
      employees
        .filter((e) => e.session?.state === 'clocked_in' || e.session?.state === 'on_break')
        .sort((a, b) => a.profile.id.localeCompare(b.profile.id)),
    [employees]
  );

  const owner = useMemo(() => active.find((e) => e.profile.role === 'owner') ?? null, [active]);
  const deskWorkers = useMemo(() => active.filter((e) => e.profile.role !== 'owner'), [active]);

  const deskCount = Math.max(MIN_DESKS, deskWorkers.length);
  const desks = useMemo(
    () => Array.from({ length: deskCount }, (_, i) => deskPositionForIndex(i)),
    [deskCount]
  );

  return (
    <>
      <PerspectiveCamera makeDefault position={[18, 21, 24]} fov={45} />
      <OrbitControls
        target={[0, 1.5, 0]}
        minPolarAngle={Math.PI / 10}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={10}
        maxDistance={60}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Lighting */}
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#3a3a55', 0.55]} />
      <directionalLight
        position={[16, 24, 12]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={90}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
      />
      <pointLight position={[-12, 9, 2]} intensity={0.45} color="#6366f1" />
      <pointLight position={[12, 9, -6]} intensity={0.4} color="#3b82f6" />

      <Floor />
      <Rug />
      <OuterWalls />
      <SignBanner />

      {ROOMS.map((room) => (
        <RoomShell key={room.id} room={room} />
      ))}

      {/* Desks — permanent fixtures, at least 15 */}
      {desks.map((d, i) => (
        <Desk key={`desk-${i}`} position={d} />
      ))}

      {/* Desk workers */}
      {deskWorkers.map((emp, i) => (
        <Worker
          key={`w-${emp.profile.id}`}
          employee={emp}
          home={{ kind: 'desk', seat: seatForDesk(desks[i]), faceY: Math.PI }}
          isSelected={emp.profile.id === selectedEmployeeId}
          onClick={() => onSelectEmployee(emp)}
        />
      ))}

      {/* Owner seated in the President's office */}
      {owner && (
        <Worker
          key={`w-${owner.profile.id}`}
          employee={owner}
          home={{
            kind: 'room',
            room: ROOM_BY_ID.get('president')!,
            seat: [ROOM_BY_ID.get('president')!.cx - 1, 0, ROOM_BY_ID.get('president')!.cz],
            faceY: Math.PI / 2,
          }}
          isSelected={owner.profile.id === selectedEmployeeId}
          onClick={() => onSelectEmployee(owner)}
        />
      )}

      <fog attach="fog" args={['#1a1a2e', 60, 110]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function Floor() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[70, 70]} />
      <meshStandardMaterial color="#26263f" roughness={0.9} />
    </mesh>
  );
}

function Rug() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#2f2f52" roughness={0.85} />
    </mesh>
  );
}

function OuterWalls() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2d2d4e', roughness: 0.85 }), []);
  return (
    <group>
      <mesh position={[0, 2, -20]} material={mat} receiveShadow>
        <boxGeometry args={[52, 4, 0.3]} />
      </mesh>
      <mesh position={[0, 2, 20]} material={mat} receiveShadow>
        <boxGeometry args={[52, 4, 0.3]} />
      </mesh>
      <mesh position={[-25.5, 2, 0]} material={mat} receiveShadow>
        <boxGeometry args={[0.3, 4, 40]} />
      </mesh>
      <mesh position={[25.5, 2, 0]} material={mat} receiveShadow>
        <boxGeometry args={[0.3, 4, 40]} />
      </mesh>
    </group>
  );
}

function SignBanner() {
  // On the north outer wall, raised above the room heights so it is visible.
  return (
    <group position={[0, 0, -19.7]}>
      <mesh position={[0, 3.3, 0]}>
        <planeGeometry args={[16, 2.4]} />
        <meshStandardMaterial color="#1a1a33" emissive="#23234f" emissiveIntensity={0.45} roughness={0.5} />
      </mesh>
      <Text position={[0, 3.55, 0.12]} fontSize={1.2} color="#8b9bff" anchorX="center" anchorY="middle" letterSpacing={0.05} outlineWidth={0.02} outlineColor="#000000">
        DALESOLUTION
      </Text>
      <Text position={[0, 2.65, 0.12]} fontSize={0.4} color="#c3b6ff" anchorX="center" anchorY="middle" letterSpacing={0.35} fillOpacity={0.85}>
        WORKFORCE OS
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

function RoomShell({ room }: { room: Room }) {
  const { cx, cz, hw, hd, door, color } = room;
  const t = 0.2;
  const h = 3;
  const gap = 2.6;
  const wallColor = '#34345c';

  function Seg({ position, args }: { position: V3; args: V3 }) {
    return (
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={wallColor} roughness={0.85} />
      </mesh>
    );
  }

  function hWall(z: number, hasDoor: boolean) {
    if (!hasDoor) return <Seg position={[cx, h / 2, z]} args={[2 * hw, h, t]} />;
    const seg = (2 * hw - gap) / 2;
    return (
      <>
        <Seg position={[cx - (gap / 2 + seg / 2), h / 2, z]} args={[seg, h, t]} />
        <Seg position={[cx + (gap / 2 + seg / 2), h / 2, z]} args={[seg, h, t]} />
      </>
    );
  }

  function vWall(x: number, hasDoor: boolean) {
    if (!hasDoor) return <Seg position={[x, h / 2, cz]} args={[t, h, 2 * hd]} />;
    const seg = (2 * hd - gap) / 2;
    return (
      <>
        <Seg position={[x, h / 2, cz - (gap / 2 + seg / 2)]} args={[t, h, seg]} />
        <Seg position={[x, h / 2, cz + (gap / 2 + seg / 2)]} args={[t, h, seg]} />
      </>
    );
  }

  return (
    <group>
      {/* Floor tint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, cz]} receiveShadow>
        <planeGeometry args={[2 * hw - 0.2, 2 * hd - 0.2]} />
        <meshStandardMaterial color={color} transparent opacity={0.12} roughness={0.8} />
      </mesh>

      {/* Walls (door side split) */}
      {hWall(cz - hd, door === 'north')}
      {hWall(cz + hd, door === 'south')}
      {vWall(cx - hw, door === 'west')}
      {vWall(cx + hw, door === 'east')}

      {/* Door frame accent */}
      <mesh position={[room.doorV[0], 2.5, room.doorV[2]]}>
        <boxGeometry args={door === 'east' || door === 'west' ? [0.25, 0.2, gap] : [gap, 0.2, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>

      <RoomFurniture room={room} />

      {/* Label */}
      <Billboard position={[cx, 2.9, cz]}>
        <Text fontSize={0.42} color={color} anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#000000">
          {room.name.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

function RoomFurniture({ room }: { room: Room }) {
  const { id, cx, cz } = room;
  const wood = '#4c4c72';
  const dark = '#1d1d30';

  switch (id) {
    case 'president':
      return (
        <group>
          <RoundedBox args={[2.6, 0.1, 1.2]} position={[cx + 0.4, 0.78, cz]} radius={0.03} castShadow>
            <meshStandardMaterial color={wood} roughness={0.35} />
          </RoundedBox>
          <mesh position={[cx + 0.4, 0.38, cz]} castShadow>
            <boxGeometry args={[2.4, 0.76, 1]} />
            <meshStandardMaterial color={dark} roughness={0.5} />
          </mesh>
          {/* Executive chair */}
          <mesh position={[cx - 1, 0.95, cz]} castShadow>
            <boxGeometry args={[0.7, 1, 0.2]} />
            <meshStandardMaterial color="#2a2a44" roughness={0.6} />
          </mesh>
          <mesh position={[cx - 1, 0.5, cz]} castShadow>
            <boxGeometry args={[0.7, 0.12, 0.7]} />
            <meshStandardMaterial color="#2a2a44" roughness={0.6} />
          </mesh>
        </group>
      );
    case 'meeting':
      return (
        <group>
          <RoundedBox args={[4, 0.1, 1.4]} position={[cx, 0.78, cz]} radius={0.04} castShadow>
            <meshStandardMaterial color={wood} roughness={0.35} />
          </RoundedBox>
          {[-1.3, 0, 1.3].map((dx) =>
            [-1, 1].map((dz) => (
              <mesh key={`${dx}-${dz}`} position={[cx + dx, 0.45, cz + dz]} castShadow>
                <boxGeometry args={[0.5, 0.9, 0.5]} />
                <meshStandardMaterial color="#3a3a5c" roughness={0.6} />
              </mesh>
            ))
          )}
        </group>
      );
    case 'living':
      return (
        <group>
          <RoundedBox args={[3, 0.6, 1]} position={[cx, 0.4, cz + 1]} radius={0.12} castShadow>
            <meshStandardMaterial color="#6a5b8b" roughness={0.75} />
          </RoundedBox>
          <RoundedBox args={[1.6, 0.4, 0.8]} position={[cx, 0.3, cz - 0.6]} radius={0.05} castShadow>
            <meshStandardMaterial color={wood} roughness={0.4} />
          </RoundedBox>
          <mesh position={[cx, 1.4, cz - 2.6]} castShadow>
            <boxGeometry args={[2.4, 1.3, 0.1]} />
            <meshStandardMaterial color="#0e0e1f" emissive="#20305a" emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case 'gaming':
      return (
        <group>
          <mesh position={[cx, 1.6, cz - 2.6]} castShadow>
            <boxGeometry args={[3, 1.7, 0.12]} />
            <meshStandardMaterial color="#05050f" emissive="#3b1d6b" emissiveIntensity={0.5} />
          </mesh>
          <RoundedBox args={[3, 0.6, 1]} position={[cx, 0.4, cz + 1.2]} radius={0.12} castShadow>
            <meshStandardMaterial color="#2a2a55" roughness={0.75} />
          </RoundedBox>
          {/* Arcade cabinet */}
          <mesh position={[cx + 2.6, 0.9, cz]} castShadow>
            <boxGeometry args={[0.8, 1.8, 0.7]} />
            <meshStandardMaterial color="#20204a" emissive="#22d3ee" emissiveIntensity={0.25} />
          </mesh>
        </group>
      );
    case 'cafe':
      return (
        <group>
          {/* Bar counter */}
          <RoundedBox args={[6, 1.1, 0.9]} position={[cx, 0.55, cz + 1.6]} radius={0.05} castShadow>
            <meshStandardMaterial color={wood} roughness={0.4} />
          </RoundedBox>
          {[-2, -0.7, 0.7, 2].map((dx) => (
            <mesh key={dx} position={[cx + dx, 0.55, cz + 0.4]} castShadow>
              <cylinderGeometry args={[0.22, 0.22, 0.9]} />
              <meshStandardMaterial color="#3a3a5c" />
            </mesh>
          ))}
          {/* Small tables */}
          {[-4, 4].map((dx) => (
            <mesh key={dx} position={[cx + dx, 0.55, cz - 0.4]} castShadow>
              <cylinderGeometry args={[0.6, 0.5, 0.9]} />
              <meshStandardMaterial color={wood} />
            </mesh>
          ))}
        </group>
      );
    case 'cr':
      return (
        <group>
          {[-2, 0].map((dx) => (
            <mesh key={dx} position={[room.cx + dx, 1, room.cz - 1.3]} castShadow>
              <boxGeometry args={[1.6, 2, 1.6]} />
              <meshStandardMaterial color="#2a3a4a" roughness={0.7} />
            </mesh>
          ))}
          <RoundedBox args={[2.4, 0.3, 0.7]} position={[room.cx + 2.2, 0.9, room.cz]} radius={0.04} castShadow>
            <meshStandardMaterial color="#8aa0b4" roughness={0.3} />
          </RoundedBox>
        </group>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Desk
// ---------------------------------------------------------------------------

function Desk({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <RoundedBox args={[2, 0.08, 1]} position={[0, 0.75, 0]} radius={0.02} castShadow receiveShadow>
        <meshStandardMaterial color="#4c4c72" roughness={0.35} />
      </RoundedBox>
      {[
        [-0.9, 0.375, -0.4],
        [0.9, 0.375, -0.4],
        [-0.9, 0.375, 0.4],
        [0.9, 0.375, 0.4],
      ].map((p, i) => (
        <mesh key={i} position={p as V3} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.75]} />
          <meshStandardMaterial color="#1c1c30" />
        </mesh>
      ))}
      <RoundedBox args={[0.9, 0.55, 0.04]} position={[0, 1.15, -0.3]} radius={0.02} castShadow>
        <meshStandardMaterial color="#0e0e1f" emissive="#20305a" emissiveIntensity={0.35} roughness={0.2} />
      </RoundedBox>
      <mesh position={[0, 0.86, -0.3]} castShadow>
        <cylinderGeometry args={[0.05, 0.09, 0.12]} />
        <meshStandardMaterial color="#1c1c30" />
      </mesh>
      <RoundedBox args={[0.6, 0.03, 0.2]} position={[0, 0.8, 0.05]} radius={0.01}>
        <meshStandardMaterial color="#26263f" roughness={0.5} />
      </RoundedBox>
      {/* Chair */}
      <group position={[0, 0, 0.85]}>
        <mesh position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.55, 0.1, 0.55]} />
          <meshStandardMaterial color="#3a3a5c" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.78, 0.26]} castShadow>
          <boxGeometry args={[0.55, 0.55, 0.1]} />
          <meshStandardMaterial color="#3a3a5c" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Worker (animated humanoid with door-aware navigation)
// ---------------------------------------------------------------------------

type Home =
  | { kind: 'desk'; seat: V3; faceY: number }
  | { kind: 'room'; room: Room; seat: V3; faceY: number };

type Phase = 'home' | 'out' | 'pause' | 'back';

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Path from the hub into a room, through its door.
function enterRoom(r: Room): V3[] {
  return [r.frontV, r.doorV, r.interiorV];
}

// Path from a worker's seat out to the hub (through their own door if in a room).
function exitToHub(home: Home): V3[] {
  if (home.kind === 'room') {
    return [home.room.doorV, home.room.frontV, HUB];
  }
  return [HUB];
}

function Worker({
  employee,
  home,
  isSelected,
  onClick,
}: {
  employee: EmployeeWithState;
  home: Home;
  isSelected: boolean;
  onClick: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);

  const state = employee.session?.state;
  const isOnBreak = state === 'on_break';

  const shirt = employee.team?.color || '#6366f1';
  const statusColor = state === 'clocked_in' ? '#10b981' : isOnBreak ? '#f59e0b' : '#6b7280';

  const homeRoomId = home.kind === 'room' ? home.room.id : null;

  const beh = useRef({
    mode: state,
    phase: 'home' as Phase,
    timer: rand(5, 14),
    path: [] as V3[],
    idx: 0,
    walkT: Math.random() * 10,
  });

  function setLegs(x: number) {
    if (legL.current) legL.current.rotation.x = x;
    if (legR.current) legR.current.rotation.x = x;
  }

  // Walk toward a target; returns true on arrival.
  function walkToward(g: THREE.Group, target: V3, delta: number): boolean {
    const dx = target[0] - g.position.x;
    const dz = target[2] - g.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) {
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.2);
      return true;
    }
    const step = Math.min(2.4 * delta, d);
    g.position.x += (dx / d) * step;
    g.position.z += (dz / d) * step;
    g.rotation.y = Math.atan2(dx, dz);
    beh.current.walkT += delta * 9;
    const sw = Math.sin(beh.current.walkT) * 0.6;
    if (legL.current) legL.current.rotation.x = sw;
    if (legR.current) legR.current.rotation.x = -sw;
    g.position.y = Math.abs(Math.sin(beh.current.walkT)) * 0.06;
    return false;
  }

  function sitHome(g: THREE.Group) {
    g.position.x = home.seat[0];
    g.position.z = home.seat[2];
    g.position.y = THREE.MathUtils.lerp(g.position.y, -0.12, 0.15);
    g.rotation.y = home.faceY;
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 1.15, 0.15);
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 1.15, 0.15);
  }

  function idle(g: THREE.Group, t: number) {
    g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.1);
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.1);
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.1);
    g.rotation.y += Math.sin(t * 1.5) * 0.0015;
  }

  function buildWander(): V3[] {
    const candidates = ROOMS.filter((r) => r.id !== homeRoomId);
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    return [...exitToHub(home), ...enterRoom(target)];
  }

  useFrame((frame, delta) => {
    const g = root.current;
    if (!g) return;
    const b = beh.current;
    const dt = Math.min(delta, 0.05);
    const t = frame.clock.elapsedTime;

    // Reset behaviour when the person's state changes (clock in / break / out).
    if (b.mode !== state) {
      b.mode = state;
      b.phase = 'home';
      b.idx = 0;
      b.path = [];
      b.timer = rand(4, 10);
      if (isOnBreak) {
        // Head to the cafe and stay there.
        b.path = [...exitToHub(home), ...enterRoom(ROOM_BY_ID.get('cafe')!)];
        b.phase = 'out';
      }
    }

    if (isOnBreak) {
      if (b.phase === 'out') {
        if (walkToward(g, b.path[b.idx], dt)) {
          b.idx += 1;
          if (b.idx >= b.path.length) b.phase = 'pause';
        }
      } else {
        idle(g, t);
      }
      return;
    }

    // clocked_in
    b.timer -= dt;
    switch (b.phase) {
      case 'home':
        sitHome(g);
        if (b.timer <= 0) {
          b.path = buildWander();
          b.idx = 0;
          b.phase = 'out';
        }
        break;
      case 'out':
        if (walkToward(g, b.path[b.idx], dt)) {
          b.idx += 1;
          if (b.idx >= b.path.length) {
            b.phase = 'pause';
            b.timer = rand(3, 6);
          }
        }
        break;
      case 'pause':
        idle(g, t);
        if (b.timer <= 0) {
          b.path = [...b.path].reverse().slice(1);
          b.path.push(home.seat);
          b.idx = 0;
          b.phase = 'back';
        }
        break;
      case 'back':
        if (walkToward(g, b.path[b.idx], dt)) {
          b.idx += 1;
          if (b.idx >= b.path.length) {
            b.phase = 'home';
            b.timer = rand(8, 20);
          }
        }
        break;
    }
  });

  const initialPos: V3 = home.seat;

  return (
    <group
      ref={root}
      position={initialPos}
      rotation={[0, home.faceY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <group ref={legL} position={[0.17, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.09, 0.9]} />
          <meshStandardMaterial color="#2a2a40" roughness={0.7} />
        </mesh>
      </group>
      <group ref={legR} position={[-0.17, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.09, 0.9]} />
          <meshStandardMaterial color="#2a2a40" roughness={0.7} />
        </mesh>
      </group>

      <mesh position={[0, 1.3, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.6, 8, 16]} />
        <meshStandardMaterial color={shirt} roughness={0.6} />
      </mesh>

      <mesh position={[0.4, 1.35, 0]} rotation={[0, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 6, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.6} />
      </mesh>
      <mesh position={[-0.4, 1.35, 0]} rotation={[0, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 6, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.6} />
      </mesh>

      <mesh position={[0, 2.0, 0]} castShadow>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial color="#e8d5b7" roughness={0.7} />
      </mesh>

      <Billboard position={[0, 2.75, 0]}>
        <Text fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
          {employee.profile.full_name.split(' ')[0]}
        </Text>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.6} />
        </mesh>
      </Billboard>

      {isSelected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.78, 32]} />
          <meshBasicMaterial color="#8b9bff" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export { DEFAULT_ZONES };
export type { EmployeeWithState, OfficeZone };
