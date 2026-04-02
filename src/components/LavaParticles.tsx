import { useEffect, useState } from "react";

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  hue: number;
}

const LavaParticles = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const generated: Particle[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 6 + 2,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 10,
      hue: Math.random() * 30 + 10,
    }));
    setParticles(generated);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-float-up"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, hsl(${p.hue} 100% 60%), hsl(${p.hue} 100% 40%))`,
            boxShadow: `0 0 ${p.size * 2}px hsl(${p.hue} 100% 50% / 0.6)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      {/* Radial glow at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-[hsl(24_100%_50%/0.08)] to-transparent" />
    </div>
  );
};

export default LavaParticles;
