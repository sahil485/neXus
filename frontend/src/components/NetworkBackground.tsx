"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Node {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  connections: number[];
  opacity: number;
  personIndex: number;
}

// Sample person descriptions
const PEOPLE = [
  { name: "Harnoor", desc: "a 20-year-old artist and engineer in the greater SF area" },
  { name: "Faiz", desc: "a founder on the weekdays and partying on the weekends" },
  { name: "Maya", desc: "a Stanford CS student building the future of healthcare" },
  { name: "Alex", desc: "a serial entrepreneur with 3 exits under their belt" },
  { name: "Priya", desc: "a product designer at a stealth AI startup" },
  { name: "Jordan", desc: "a VC analyst who's always looking for the next big thing" },
  { name: "Sam", desc: "a full-stack dev who codes by day and DJs by night" },
  { name: "Riley", desc: "a climate tech founder saving the planet one startup at a time" },
  { name: "Kai", desc: "a Berkeley dropout turned YC founder" },
  { name: "Morgan", desc: "a growth hacker who's scaled 5 startups to millions" },
  { name: "Zara", desc: "a biotech researcher turning science into startups" },
  { name: "Leo", desc: "a crypto native building decentralized social networks" },
  { name: "Ava", desc: "a former Google PM now advising early-stage startups" },
  { name: "Ethan", desc: "a robotics engineer making autonomous systems safer" },
  { name: "Sofia", desc: "a content creator with 500K followers across platforms" },
];

interface HoveredNode {
  x: number;
  y: number;
  index: number;
  person: typeof PEOPLE[0];
}

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const hoveredIndexRef = useRef<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);

  const isInOuterRegion = useCallback((x: number, y: number, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const centerZoneWidth = width * 0.6;  // Larger protected zone
    const centerZoneHeight = height * 0.7; // Larger protected zone
    
    return (
      x < centerX - centerZoneWidth / 2 ||
      x > centerX + centerZoneWidth / 2 ||
      y < centerY - centerZoneHeight / 2 ||
      y > centerY + centerZoneHeight / 2
    );
  }, []);

  const initNodes = useCallback((width: number, height: number) => {
    const nodes: Node[] = [];
    const nodeCount = Math.min(120, Math.floor((width * height) / 15000));
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < nodeCount; i++) {
      let x, y;
      const edgeBias = 0.7;
      
      if (Math.random() < edgeBias) {
        const side = Math.floor(Math.random() * 4);
        switch (side) {
          case 0:
            x = Math.random() * width;
            y = Math.random() * height * 0.3;
            break;
          case 1:
            x = Math.random() * width;
            y = height - Math.random() * height * 0.3;
            break;
          case 2:
            x = Math.random() * width * 0.3;
            y = Math.random() * height;
            break;
          default:
            x = width - Math.random() * width * 0.3;
            y = Math.random() * height;
            break;
        }
      } else {
        x = centerX + (Math.random() - 0.5) * width * 0.5;
        y = centerY + (Math.random() - 0.5) * height * 0.5;
      }

      const node: Node = {
        x,
        y,
        z: Math.random() * 400 - 200,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        vz: (Math.random() - 0.5) * 0.05,
        size: Math.random() * 2 + 1,
        connections: [],
        opacity: Math.random() * 0.5 + 0.3,
        personIndex: Math.floor(Math.random() * PEOPLE.length),
      };
      nodes.push(node);
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && Math.random() > 0.7) {
          nodes[i].connections.push(j);
        }
      }
    }

    return nodes;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      nodesRef.current = initNodes(window.innerWidth, window.innerHeight);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      
      const width = window.innerWidth;
      const height = window.innerHeight;
      const nodes = nodesRef.current;
      
      // Check if hovering over any node in outer region
      let foundNode: HoveredNode | null = null;
      
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const perspective = 600;
        const scale = perspective / (perspective + node.z);
        const screenSize = node.size * scale * 8; // Larger hit area
        
        const dx = e.clientX - node.x;
        const dy = e.clientY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < screenSize && isInOuterRegion(node.x, node.y, width, height)) {
          foundNode = {
            x: node.x,
            y: node.y,
            index: i,
            person: PEOPLE[node.personIndex],
          };
          break;
        }
      }
      
      hoveredIndexRef.current = foundNode ? foundNode.index : null;
      setHoveredNode(foundNode);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      timeRef.current += 0.005;

      ctx.clearRect(0, 0, width, height);

      const bgGradient = ctx.createRadialGradient(
        width * 0.5, height * 0.4, 0,
        width * 0.5, height * 0.5, width * 0.8
      );
      bgGradient.addColorStop(0, "rgba(15, 23, 42, 0.3)");
      bgGradient.addColorStop(0.5, "rgba(3, 7, 18, 0.5)");
      bgGradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      const nodes = nodesRef.current;
      
      nodes.forEach((node, i) => {
        node.x += node.vx + Math.sin(timeRef.current + i * 0.1) * 0.03;
        node.y += node.vy + Math.cos(timeRef.current + i * 0.15) * 0.03;
        node.z += node.vz;

        node.vx *= 0.99;
        node.vy *= 0.99;
        node.vz *= 0.99;

        if (node.x < -50) node.x = width + 50;
        if (node.x > width + 50) node.x = -50;
        if (node.y < -50) node.y = height + 50;
        if (node.y > height + 50) node.y = -50;
        if (node.z < -200) node.z = 200;
        if (node.z > 200) node.z = -200;

        const perspective = 600;
        const scale = perspective / (perspective + node.z);
        const screenX = node.x;
        const screenY = node.y;
        const isHovered = hoveredIndexRef.current === i;
        const sizeMultiplier = isHovered ? 2.5 : 1;
        const screenSize = node.size * scale * sizeMultiplier;

        node.connections.forEach((targetIdx) => {
          const target = nodes[targetIdx];
          const targetScale = perspective / (perspective + target.z);
          
          const cdx = target.x - node.x;
          const cdy = target.y - node.y;
          const connectionDist = Math.sqrt(cdx * cdx + cdy * cdy);
          
          if (connectionDist < 200) {
            const opacity = (1 - connectionDist / 200) * 0.5 * scale * targetScale;
            
            const gradient = ctx.createLinearGradient(screenX, screenY, target.x, target.y);
            gradient.addColorStop(0, `rgba(148, 163, 184, ${opacity})`);
            gradient.addColorStop(0.5, `rgba(130, 140, 160, ${opacity * 0.85})`);
            gradient.addColorStop(1, `rgba(148, 163, 184, ${opacity})`);
            
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.7 * scale;
            ctx.stroke();
          }
        });

        const glowSize = screenSize * (isHovered ? 6 : 4);
        const glowOpacity = isHovered ? 0.8 : 0.3;
        const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowSize);
        
        if (isHovered) {
          // Brighter, blue-tinted glow for hovered node
          glow.addColorStop(0, `rgba(147, 197, 253, ${glowOpacity})`);
          glow.addColorStop(0.3, `rgba(147, 197, 253, ${glowOpacity * 0.5})`);
          glow.addColorStop(0.6, `rgba(148, 163, 184, ${glowOpacity * 0.2})`);
          glow.addColorStop(1, "rgba(148, 163, 184, 0)");
        } else {
          glow.addColorStop(0, `rgba(148, 163, 184, ${node.opacity * scale * glowOpacity})`);
          glow.addColorStop(0.5, `rgba(148, 163, 184, ${node.opacity * scale * 0.1})`);
          glow.addColorStop(1, "rgba(148, 163, 184, 0)");
        }
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(screenX, screenY, screenSize, 0, Math.PI * 2);
        ctx.fillStyle = isHovered 
          ? `rgba(255, 255, 255, 1)` 
          : `rgba(226, 232, 240, ${node.opacity * scale})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initNodes, isInOuterRegion]);

  // Calculate tooltip position to stay on screen
  const getTooltipStyle = (x: number, y: number) => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const tooltipWidth = 280;
    const offset = 15;
    
    let left = x + offset;
    let top = y + offset;
    
    // Keep tooltip on screen
    if (left + tooltipWidth > width - 20) {
      left = x - tooltipWidth - offset;
    }
    if (top > (typeof window !== 'undefined' ? window.innerHeight : 1080) - 100) {
      top = y - 80;
    }
    
    return { left, top };
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0"
        style={{ zIndex: 0 }}
      />
      
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 pointer-events-none"
            style={getTooltipStyle(hoveredNode.x, hoveredNode.y)}
          >
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl px-4 py-3 max-w-[280px] shadow-xl">
              <p className="text-sm text-slate-200 leading-relaxed">
                Meet <span className="text-white font-medium">{hoveredNode.person.name}</span>, {hoveredNode.person.desc}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
