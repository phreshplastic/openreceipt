import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

const GRADIENT_VIEWS = [{ uSpeed: 0.075 }, { uSpeed: 0.068 }, { uSpeed: 0.082 }] as const;

/**
 * Decorative only, and about 1.4 MB of WebGL. It is loaded on its own, after the
 * page, so the landing renders on a phone before three canvases start up.
 */
export default function HowDemoGradient({ view }: { view: number }) {
  const pose = GRADIENT_VIEWS[view] ?? GRADIENT_VIEWS[0];

  return (
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0 }}
      pixelDensity={1.6}
      fov={45}
      pointerEvents="none"
      lazyLoad={false}
    >
      <ShaderGradient
        animate="on"
        control="props"
        brightness={1.5}
        cAzimuthAngle={250}
        cDistance={1.5}
        cPolarAngle={140}
        cameraZoom={12.5}
        color1="#809bd6"
        color2="#910aff"
        color3="#af38ff"
        envPreset="city"
        grain="on"
        lightType="3d"
        positionX={0}
        positionY={0}
        positionZ={0}
        range="disabled"
        rangeEnd={40}
        rangeStart={0}
        reflection={0.5}
        rotationX={0}
        rotationY={0}
        rotationZ={140}
        shader="defaults"
        type="sphere"
        uAmplitude={4.3}
        uDensity={0.8}
        uFrequency={5.5}
        uSpeed={pose.uSpeed}
        uStrength={0.4}
        uTime={0}
        wireframe={false}
      />
    </ShaderGradientCanvas>
  );
}
