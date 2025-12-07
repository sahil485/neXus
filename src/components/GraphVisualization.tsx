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
  selectedNodeId?: string | null;
}

export default function GraphVisualization({ profiles, edges, currentUser, onNodeClick, selectedNodeId }: GraphVisualizationProps) {
  const fgRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());

  useEffect(() => {
    if (!currentUser) return;
    
    // Create nodes
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

  // Handle highlighting when selection changes
  useEffect(() => {
    if (!selectedNodeId || !currentUser) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const nodesToHighlight = new Set<string>();
    const linksToHighlight = new Set<string>();

    nodesToHighlight.add(selectedNodeId);
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

    const selectedNode = graphData.nodes.find(n => n.id === selectedNodeId);
    
    if (selectedNode) {
      if (selectedNode.degree === 1) {
        // Direct connection
        const link = findEdge(currentUser.x_user_id, selectedNodeId);
        if (link) {
          const sourceId = (link.source as any).id || link.source;
          const targetId = (link.target as any).id || link.target;
          linksToHighlight.add(sourceId === currentUser.x_user_id ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`);
          linksToHighlight.add(sourceId !== currentUser.x_user_id ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`);
          // Just add both directions to be safe or use consistent key
          linksToHighlight.add(typeof link.source === 'object' ? `${(link.source as any).id}-${(link.target as any).id}` : `${link.source}-${link.target}`);
        }
      } else if (selectedNode.degree === 2) {
        // Find the bridge node (1st degree connection)
        // Look for an edge where target is selectedNodeId (or source is selectedNodeId)
        // The other end must be a 1st degree connection
        const bridgeLink = graphData.links.find((l: any) => {
          const sourceId = l.source.id || l.source;
          const targetId = l.target.id || l.target;
          
          if (sourceId === selectedNodeId) {
            const targetNode = graphData.nodes.find(n => n.id === targetId);
            return targetNode?.degree === 1;
          } else if (targetId === selectedNodeId) {
            const sourceNode = graphData.nodes.find(n => n.id === sourceId);
            return sourceNode?.degree === 1;
          }
          return false;
        });

        if (bridgeLink) {
          const sourceId = (bridgeLink.source as any).id || bridgeLink.source;
          const targetId = (bridgeLink.target as any).id || bridgeLink.target;
          const bridgeId = sourceId === selectedNodeId ? targetId : sourceId;
          
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
  }, [selectedNodeId, graphData, currentUser]);

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
            
            ctx.globalAlpha = 1; // Reset alpha
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
