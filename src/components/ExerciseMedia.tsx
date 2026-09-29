import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

/** Alterna las fotos de posición inicial/final para simular el movimiento. */
export default function ExerciseMedia({ images, alt, className = "" }: { images: string[]; alt: string; className?: string }) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % images.length), 1100);
    return () => clearInterval(t);
  }, [images.length]);

  if (!images.length || failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 text-slate-500 ${className}`}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : ""}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${i === frame ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </div>
  );
}
