"use client";

import { useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface CanvasSequenceProps {
  frameCount: number;
  framePath: (index: number) => string;
  className?: string;
}

export function CanvasSequence({ frameCount, framePath, className }: CanvasSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const currentFrame = useTransform(scrollYProgress, [0, 1], [0, frameCount - 1], { clamp: true });

  useEffect(() => {
    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;
    
    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      img.src = framePath(i);
      img.onload = () => {
        loadedCount++;
        if (loadedCount === 1) {
          const ctx = canvasRef.current?.getContext("2d");
          if (ctx && canvasRef.current) {
            ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      };
      loadedImages.push(img);
    }
    setImages(loadedImages);
  }, [frameCount, framePath]);

  useMotionValueEvent(currentFrame, "change", (latest) => {
    const frameIndex = Math.min(frameCount - 1, Math.max(0, Math.floor(latest)));
    
    if (images[frameIndex] && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      const img = images[frameIndex];
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        const canvasRatio = canvasRef.current.width / canvasRef.current.height;
        const imgRatio = img.width / img.height;
        let drawWidth = canvasRef.current.width;
        let drawHeight = canvasRef.current.height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
          drawWidth = canvasRef.current.height * imgRatio;
          offsetX = (canvasRef.current.width - drawWidth) / 2;
        } else {
          drawHeight = canvasRef.current.width / imgRatio;
          offsetY = (canvasRef.current.height - drawHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }
    }
  });

  return (
    <div ref={containerRef} className="relative h-[300vh] w-full bg-[#050505]">
      <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className={`w-full h-full object-cover ${className ?? ""}`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-transparent to-[#050505]/80 pointer-events-none" />
      </div>
    </div>
  );
}
