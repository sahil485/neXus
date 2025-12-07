"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
    </div>
  ),
});

interface GraphNode {
  id: string;
  name: string;
  username: string;
  img: string;
  val: number; // radius size
  degree?: 1 | 2 | 0; // 0 for current user
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphVisualizationProps {
  profiles: any[];
  edges: { source: string; target: string }[];
  currentUser: any;
  onNodeClick: (node: GraphNode) => void;
}

export default function GraphVisualization({ profiles, edges, currentUser, onNodeClick }: GraphVisualizationProps) {
  const fgRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });

  useEffect(() => {
    if (!currentUser) return;
    
    // ... rest of useEffect
    const nodes: GraphNode[] = [
      {
        id: currentUser.x_user_id,
        name: currentUser.name,
        username: currentUser.username,
        img: currentUser.profile_image_url,
        val: 20,
        degree: 0,
      },
      ...profiles.map((p) => ({
        id: p.x_user_id,
        name: p.name,
        username: p.username,
        img: p.profile_image_url,
        val: p.degree === 1 ? 10 : 5,
        degree: p.degree,
      })),
    ];

    // Filter edges to ensure both source and target exist in nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    setGraphData({
      nodes,
      links: validEdges,
    });
  }, [profiles, edges, currentUser]);

  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden border border-[#2f3336]">
      <div className="absolute top-4 right-4 z-10 bg-black/80 p-2 rounded-lg border border-[#2f3336]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-[#1d9bf0]"></div>
          <span className="text-xs text-[#e7e9ea]">You</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-[#00ba7c]"></div>
          <span className="text-xs text-[#e7e9ea]">1st Degree</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#71767b]"></div>
          <span className="text-xs text-[#e7e9ea]">2nd Degree</span>
        </div>
      </div>
      
      {graphData.nodes.length > 0 && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeLabel="name"
          backgroundColor="#000000"
          linkColor={() => "#2f3336"}
          nodeRelSize={6}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const size = node.val;
            
            // Draw circle border
            ctx.beginPath();
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.degree === 0 ? "#1d9bf0" : node.degree === 1 ? "#00ba7c" : "#71767b";
            ctx.fill();

            // Draw image
            const img = new Image();
            img.src = node.img;
            
            // Save context
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, size - 2, 0, 2 * Math.PI, false);
            ctx.clip();
            try {
                ctx.drawImage(img, node.x - size + 2, node.y - size + 2, (size - 2) * 2, (size - 2) * 2);
            } catch (e) {
                // Fallback or ignore if image not loaded yet
            }
            ctx.restore();
          }}
          onNodeClick={(node: any) => {
            // Center view on node
            fgRef.current?.centerAt(node.x, node.y, 1000);
            fgRef.current?.zoom(4, 2000);
            onNodeClick(node);
          }}
        />
      )}
    </div>
  );
}
