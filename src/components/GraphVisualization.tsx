"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, Box, Circle, ZoomOut } from "lucide-react";
import * as THREE from "three";

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
    </div>
  ),
});

// Dynamically import ForceGraph3D with no SSR
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
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
  selectedNodeId?: string | null;
}

export default function GraphVisualization({ profiles, edges, currentUser, onNodeClick, selectedNodeId }: GraphVisualizationProps) {
  const fgRef = useRef<any>(null);
  const [is3D, setIs3D] = useState(false);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    
    // Create nodes
    const nodes: GraphNode[] = [
      {
        id: currentUser.x_user_id || "current-user",
        name: currentUser.name || "You",
        username: currentUser.username || "you",
        img: currentUser.profile_image_url || "",
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

    // Deep clone edges to avoid mutation by the graph library
    const clonedEdges = edges.map(e => ({
      source: typeof e.source === 'object' ? (e.source as any).id : e.source,
      target: typeof e.target === 'object' ? (e.target as any).id : e.target
    }));

    // Filter edges to ensure both source and target exist in nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = clonedEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    setGraphData({
      nodes: JSON.parse(JSON.stringify(nodes)),
      links: validEdges,
    });
  }, [profiles, edges, currentUser]);

  // Handle highlighting when selection OR hover changes
  useEffect(() => {
    const targetNodeId = hoveredNode || selectedNodeId;
    
    if (!targetNodeId || !currentUser) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const nodesToHighlight = new Set<string>();
    const linksToHighlight = new Set<string>();

    nodesToHighlight.add(targetNodeId);
    nodesToHighlight.add(currentUser.x_user_id);

    // Helper to find edge between two nodes
    const findEdge = (source: string, target: string) => {
      // Edges in graphData.links might be objects (processed by library) or raw objects
      // We check both directions
      return graphData.links.find((l: any) => {
        const sourceId = l.source.id || l.source;
        const targetId = l.target.id || l.target;
        return (sourceId === source && targetId === target) ||
               (sourceId === target && targetId === source);
      });
    };

    const targetNode = graphData.nodes.find(n => n.id === targetNodeId);
    
    if (targetNode) {
      if (targetNode.degree === 1) {
        // Direct connection
        const link = findEdge(currentUser.x_user_id, targetNodeId);
        if (link) {
          const sourceId = (link.source as any).id || link.source;
          const targetId = (link.target as any).id || link.target;
          linksToHighlight.add(sourceId === currentUser.x_user_id ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`);
          linksToHighlight.add(sourceId !== currentUser.x_user_id ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`);
          linksToHighlight.add(typeof link.source === 'object' ? `${(link.source as any).id}-${(link.target as any).id}` : `${link.source}-${link.target}`);
        }
      } else if (targetNode.degree === 2) {
        // Find the bridge node (1st degree connection)
        const bridgeLink = graphData.links.find((l: any) => {
          const sourceId = l.source.id || l.source;
          const targetId = l.target.id || l.target;
          
          if (sourceId === targetNodeId) {
            const target = graphData.nodes.find(n => n.id === targetId);
            return target?.degree === 1;
          } else if (targetId === targetNodeId) {
            const source = graphData.nodes.find(n => n.id === sourceId);
            return source?.degree === 1;
          }
          return false;
        });

        if (bridgeLink) {
          const sourceId = (bridgeLink.source as any).id || bridgeLink.source;
          const targetId = (bridgeLink.target as any).id || bridgeLink.target;
          const bridgeId = sourceId === targetNodeId ? targetId : sourceId;
          
          nodesToHighlight.add(bridgeId);
          linksToHighlight.add(typeof bridgeLink.source === 'object' ? `${(bridgeLink.source as any).id}-${(bridgeLink.target as any).id}` : `${bridgeLink.source}-${bridgeLink.target}`);

          // Add link from bridge to root
          const rootLink = findEdge(currentUser.x_user_id, bridgeId);
          if (rootLink) {
             linksToHighlight.add(typeof rootLink.source === 'object' ? `${(rootLink.source as any).id}-${(rootLink.target as any).id}` : `${rootLink.source}-${rootLink.target}`);
          }
        }
      }
    }

    setHighlightNodes(nodesToHighlight);
    setHighlightLinks(linksToHighlight);
  }, [selectedNodeId, hoveredNode, graphData, currentUser]);

  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden border border-[#2f3336] relative">
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end pointer-events-none">
        <div className="bg-black/80 p-2 rounded-lg border border-[#2f3336] pointer-events-auto">
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

        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => fgRef.current?.zoomToFit(1000)}
            className="bg-[#2f3336] hover:bg-[#1a8cd8] text-white p-2 rounded-lg shadow-lg transition-colors flex items-center justify-center"
            title="Zoom Out / Reset"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIs3D(!is3D)}
            className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white p-2 rounded-lg shadow-lg transition-colors flex items-center gap-2"
          >
            {is3D ? <Circle className="w-4 h-4" /> : <Box className="w-4 h-4" />}
            <span className="text-xs font-bold">{is3D ? "2D View" : "3D View"}</span>
          </button>
        </div>
      </div>
      
      {graphData.nodes.length > 0 && (
        is3D ? (
          <ForceGraph3D
            ref={fgRef}
            graphData={graphData}
            nodeLabel="name"
            backgroundColor="#000000"
            onNodeHover={(node: any) => setHoveredNode(node ? node.id : null)}
            linkColor={(link: any) => {
               const id = link.source.id ? `${link.source.id}-${link.target.id}` : `${link.source}-${link.target}`;
               return highlightLinks.has(id) ? "#1d9bf0" : "#2f3336";
            }}
            linkWidth={(link: any) => {
               const id = link.source.id ? `${link.source.id}-${link.target.id}` : `${link.source}-${link.target}`;
               return highlightLinks.has(id) ? 2 : 0.5;
            }}
            linkOpacity={0.5}
            nodeThreeObject={(node: any) => {
              const imgTexture = new THREE.TextureLoader().load(node.img);
              imgTexture.colorSpace = THREE.SRGBColorSpace;
              const material = new THREE.SpriteMaterial({ map: imgTexture });
              const sprite = new THREE.Sprite(material);
              
              const isHighlighted = highlightNodes.has(node.id);
              const isDimmed = highlightNodes.size > 0 && !isHighlighted;
              
              const scale = node.val;
              sprite.scale.set(scale, scale, 1);
              
              if (isDimmed) {
                 material.opacity = 0.2;
              }
              
              return sprite;
            }}
            onNodeClick={(node: any) => {
              if (node.id === selectedNodeId) {
                fgRef.current?.zoomToFit(1000);
              } else {
                // Aim at node from outside it
                const distance = 40;
                const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

                fgRef.current.cameraPosition(
                  { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
                  node, // lookAt ({ x, y, z })
                  3000  // ms transition duration
                );
              }
              onNodeClick(node);
            }}
          />
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeLabel="name"
            backgroundColor="#000000"
            onNodeHover={(node: any) => setHoveredNode(node ? node.id : null)}
            linkColor={(link: any) => {
              const id = link.source.id ? `${link.source.id}-${link.target.id}` : `${link.source}-${link.target}`;
              const isHighlighted = highlightLinks.has(id);
              if (highlightNodes.size > 0) {
                return isHighlighted ? "#1d9bf0" : "#2f333620"; // Dim others
              }
              return "#2f3336";
            }}
            linkWidth={(link: any) => {
              const id = link.source.id ? `${link.source.id}-${link.target.id}` : `${link.source}-${link.target}`;
              return highlightLinks.has(id) ? 3 : 1;
            }}
            nodeRelSize={6}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const size = node.val;
              
              // Check highlighting
              const isHighlighted = highlightNodes.has(node.id);
              const isDimmed = highlightNodes.size > 0 && !isHighlighted;
              
              // Apply opacity
              ctx.globalAlpha = isDimmed ? 0.2 : 1;
  
              // Draw circle border
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.degree === 0 ? "#1d9bf0" : node.degree === 1 ? "#00ba7c" : "#71767b";
              if (isHighlighted && node.degree !== 0) {
                 ctx.shadowColor = "#1d9bf0";
                 ctx.shadowBlur = 15;
              } else {
                 ctx.shadowBlur = 0;
              }
              ctx.fill();
              
              // Reset shadow for image
              ctx.shadowBlur = 0;
  
              // Draw image
              // Use cached image or create new one attached to node
              if (!node.__img) {
                node.__img = new Image();
                node.__img.src = node.img;
                // Force re-render when loaded (optional, loop usually handles it)
              }
              
              const img = node.__img;
              
              // Save context
              ctx.save();
              ctx.beginPath();
              ctx.arc(node.x, node.y, size - 2, 0, 2 * Math.PI, false);
              ctx.clip();
              
              if (img.complete && img.naturalWidth !== 0) {
                try {
                    ctx.drawImage(img, node.x - size + 2, node.y - size + 2, (size - 2) * 2, (size - 2) * 2);
                } catch (e) {
                    // Ignore
                }
              } else {
                // Draw placeholder if image not ready
                ctx.fillStyle = "#16181c";
                ctx.fillRect(node.x - size + 2, node.y - size + 2, (size - 2) * 2, (size - 2) * 2);
              }
              
              ctx.restore();
              
              ctx.globalAlpha = 1; // Reset alpha
            }}
            onNodeClick={(node: any) => {
              if (node.id === selectedNodeId) {
                fgRef.current?.zoomToFit(1000);
              } else {
                // Center view on node
                fgRef.current?.centerAt(node.x, node.y, 1000);
                fgRef.current?.zoom(4, 2000);
              }
              onNodeClick(node);
            }}
          />
        )
      )}
    </div>
  );
}
