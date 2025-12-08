"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Node {
  id: number;
  x: number;
  y: number;
  degree: 1 | 2 | 3;
  size: number;
  vx: number;
  vy: number;
}

interface Edge {
  from: number;
  to: number;
}

interface NetworkVisualizationProps {
  isActive?: boolean;
}

export function NetworkVisualization({ isActive = false }: NetworkVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    // Generate nodes
    const centerX = 250;
    const centerY = 250;
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Central node (you)
    generatedNodes.push({
      id: 0,
      x: centerX,
      y: centerY,
      degree: 1,
      size: 24,
      vx: 0,
      vy: 0,
    });

    // 1st degree connections (6 nodes)
    for (let i = 1; i <= 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const radius = 90;
      generatedNodes.push({
        id: i,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
        degree: 1,
        size: 16,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      });
      generatedEdges.push({ from: 0, to: i });
    }

    // 2nd degree connections (12 nodes)
    for (let i = 7; i <= 18; i++) {
      const parentId = ((i - 7) % 6) + 1;
      const angle = ((i - 7) / 12) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 160;
      generatedNodes.push({
        id: i,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
        degree: 2,
        size: 12,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
      generatedEdges.push({ from: parentId, to: i });
    }

    // 3rd degree connections (18 nodes)
    for (let i = 19; i <= 36; i++) {
      const parentId = ((i - 19) % 12) + 7;
      const angle = ((i - 19) / 18) * Math.PI * 2 + Math.random() * 0.8;
      const radius = 220;
      generatedNodes.push({
        id: i,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        degree: 3,
        size: 8,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      });
      generatedEdges.push({ from: parentId, to: i });
    }

    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 500 * dpr;
    canvas.height = 500 * dpr;
    ctx.scale(dpr, dpr);

    let localNodes = [...nodes];

    const animate = () => {
      ctx.clearRect(0, 0, 500, 500);

      // Update positions with slight movement
      localNodes = localNodes.map((node, index) => {
        if (index === 0) return node; // Keep center fixed

        let newX = node.x + node.vx;
        let newY = node.y + node.vy;

        // Boundary check with bounce
        const maxRadius = node.degree === 1 ? 120 : node.degree === 2 ? 190 : 250;
        const minRadius = node.degree === 1 ? 60 : node.degree === 2 ? 130 : 190;
        const distFromCenter = Math.sqrt(
          Math.pow(newX - 250, 2) + Math.pow(newY - 250, 2)
        );

        if (distFromCenter > maxRadius || distFromCenter < minRadius) {
          return {
            ...node,
            vx: -node.vx + (Math.random() - 0.5) * 0.1,
            vy: -node.vy + (Math.random() - 0.5) * 0.1,
          };
        }

        return { ...node, x: newX, y: newY };
      });

      // Draw edges
      edges.forEach((edge) => {
        const fromNode = localNodes.find((n) => n.id === edge.from);
        const toNode = localNodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return;

        const gradient = ctx.createLinearGradient(
          fromNode.x,
          fromNode.y,
          toNode.x,
          toNode.y
        );
        
        const baseOpacity = isActive ? 0.4 : 0.2;
        
        if (toNode.degree === 1) {
          gradient.addColorStop(0, `rgba(45, 212, 191, ${baseOpacity + 0.2})`);
          gradient.addColorStop(1, `rgba(45, 212, 191, ${baseOpacity})`);
        } else if (toNode.degree === 2) {
          gradient.addColorStop(0, `rgba(45, 212, 191, ${baseOpacity})`);
          gradient.addColorStop(1, `rgba(234, 179, 8, ${baseOpacity})`);
        } else {
          gradient.addColorStop(0, `rgba(234, 179, 8, ${baseOpacity - 0.05})`);
          gradient.addColorStop(1, `rgba(168, 85, 247, ${baseOpacity - 0.1})`);
        }

        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.stroke();
      });

      // Draw nodes
      localNodes.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);

        // Gradient fill based on degree
        const gradient = ctx.createRadialGradient(
          node.x - node.size * 0.3,
          node.y - node.size * 0.3,
          0,
          node.x,
          node.y,
          node.size
        );

        if (node.id === 0) {
          // Central node - bright cyan
          gradient.addColorStop(0, "rgba(45, 212, 191, 1)");
          gradient.addColorStop(1, "rgba(45, 212, 191, 0.8)");
          ctx.shadowColor = "rgba(45, 212, 191, 0.6)";
          ctx.shadowBlur = isActive ? 25 : 15;
        } else if (node.degree === 1) {
          gradient.addColorStop(0, "rgba(45, 212, 191, 0.9)");
          gradient.addColorStop(1, "rgba(45, 212, 191, 0.6)");
          ctx.shadowColor = "rgba(45, 212, 191, 0.4)";
          ctx.shadowBlur = isActive ? 15 : 8;
        } else if (node.degree === 2) {
          gradient.addColorStop(0, "rgba(234, 179, 8, 0.9)");
          gradient.addColorStop(1, "rgba(234, 179, 8, 0.5)");
          ctx.shadowColor = "rgba(234, 179, 8, 0.3)";
          ctx.shadowBlur = isActive ? 12 : 6;
        } else {
          gradient.addColorStop(0, "rgba(168, 85, 247, 0.8)");
          gradient.addColorStop(1, "rgba(168, 85, 247, 0.4)");
          ctx.shadowColor = "rgba(168, 85, 247, 0.2)";
          ctx.shadowBlur = isActive ? 10 : 4;
        }

        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, edges, isActive]);

  return (
    <div className="relative w-full aspect-square flex items-center justify-center">
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, transparent 30%, rgba(45, 212, 191, 0.05) 50%, transparent 70%)",
        }}
        animate={{
          scale: isActive ? [1, 1.05, 1] : 1,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-[500px] h-[500px] max-w-full"
        style={{ width: 500, height: 500 }}
      />

      {/* Floating labels */}
      <motion.div
        className="absolute top-8 right-8 px-3 py-1.5 rounded-full text-xs font-medium bg-cyan/20 text-cyan border border-cyan/30"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        1st Degree
      </motion.div>
      <motion.div
        className="absolute bottom-20 left-4 px-3 py-1.5 rounded-full text-xs font-medium bg-gold/20 text-gold border border-gold/30"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        2nd Degree
      </motion.div>
      <motion.div
        className="absolute top-24 left-8 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        3rd Degree
      </motion.div>
    </div>
  );
}

