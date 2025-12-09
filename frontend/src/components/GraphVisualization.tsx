"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, Box, Circle, Search, X, Sparkles, Power } from "lucide-react";
import * as THREE from "three";
import { Switch } from "@/components/ui/switch";

// Grok Logo SVG Component
function GrokLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" className={className}>
      <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"></path>
    </svg>
  );
}

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
  topic?: string;
  topicColor?: string;
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
  topicData?: { user_id: string; topic: string; topic_confidence: number }[];
  topicColors?: { [key: string]: string };
  enableTopicMode?: boolean;
  onTopicModeToggle?: () => void;
  loadingTopics?: boolean;
}

export default function GraphVisualization({ profiles, edges, currentUser, onNodeClick, selectedNodeId, topicData = [], topicColors = {}, enableTopicMode = false, onTopicModeToggle, loadingTopics = false }: GraphVisualizationProps) {
  const fgRef = useRef<any>(null);
  const [is3D, setIs3D] = useState(false);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [filteredNodeIds, setFilteredNodeIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    
    // Create topic lookup map
    const topicMap = new Map<string, { topic: string; color: string }>();
    if (enableTopicMode && topicData.length > 0) {
      topicData.forEach(t => {
        topicMap.set(t.user_id, {
          topic: t.topic,
          color: topicColors[t.topic] || "#6b7280"
        });
      });
    }
    
    // Create nodes
    const nodes: GraphNode[] = [
      {
        id: currentUser.x_user_id || "current-user",
        name: currentUser.name || "You",
        username: currentUser.username || "you",
        img: currentUser.profile_image_url || "",
        val: 20,
        degree: 0,
        topic: "You",
        topicColor: "#1d9bf0",
      },
      ...profiles.map((p) => {
        const topicInfo = topicMap.get(p.x_user_id);
        return {
          id: p.x_user_id,
          name: p.name,
          username: p.username,
          img: p.profile_image_url,
          val: p.degree === 1 ? 10 : 5,
          degree: p.degree,
          topic: topicInfo?.topic,
          topicColor: topicInfo?.color,
        };
      }),
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
  }, [profiles, edges, currentUser, topicData, topicColors, enableTopicMode]);

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

  // Natural language search handler
  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;
    
    setIsSearching(true);
    try {
      console.log('🔍 Searching for:', searchQuery);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/api/graph/search/natural-language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x_user_id: currentUser.x_user_id,
          query: searchQuery,
          limit: 50
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search failed:', response.status, errorText);
        alert(`Search failed: ${response.status}. Check console for details.`);
        return;
      }
      
      const results = await response.json();
      console.log('✅ Search results:', results);
      
      const resultIds = new Set<string>(results.map((r: any) => r.user_id as string));
      resultIds.add(currentUser.x_user_id); // Always include current user
      setSearchResults(resultIds);
      setFilteredNodeIds(resultIds);
      
      if (results.length === 0) {
        alert('No matches found. Try a different query.');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert(`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(new Set());
    setFilteredNodeIds(null);
  };

  // Get unique topics for legend
  const uniqueTopics = useMemo(() => {
    if (!enableTopicMode) return [];
    const topics = new Map<string, string>();
    graphData.nodes.forEach(node => {
      if (node.topic && node.topicColor && node.topic !== "You") {
        topics.set(node.topic, node.topicColor);
      }
    });
    return Array.from(topics.entries());
  }, [graphData, enableTopicMode]);

  return (
    <div className="w-full h-full bg-black overflow-hidden relative">
      {/* Search Bar */}
      <div className="absolute top-4 left-4 z-10 pointer-events-auto">
        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-lg p-2 rounded-full border border-[#2f3336] shadow-lg">
          <GrokLogo className="w-4 h-4 text-[#71767b] ml-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search: 'founders in AI', 'designers'..."
            className="bg-transparent border-none outline-none text-[#e7e9ea] text-sm placeholder:text-[#71767b] w-64"
          />
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : searchQuery && (
            <button onClick={clearSearch} className="hover:bg-[#2f3336] p-1 rounded-full transition-colors">
              <X className="w-4 h-4 text-[#71767b]" />
            </button>
          )}
        </div>
        {filteredNodeIds && (
          <div className="mt-2 bg-[#1d9bf0]/10 backdrop-blur-lg p-2 rounded-lg border border-[#1d9bf0]/30 text-xs text-[#e7e9ea]">
            Found {filteredNodeIds.size - 1} matches
          </div>
        )}
      </div>

      {/* Controls and Legend */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end pointer-events-none">
        {/* Switches */}
        <div className="flex flex-col gap-3 pointer-events-auto">
          {onTopicModeToggle && (
            <div className="bg-black/80 backdrop-blur-lg px-4 py-3 rounded-lg border border-[#2f3336] shadow-lg">
              <div className="flex items-center gap-3">
                {loadingTopics ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#1d9bf0]" />
                ) : (
                  <GrokLogo className="w-4 h-4 text-[#e7e9ea]" />
                )}
                <span className="text-xs font-bold text-[#e7e9ea] flex-1">Network Pulse</span>
                <Switch
                  checked={enableTopicMode}
                  onCheckedChange={onTopicModeToggle}
                  disabled={loadingTopics}
                />
              </div>
            </div>
          )}
          <div className="bg-black/80 backdrop-blur-lg px-4 py-3 rounded-lg border border-[#2f3336] shadow-lg">
            <div className="flex items-center gap-3">
              {is3D ? <Box className="w-4 h-4 text-[#e7e9ea]" /> : <Circle className="w-4 h-4 text-[#e7e9ea]" />}
              <span className="text-xs font-bold text-[#e7e9ea] flex-1">3D View</span>
              <Switch
                checked={is3D}
                onCheckedChange={setIs3D}
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-black/80 p-2 rounded-lg border border-[#2f3336] pointer-events-auto max-h-64 overflow-y-auto">
          {enableTopicMode ? (
            // Topic mode legend
            <>
              {uniqueTopics.slice(0, 8).map(([topic, color]) => (
                <div key={topic} className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="text-xs text-[#e7e9ea]">{topic}</span>
                </div>
              ))}
            </>
          ) : (
            // Degree mode legend
            <>
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
            </>
          )}
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
              
              // Check highlighting and filtering
              const isHighlighted = highlightNodes.has(node.id);
              const isFiltered = filteredNodeIds ? filteredNodeIds.has(node.id) : true;
              const isDimmed = (highlightNodes.size > 0 && !isHighlighted) || !isFiltered;
              
              // Apply opacity
              ctx.globalAlpha = isDimmed ? 0.15 : 1;
  
              // Draw circle border
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
              // Use topic color if enabled, otherwise use degree colors
              if (enableTopicMode && node.topicColor) {
                ctx.fillStyle = node.topicColor;
              } else {
                ctx.fillStyle = node.degree === 0 ? "#1d9bf0" : node.degree === 1 ? "#00ba7c" : "#71767b";
              }
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
