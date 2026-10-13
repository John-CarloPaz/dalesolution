'use client';

import { Suspense, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Text,
  RoundedBox,
  Float,
} from '@react-three/drei';
import * as THREE from 'three';
import type { Profile, AttendanceSession } from '@/types/database';

interface EmployeeWithState {
  profile: Profile;
  session: AttendanceSession | null;
  team?: { name: string; color: string };
  deskPosition: [number, number, number];
}

interface OfficeSceneProps {
  employees: EmployeeWithState[];
  onSelectEmployee: (employee: EmployeeWithState) => void;
  selectedEmployeeId: string | null;
  zones: OfficeZone[];
}

interface OfficeZone {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number];
  color: string;
}

const DEFAULT_ZONES: OfficeZone[] = [
  { id: 'reception', name: 'Reception', position: [0, 0, 8], size: [6, 4], color: '#6366f1' },
  { id: 'workspace', name: 'General Workspace', position: [-6, 0, 0], size: [10, 12], color: '#3b82f6' },
  { id: 'operations', name: 'Operations', position: [6, 0, 0], size: [10, 12], color: '#8b5cf6' },
  { id: 'dev', name: 'Automation & Dev', position: [-6, 0, -10], size: [10, 8], color: '#06b6d4' },
  { id: 'client', name: 'Client Services', position: [6, 0, -10], size: [10, 8], color: '#f59e0b' },
  { id: 'meeting', name: 'Meeting Room', position: [0, 0, -16], size: [6, 4], color: '#ec4899' },
  { id: 'break', name: 'Break Room', position: [14, 0, -4], size: [6, 8], color: '#10b981' },
];

export function OfficeScene({ employees, onSelectEmployee, selectedEmployeeId, zones }: OfficeSceneProps) {
  const activeZones = zones.length > 0 ? zones : DEFAULT_ZONES;

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
          zones={activeZones}
        />
      </Suspense>
    </Canvas>
  );
}

function SceneContent({
  employees,
  onSelectEmployee,
  selectedEmployeeId,
  zones,
}: OfficeSceneProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[20, 25, 25]} fov={45} />
      <OrbitControls
        target={[0, 0, -2]}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        minDistance={10}
        maxDistance={50}
        enableDamping
        dampingFactor={0.05}
      />

      <ambientLight intensity={1.2} />
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <directionalLight position={[-10, 15, -5]} intensity={0.6} />
      <pointLight position={[-10, 8, -10]} intensity={0.6} color="#6366f1" />
      <pointLight position={[10, 8, 5]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[0, 10, 0]} intensity={0.4} color="#ffffff" />

      <Floor />

      {zones.map((zone) => (
        <ZoneArea key={zone.id} zone={zone} />
      ))}

      {zones.map((zone) => (
        <ZoneLabel key={`label-${zone.id}`} zone={zone} />
      ))}

      <OfficeWalls />
      <OfficeDecorations />

      {employees.map((emp) => (
        <EmployeeAvatar
          key={emp.profile.id}
          employee={emp}
          isSelected={emp.profile.id === selectedEmployeeId}
          onClick={() => onSelectEmployee(emp)}
        />
      ))}

      <fog attach="fog" args={['#1a1a2e', 50, 90]} />
    </>
  );
}

function Floor() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#2a2a45" roughness={0.8} />
    </mesh>
  );
}

function ZoneArea({ zone }: { zone: OfficeZone }) {
  const color = new THREE.Color(zone.color);
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[zone.position[0], 0.01, zone.position[2]]}>
      <planeGeometry args={[zone.size[0], zone.size[1]]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.2}
        roughness={0.7}
      />
    </mesh>
  );
}

function ZoneLabel({ zone }: { zone: OfficeZone }) {
  return (
    <Text
      position={[zone.position[0], 0.05, zone.position[2] + zone.size[1] / 2 - 0.5]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.5}
      color={zone.color}
      anchorX="center"
      anchorY="middle"
      fillOpacity={0.9}
    >
      {zone.name.toUpperCase()}
    </Text>
  );
}

function OfficeWalls() {
  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3a3a60', transparent: true, opacity: 0.55 }),
    []
  );

  return (
    <group>
      {/* Outer walls */}
      <mesh position={[0, 1.5, 14]} material={wallMaterial} castShadow>
        <boxGeometry args={[30, 3, 0.15]} />
      </mesh>
      <mesh position={[0, 1.5, -20]} material={wallMaterial} castShadow>
        <boxGeometry args={[30, 3, 0.15]} />
      </mesh>
      <mesh position={[-15, 1.5, -3]} material={wallMaterial} castShadow>
        <boxGeometry args={[0.15, 3, 34]} />
      </mesh>
      <mesh position={[18, 1.5, -3]} material={wallMaterial} castShadow>
        <boxGeometry args={[0.15, 3, 34]} />
      </mesh>

      {/* Meeting room walls */}
      <mesh position={[-3, 1.5, -14]} material={wallMaterial} castShadow>
        <boxGeometry args={[0.15, 3, 8]} />
      </mesh>
      <mesh position={[3, 1.5, -14]} material={wallMaterial} castShadow>
        <boxGeometry args={[0.15, 3, 8]} />
      </mesh>

      {/* Break room partition */}
      <mesh position={[11, 1.5, 0]} material={wallMaterial} castShadow>
        <boxGeometry args={[0.15, 3, 8]} />
      </mesh>
    </group>
  );
}

function Desk({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Desktop */}
      <RoundedBox args={[1.8, 0.08, 0.9]} position={[0, 0.75, 0]} radius={0.02} castShadow>
        <meshStandardMaterial color="#4a4a6a" roughness={0.3} />
      </RoundedBox>
      {/* Legs */}
      {[[-0.8, 0.375, -0.35], [0.8, 0.375, -0.35], [-0.8, 0.375, 0.35], [0.8, 0.375, 0.35]].map(
        (pos, i) => (
          <mesh key={i} position={pos as [number, number, number]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.75]} />
            <meshStandardMaterial color="#1a1a30" />
          </mesh>
        )
      )}
      {/* Monitor */}
      <RoundedBox args={[0.8, 0.5, 0.03]} position={[0, 1.1, -0.25]} radius={0.02} castShadow>
        <meshStandardMaterial color="#0f0f20" roughness={0.1} />
      </RoundedBox>
      {/* Monitor stand */}
      <mesh position={[0, 0.85, -0.25]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.1]} />
        <meshStandardMaterial color="#1a1a30" />
      </mesh>
      {/* Keyboard */}
      <RoundedBox args={[0.5, 0.02, 0.18]} position={[0, 0.8, 0.1]} radius={0.01}>
        <meshStandardMaterial color="#252540" roughness={0.5} />
      </RoundedBox>
      {/* Chair */}
      <group position={[0, 0, 0.8]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color="#3b3b5c" />
        </mesh>
        <mesh position={[0, 0.7, -0.22]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.08]} />
          <meshStandardMaterial color="#3b3b5c" />
        </mesh>
        {/* Chair wheels */}
        {[[-0.2, 0.08, -0.15], [0.2, 0.08, -0.15], [-0.2, 0.08, 0.15], [0.2, 0.08, 0.15]].map(
          (pos, i) => (
            <mesh key={i} position={pos as [number, number, number]}>
              <sphereGeometry args={[0.04]} />
              <meshStandardMaterial color="#1a1a30" />
            </mesh>
          )
        )}
      </group>
    </group>
  );
}

function OfficeDecorations() {
  return (
    <group>
      {/* Plants */}
      {[[-12, 0, 6], [8, 0, 12], [-12, 0, -16], [16, 0, 2]].map((pos, i) => (
        <Plant key={i} position={pos as [number, number, number]} />
      ))}

      {/* Reception desk */}
      <RoundedBox args={[4, 1.1, 1]} position={[0, 0.55, 10]} radius={0.05} castShadow>
        <meshStandardMaterial color="#4a4a6a" roughness={0.3} />
      </RoundedBox>

      {/* Break room table */}
      <RoundedBox args={[3, 0.08, 1.5]} position={[14, 0.75, -4]} radius={0.03} castShadow>
        <meshStandardMaterial color="#4a4a6a" roughness={0.3} />
      </RoundedBox>
      {/* Break room couch */}
      <RoundedBox args={[2.5, 0.5, 0.8]} position={[14, 0.35, -7]} radius={0.1} castShadow>
        <meshStandardMaterial color="#6a5b8b" roughness={0.7} />
      </RoundedBox>

      {/* Meeting room table */}
      <RoundedBox args={[3, 0.08, 1.5]} position={[0, 0.75, -16]} radius={0.04} castShadow>
        <meshStandardMaterial color="#4a4a6a" roughness={0.3} />
      </RoundedBox>

      {/* DaleSolution logo on wall */}
      <Text
        position={[0, 2.5, 13.9]}
        fontSize={0.6}
        color="#6366f1"
        anchorX="center"
      >
        DALESOLUTION
      </Text>
      <Text
        position={[0, 2.0, 13.9]}
        fontSize={0.25}
        color="#8b5cf6"
        anchorX="center"
        fillOpacity={0.7}
      >
        WORKFORCE OS
      </Text>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 0.6]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.8} />
      </mesh>
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.1}>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.4, 8, 6]} />
          <meshStandardMaterial color="#1a5c3a" roughness={0.8} />
        </mesh>
      </Float>
    </group>
  );
}

function EmployeeAvatar({
  employee,
  isSelected,
  onClick,
}: {
  employee: EmployeeWithState;
  isSelected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const state = employee.session?.state;
  const isWorking = state === 'clocked_in';
  const isOnBreak = state === 'on_break';
  const isActive = isWorking || isOnBreak;

  const breakRoomPos = useMemo<[number, number, number]>(() => {
    const hash = employee.profile.id.charCodeAt(0) + employee.profile.id.charCodeAt(1);
    return [
      14 + ((hash % 20) / 10 - 1),
      0,
      -4 + ((hash % 30) / 10 - 1.5),
    ];
  }, [employee.profile.id]);

  const position = isOnBreak ? breakRoomPos : employee.deskPosition;

  const statusColor = isWorking ? '#10b981' : isOnBreak ? '#f59e0b' : '#6b7280';

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (isWorking) {
      ref.current.children[0].rotation.y += Math.sin(Date.now() * 0.001) * 0.001;
    }
  });

  if (!isActive) return null;

  return (
    <group
      ref={ref}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {/* Body */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.4, 8, 16]} />
        <meshStandardMaterial
          color={employee.team?.color || '#6366f1'}
          roughness={0.6}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#e8d5b7" roughness={0.7} />
      </mesh>

      {/* Status indicator */}
      <Float speed={3} floatIntensity={0.15}>
        <mesh position={[0, 1.55, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.5} />
        </mesh>
      </Float>

      {/* Name label */}
      <Text
        position={[0, 1.7, 0]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        fillOpacity={0.9}
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {employee.profile.full_name.split(' ')[0]}
      </Text>

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Desk for working employees */}
      {isWorking && <Desk position={[0, 0, -0.8]} />}
    </group>
  );
}

export { DEFAULT_ZONES };
export type { EmployeeWithState, OfficeZone };
