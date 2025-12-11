"use client";

import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { useEffect, useRef } from "react";

export default function D3Sankey({ data }: any) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!data) return;

    const width = 900;
    const height = 600;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#000");

    svg.selectAll("*").remove(); // clear previous renders

    // Build nodes + links for D3
    const graph = {
      nodes: data.labels.map((label: string, i: number) => ({
        id: i,
        name: label,
        collapsed: false,
      })),
      links: data.links.map((l: any) => ({
        source: l.source,
        target: l.target,
        value: l.value,
      })),
    };

    // Initialize Sankey Layout
    const sankeyLayout = sankey()
      .nodeWidth(20)
      .nodePadding(30)
      .size([width - 50, height - 50])
      .nodeId((d: any) => d.id);

    const { nodes, links } = sankeyLayout(graph);

    // Draw links
    svg
      .append("g")
      .selectAll("path")
      .data(links)
      .enter()
      .append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", "rgba(0,255,135,0.4)")
      .attr("stroke-width", (d: any) => Math.max(1, d.width))
      .attr("fill", "none");

    // Draw nodes
    const node = svg
      .append("g")
      .selectAll("rect")
      .data(nodes)
      .enter()
      .append("rect")
      .attr("x", (d: any) => d.x0)
      .attr("y", (d: any) => d.y0)
      .attr("height", (d: any) => d.y1 - d.y0)
      .attr("width", (d: any) => d.x1 - d.x0)
      .attr("fill", "#4ade80")
      .attr("stroke", "#222")
      .style("cursor", "pointer")
      .on("click", function (_, clickedNode: any) {
        clickedNode.collapsed = !clickedNode.collapsed;

        // Collapse: remove outgoing links
        if (clickedNode.collapsed) {
          graph.links = graph.links.filter((l: any) => l.source !== clickedNode.id);
        } else {
          // Expand: restore from original data
          graph.links = data.links;
        }

        // Recalculate layout
        const updated = sankeyLayout(graph);

        // Animate transition
        svg
          .selectAll("path")
          .data(updated.links)
          .transition()
          .duration(600)
          .attr("d", sankeyLinkHorizontal());

        svg
          .selectAll("rect")
          .data(updated.nodes)
          .transition()
          .duration(600)
          .attr("x", (d: any) => d.x0)
          .attr("y", (d: any) => d.y0)
          .attr("height", (d: any) => d.y1 - d.y0);
      });

    // Node labels
    svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("x", (d: any) => d.x0 - 10)
      .attr("y", (d: any) => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text((d: any) => d.name)
      .attr("fill", "white")
      .style("font-size", "14px");

  }, [data]);

  return <svg ref={svgRef}></svg>;
}
