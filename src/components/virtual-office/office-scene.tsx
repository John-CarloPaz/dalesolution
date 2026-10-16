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

// Kept for backwards compatibility with the page / sidebar imports.
const DEFAULT_ZONES: OfficeZone[] = [
  { id: 'workspace', name: 'Workspace', position: [0, 0, -5], size: [18, 16], color: '#3b82f6' },
  { id: 'break', name: 'Break Room', position: [12, 0, -4], size: [6, 8], color: '#10b981' },
  { id: 'reception', name: 'Reception', position: [0, 0, 12], size: [6, 4], color: '#6366f1' },
];

// ---------------------------------------------------------------------------
// Office layout constants
// ---------------------------------------------------------------------------

const COLS = 4;
const SPACING_X = 4.2;
const SPACING_Z = 5;
const FRONT_ROW_Z = -9; // closest desk row to the sign wall
const SIGN_WALL_Z = -14;

// Places people walk to when wandering / on break.
const COFFEE_SPOT: [number, number, number] = [12, 0, -5];
const SOCIAL_SPOTS: [number, number, number][] = [
  [12, 0, -5], // coffee station
  [12, 0, -8], // water cooler
  [0, 0, 4], // central aisle
  [-5, 0, 6], // by the plants
];

function deskPositionForIndex(i: number): [number, number, number] {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = (col - (COLS - 1) / 2) * SPACING_X;
  const z = FRONT_ROW_Z + row * SPACING_Z;
  return [x, 0, z];
}

function seatForDesk(desk: [number, number, number]): [number, number, number] {
  return [desk[0], 0, desk[2] + 0.85];
}

// ---------------------------------------------------------------------------
// Scene root
// ---------------------------------------------------------------------------

export function OfficeScene({ employees, onSelectEmployee, selectedEmployeeId }: OfficeSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'transparent' }}
    >
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
  // Stable desk assignment by sorted profile id so a person keeps their desk.
  const ordered = useMemo(
    () => [...employees].sort((a, b) => a.profile.id.localeCompare(b.profile.id)),
    [employees]
  );

  const desks = useMemo(
    () => ordered.map((_, i) => deskPositionForIndex(i)),
    [ordered]
  );

  return (
    <>
      <PerspectiveCamera makeDefault position={[13, 15, 17]} fov={45} />
      <OrbitControls
        target={[0, 1.5, -3]}
        minPolarAngle={Math.PI / 8}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={8}
        maxDistance={46}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Lighting */}
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#ffffff', '#3a3a55', 0.6]} />
      <directionalLight
        position={[12, 20, 8]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={70}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
      />
      <pointLight position={[-10, 8, 2]} intensity={0.5} color="#6366f1" />
      <pointLight position={[10, 8, -6]} intensity={0.4} color="#3b82f6" />

      <Floor />
      <Rug />
      <OfficeWalls />
      <SignWall />
      <OfficeDecorations />

      {/* Desks are permanent fixtures — always rendered */}
      {desks.map((d, i) => (
        <Desk key={`desk-${ordered[i].profile.id}`} position={d} />
      ))}

      {/* Avatars for active people, seated at their desk or walking around */}
      {ordered.map((emp, i) => {
        const state = emp.session?.state;
        if (state !== 'clocked_in' && state !== 'on_break') return null;
        return (
          <Worker
            key={`worker-${emp.profile.id}`}
            employee={emp}
            desk={desks[i]}
            isSelected={emp.profile.id === selectedEmployeeId}
            onClick={() => onSelectEmployee(emp)}
          />
        );
      })}

      <fog attach="fog" args={['#1a1a2e', 55, 95]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function Floor() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#26263f" roughness={0.9} />
    </mesh>
  );
}

function Rug() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -2]}>
      <planeGeometry args={[22, 20]} />
      <meshStandardMaterial color="#2f2f52" roughness={0.85} />
    </mesh>
  );
}

function OfficeWalls() {
  const wall = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#34345a', roughness: 0.85 }),
    []
  );

  return (
    <group>
      {/* Left wall */}
      <mesh position={[-17, 2, -2]} material={wall} receiveShadow>
        <boxGeometry args={[0.3, 4, 32]} />
      </mesh>
      {/* Right wall */}
      <mesh position={[17, 2, -2]} material={wall} receiveShadow>
        <boxGeometry args={[0.3, 4, 32]} />
      </mesh>
      {/* Back wall (behind reception) */}
      <mesh position={[0, 2, 14]} material={wall} receiveShadow>
        <boxGeometry args={[34, 4, 0.3]} />
      </mesh>
      {/* Break-room partition */}
      <mesh position={[9, 1.6, -5]} material={wall} receiveShadow castShadow>
        <boxGeometry args={[0.2, 3.2, 10]} />
      </mesh>
    </group>
  );
}

function SignWall() {
  return (
    <group>
      {/* The wall the desks face */}
      <mesh position={[0, 2.4, SIGN_WALL_Z]} receiveShadow>
        <boxGeometry args={[34, 4.8, 0.3]} />
        <meshStandardMaterial color="#2b2b4d" roughness={0.8} />
      </mesh>
      {/* Accent panel behind the logo */}
      <mesh position={[0, 2.9, SIGN_WALL_Z + 0.16]}>
        <planeGeometry args={[12, 2.6]} />
        <meshStandardMaterial
          color="#1a1a33"
          emissive="#20204a"
          emissiveIntensity={0.4}
          roughness={0.5}
        />
      </mesh>
      {/* DALESOLUTION sign facing the desks (+z) */}
      <Text
        position={[0, 3.2, SIGN_WALL_Z + 0.2]}
        fontSize={1.25}
        color="#8b9bff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.04}
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        DALESOLUTION
      </Text>
      <Text
        position={[0, 2.25, SIGN_WALL_Z + 0.2]}
        fontSize={0.42}
        color="#c3b6ff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.35}
        fillOpacity={0.85}
      >
        WORKFORCE OS
      </Text>
    </group>
  );
}

function OfficeDecorations() {
  return (
    <group>
      {/* Plants in the corners */}
      {[
        [-14, 0, 8],
        [14, 0, 10],
        [-14, 0, -12],
      ].map((p, i) => (
        <Plant key={i} position={p as [number, number, number]} />
      ))}

      {/* Reception desk near the entrance */}
      <RoundedBox args={[4.5, 1.1, 1.1]} position={[0, 0.55, 11]} radius={0.06} castShadow>
        <meshStandardMaterial color="#44446a" roughness={0.4} />
      </RoundedBox>

      {/* Break-room: coffee counter + table + couch */}
      <RoundedBox args={[2.6, 0.9, 0.8]} position={[13.2, 0.45, -5]} radius={0.05} castShadow>
        <meshStandardMaterial color="#44446a" roughness={0.4} />
      </RoundedBox>
      <CoffeeMachine position={[13.2, 0.9, -5]} />
      <RoundedBox args={[2.4, 0.55, 0.9]} position={[12.5, 0.4, -9]} radius={0.12} castShadow>
        <meshStandardMaterial color="#6a5b8b" roughness={0.75} />
      </RoundedBox>
    </group>
  );
}

function CoffeeMachine({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.5, 0.6, 0.45]} position={[0, 0.3, 0]} radius={0.04} castShadow>
        <meshStandardMaterial color="#1d1d30" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.12]} />
        <meshStandardMaterial color="#8b9bff" emissive="#8b9bff" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.7]} />
        <meshStandardMaterial color="#2f2f44" roughness={0.8} />
      </mesh>
      <Float speed={1.6} rotationIntensity={0.1} floatIntensity={0.12}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <sphereGeometry args={[0.55, 10, 8]} />
          <meshStandardMaterial color="#2f7d52" roughness={0.85} />
        </mesh>
      </Float>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Desk
// ---------------------------------------------------------------------------

function Desk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Desktop */}
      <RoundedBox args={[2, 0.08, 1]} position={[0, 0.75, 0]} radius={0.02} castShadow receiveShadow>
        <meshStandardMaterial color="#4c4c72" roughness={0.35} />
      </RoundedBox>
      {/* Legs */}
      {[
        [-0.9, 0.375, -0.4],
        [0.9, 0.375, -0.4],
        [-0.9, 0.375, 0.4],
        [0.9, 0.375, 0.4],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.75]} />
          <meshStandardMaterial color="#1c1c30" />
        </mesh>
      ))}
      {/* Monitor (faces -z, toward the sign wall) */}
      <RoundedBox args={[0.9, 0.55, 0.04]} position={[0, 1.15, -0.3]} radius={0.02} castShadow>
        <meshStandardMaterial color="#0e0e1f" emissive="#20305a" emissiveIntensity={0.35} roughness={0.2} />
      </RoundedBox>
      <mesh position={[0, 0.86, -0.3]} castShadow>
        <cylinderGeometry args={[0.05, 0.09, 0.12]} />
        <meshStandardMaterial color="#1c1c30" />
      </mesh>
      {/* Keyboard */}
      <RoundedBox args={[0.6, 0.03, 0.2]} position={[0, 0.8, 0.05]} radius={0.01}>
        <meshStandardMaterial color="#26263f" roughness={0.5} />
      </RoundedBox>
      {/* Chair (on +z side, where the person sits facing the monitor) */}
      <group position={[0, 0, 0.85]}>
        <mesh position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.55, 0.1, 0.55]} />
          <meshStandardMaterial color="#3a3a5c" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.78, 0.26]} castShadow>
          <boxGeometry args={[0.55, 0.55, 0.1]} />
          <meshStandardMaterial color="#3a3a5c" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3]} />
          <meshStandardMaterial color="#1c1c30" />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Worker (animated humanoid)
// ---------------------------------------------------------------------------

type Phase = 'sit' | 'toTarget' | 'pause' | 'toSeat' | 'break';

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function Worker({
  employee,
  desk,
  isSelected,
  onClick,
}: {
  employee: EmployeeWithState;
  desk: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);

  const state = employee.session?.state;
  const isWorking = state === 'clocked_in';
  const isOnBreak = state === 'on_break';

  const seat = useMemo(() => seatForDesk(desk), [desk]);
  const statusColor = isWorking ? '#10b981' : isOnBreak ? '#f59e0b' : '#6b7280';
  const shirtColor = employee.team?.color || '#6366f1';

  const beh = useRef({
    phase: (isOnBreak ? 'break' : 'sit') as Phase,
    timer: rand(6, 16),
    target: isOnBreak ? COFFEE_SPOT : seat,
    walkT: Math.random() * 10,
  });

  // Move the root toward a target on the XZ plane. Returns true once arrived.
  function walkToward(g: THREE.Group, target: [number, number, number], delta: number): boolean {
    const dx = target[0] - g.position.x;
    const dz = target[2] - g.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.1) {
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.2);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.2);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.2);
      return true;
    }

    const speed = 2.3;
    const step = Math.min(speed * delta, dist);
    g.position.x += (dx / dist) * step;
    g.position.z += (dz / dist) * step;
    g.rotation.y = Math.atan2(dx, dz); // model faces +z by default

    beh.current.walkT += delta * 9;
    const swing = Math.sin(beh.current.walkT) * 0.6;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    g.position.y = Math.abs(Math.sin(beh.current.walkT)) * 0.06;
    return false;
  }

  function sitAtDesk(g: THREE.Group) {
    g.position.x = seat[0];
    g.position.z = seat[2];
    g.position.y = THREE.MathUtils.lerp(g.position.y, -0.12, 0.15);
    g.rotation.y = Math.PI; // face the desk / sign wall (-z)
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 1.15, 0.15);
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 1.15, 0.15);
  }

  function standIdle(g: THREE.Group, t: number) {
    g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.1);
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.1);
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.1);
    g.rotation.y += Math.sin(t * 1.5) * 0.0015;
  }

  useFrame((frame, delta) => {
    const g = root.current;
    if (!g) return;
    const b = beh.current;
    const d = Math.min(delta, 0.05); // clamp to avoid big jumps on tab refocus
    const t = frame.clock.elapsedTime;

    if (isOnBreak) {
      const arrived = walkToward(g, COFFEE_SPOT, d);
      if (arrived) standIdle(g, t);
      return;
    }

    // clocked_in behaviour
    b.timer -= d;
    switch (b.phase) {
      case 'sit':
        sitAtDesk(g);
        if (b.timer <= 0) {
          b.phase = 'toTarget';
          b.target = SOCIAL_SPOTS[Math.floor(Math.random() * SOCIAL_SPOTS.length)];
        }
        break;
      case 'toTarget':
        if (walkToward(g, b.target, d)) {
          b.phase = 'pause';
          b.timer = rand(3, 6);
        }
        break;
      case 'pause':
        standIdle(g, t);
        if (b.timer <= 0) b.phase = 'toSeat';
        break;
      case 'toSeat':
        if (walkToward(g, seat, d)) {
          b.phase = 'sit';
          b.timer = rand(10, 22);
        }
        break;
    }
  });

  const initialPos: [number, number, number] = isOnBreak ? COFFEE_SPOT : seat;

  return (
    <group
      ref={root}
      position={initialPos}
      rotation={[0, isOnBreak ? 0 : Math.PI, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {/* Legs */}
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

      {/* Torso */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.6, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.6} />
      </mesh>

      {/* Arms */}
      <mesh position={[0.4, 1.35, 0]} rotation={[0, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 6, 10]} />
        <meshStandardMaterial color={shirtColor} roughness={0.6} />
      </mesh>
      <mesh position={[-0.4, 1.35, 0]} rotation={[0, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 6, 10]} />
        <meshStandardMaterial color={shirtColor} roughness={0.6} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial color="#e8d5b7" roughness={0.7} />
      </mesh>

      {/* Name + status, always facing the camera */}
      <Billboard position={[0, 2.75, 0]}>
        <Text
          fontSize={0.34}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {employee.profile.full_name.split(' ')[0]}
        </Text>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.6} />
        </mesh>
      </Billboard>

      {/* Selection ring */}
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
