import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Shield,
  Sparkles,
  CheckCircle2,
  XCircle,
  BarChart3,
  Radar,
  ScatterChart,
} from "lucide-react";

export type ComparisonDimension = {
  id: string;
  feature: string;
  advantage: string;
  traditional: string;
  securitas: string;
  securitasScore: number;
  traditionalScore: number;
  exposureTraditional: number;
  exposureSecuritas: number;
  immunityTraditional: number;
  immunitySecuritas: number;
  metricLabel: string;
  delta: string;
};

export const COMPARISON_DATA: ComparisonDimension[] = [
  {
    id: "custody",
    feature: "Master Encryption Key Custody",
    advantage: "Total Sovereign Custody",
    traditional:
      "Cloud provider owns and holds master keys in cloud memory. Vulnerable to insider leaks & subpoenas.",
    securitas:
      "Zero-knowledge envelope keys. Client signing keys never touch servers; KEKs isolated per tenant schema.",
    securitasScore: 98,
    traditionalScore: 14,
    exposureTraditional: 94,
    exposureSecuritas: 3,
    immunityTraditional: 12,
    immunitySecuritas: 98,
    metricLabel: "Key Sovereignty",
    delta: "Securitas +84% Sovereign Custody",
  },
  {
    id: "authenticity",
    feature: "Document Authenticity & Non-Repudiation",
    advantage: "Cryptographic Proof",
    traditional:
      "Passive checksums or basic timestamps. Administrators can silently alter files without detection.",
    securitas:
      "Mathematical RSA-PSS digital signatures. Single-bit corruption or unauthorized edit instantly breaks signature.",
    securitasScore: 94,
    traditionalScore: 28,
    exposureTraditional: 82,
    exposureSecuritas: 4,
    immunityTraditional: 24,
    immunitySecuritas: 94,
    metricLabel: "Tamper Proofing",
    delta: "Securitas +66% Cryptographic Proof",
  },
  {
    id: "threat-defense",
    feature: "Real-Time Anomaly & Threat Defense",
    advantage: "Zero-Trust Context",
    traditional:
      "Static username/password and long-lived cookies. Stolen credentials grant full unrestricted access.",
    securitas:
      "Adaptive Risk Engine evaluates IP velocity, time anomalies, and sensitivity, enforcing automated Step-Up OTP.",
    securitasScore: 82,
    traditionalScore: 52,
    exposureTraditional: 64,
    exposureSecuritas: 14,
    immunityTraditional: 44,
    immunitySecuritas: 82,
    metricLabel: "Adaptive Defense",
    delta: "Securitas +30% Zero-Trust Defense",
  },
  {
    id: "search",
    feature: "Search on Encrypted Data",
    advantage: "Zero-Plaintext Index",
    traditional:
      "Unrestricted server-side fuzzy indexing, OCR, and typo-tolerant search across cloud clusters (high search agility, but plaintexts exposed to cloud operator).",
    securitas:
      "Blind HMAC-SHA256 exact-token indexing over ciphertext. Zero keyword or plaintext leakage to servers, with trade-off of exact-token matching.",
    securitasScore: 68,
    traditionalScore: 88,
    exposureTraditional: 92,
    exposureSecuritas: 6,
    immunityTraditional: 22,
    immunitySecuritas: 68,
    metricLabel: "Search Agility",
    delta: "Legacy +20% Fuzzy Agility",
  },
  {
    id: "audit",
    feature: "Audit Ledger Integrity",
    advantage: "Auditor-Isolated",
    traditional:
      "Opaque server logs easily deleted or modified by database superusers.",
    securitas:
      "Append-only audit events with automated secret, passphrase, and key redaction with isolated auditor role.",
    securitasScore: 96,
    traditionalScore: 24,
    exposureTraditional: 76,
    exposureSecuritas: 5,
    immunityTraditional: 20,
    immunitySecuritas: 96,
    metricLabel: "Audit Immutability",
    delta: "Securitas +72% Auditor Isolation",
  },
  {
    id: "sharing",
    feature: "Granular Time-Bounded Sharing",
    advantage: "Revocable by Design",
    traditional:
      "Frictionless open public link sharing with global CDN edge caching (instant propagation, but lingering file residue and delayed revocation).",
    securitas:
      "Cryptographically enforced share grants with envelope key wrapping and instant hard revocation (zero cache residue, requires recipient verification).",
    securitasScore: 64,
    traditionalScore: 85,
    exposureTraditional: 84,
    exposureSecuritas: 8,
    immunityTraditional: 26,
    immunitySecuritas: 64,
    metricLabel: "Sharing Speed",
    delta: "Legacy +21% Sharing Speed",
  },
];

type GraphType = "radar" | "bars" | "matrix";

interface Props {
  selectedDimensionId?: string;
  onSelectDimension?: (id: string) => void;
}

export default function ComparisonGraphs({
  selectedDimensionId,
  onSelectDimension,
}: Props) {
  const [graphType, setGraphType] = useState<GraphType>("radar");
  const [internalSelected, setInternalSelected] = useState<string>("custody");
  const [hoveredDimension, setHoveredDimension] = useState<ComparisonDimension | null>(null);

  const activeId = selectedDimensionId ?? internalSelected;
  const activeDimension =
    COMPARISON_DATA.find((d) => d.id === activeId) ?? COMPARISON_DATA[0];

  const svgRef = useRef<SVGSVGElement | null>(null);

  function handleSelect(id: string) {
    setInternalSelected(id);
    if (onSelectDimension) {
      onSelectDimension(id);
    }
  }

  // Render D3 charts based on graphType
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 760;
    const height = 440;

    // Define defs for glows and gradients
    const defs = svg.append("defs");

    // Amber glow filter
    const filter = defs
      .append("filter")
      .attr("id", "glow-amber")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Traditional red gradient
    const redGrad = defs
      .append("linearGradient")
      .attr("id", "red-bar-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    redGrad.append("stop").attr("offset", "0%").attr("stop-color", "#ef4444").attr("stop-opacity", 0.7);
    redGrad.append("stop").attr("offset", "100%").attr("stop-color", "#f87171").attr("stop-opacity", 0.9);

    // Securitas amber gradient
    const amberGrad = defs
      .append("linearGradient")
      .attr("id", "amber-bar-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");
    amberGrad.append("stop").attr("offset", "0%").attr("stop-color", "#d97706").attr("stop-opacity", 0.8);
    amberGrad.append("stop").attr("offset", "100%").attr("stop-color", "#fbbf24").attr("stop-opacity", 1);

    if (graphType === "radar") {
      renderRadarChart(svg, width, height);
    } else if (graphType === "bars") {
      renderBarChart(svg, width, height);
    } else if (graphType === "matrix") {
      renderMatrixChart(svg, width, height);
    }
  }, [graphType, activeId]);

  /* =====================================================================
     1. RADAR / SPIDER CHART (ORGANIC & ASYMMETRIC)
     ===================================================================== */
  function renderRadarChart(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    width: number,
    height: number,
  ) {
    const margin = 72;
    const radius = Math.min(width, height) / 2 - margin;
    const cx = width / 2;
    const cy = height / 2;

    const g = svg.append("g").attr("transform", `translate(${cx}, ${cy})`);
    const totalAxes = COMPARISON_DATA.length;
    const angleSlice = (Math.PI * 2) / totalAxes;
    const levels = 5;

    // Concentric grid webs
    for (let level = 1; level <= levels; level++) {
      const r = (radius / levels) * level;
      const levelFactor = (level / levels) * 100;

      // Polygon points for level
      const points: [number, number][] = [];
      for (let i = 0; i < totalAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        points.push([r * Math.cos(angle), r * Math.sin(angle)]);
      }

      g.append("polygon")
        .attr("points", points.map((p) => p.join(",")).join(" "))
        .attr("stroke", "rgba(255, 255, 255, 0.08)")
        .attr("stroke-width", 1)
        .attr("fill", level % 2 === 0 ? "rgba(255, 255, 255, 0.015)" : "none");

      // Level percentage labels along top spoke
      g.append("text")
        .attr("x", 6)
        .attr("y", -r + 4)
        .attr("fill", "rgba(255, 255, 255, 0.25)")
        .attr("font-size", "9px")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${levelFactor}%`);
    }

    // Spokes and labels
    COMPARISON_DATA.forEach((dim, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      const isSelected = dim.id === activeId;

      // Spoke line
      g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", y)
        .attr("stroke", isSelected ? "rgba(245, 158, 11, 0.5)" : "rgba(255, 255, 255, 0.1)")
        .attr("stroke-width", isSelected ? 1.5 : 1)
        .attr("stroke-dasharray", isSelected ? "none" : "2,2");

      // Outer label
      const labelRadius = radius + 30;
      const lx = labelRadius * Math.cos(angle);
      const ly = labelRadius * Math.sin(angle);

      let textAnchor: "middle" | "start" | "end" = "middle";
      if (Math.abs(Math.cos(angle)) > 0.3) {
        textAnchor = Math.cos(angle) > 0 ? "start" : "end";
      }

      const labelG = g
        .append("g")
        .attr("class", "cursor-pointer")
        .on("click", () => handleSelect(dim.id))
        .on("mouseenter", () => setHoveredDimension(dim))
        .on("mouseleave", () => setHoveredDimension(null));

      labelG
        .append("text")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", textAnchor)
        .attr("fill", isSelected ? "#fbbf24" : "rgba(255, 255, 255, 0.8)")
        .attr("font-size", isSelected ? "11px" : "10px")
        .attr("font-weight", isSelected ? "600" : "500")
        .attr("font-family", "CustomMonospace, monospace")
        .text(dim.metricLabel);

      labelG
        .append("text")
        .attr("x", lx)
        .attr("y", ly + 12)
        .attr("text-anchor", textAnchor)
        .attr("fill", isSelected ? "#f59e0b" : "#71717a")
        .attr("font-size", "8.5px")
        .attr("font-family", "CustomMonospace, monospace")
        .text(dim.advantage);
    });

    // Traditional Cloud Polygon (Organic, spikes on Search & Sharing)
    const tradPoints: [number, number][] = COMPARISON_DATA.map((d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const r = (d.traditionalScore / 100) * radius;
      return [r * Math.cos(angle), r * Math.sin(angle)];
    });

    g.append("polygon")
      .attr("points", tradPoints.map((p) => p.join(",")).join(" "))
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 2.2)
      .attr("stroke-dasharray", "5,4")
      .attr("fill", "rgba(239, 68, 68, 0.18)")
      .attr("opacity", 0.9);

    // Securitas Zero-Trust Polygon (Organic, dominates on Sovereignty & Audit)
    const secPoints: [number, number][] = COMPARISON_DATA.map((d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const r = (d.securitasScore / 100) * radius;
      return [r * Math.cos(angle), r * Math.sin(angle)];
    });

    g.append("polygon")
      .attr("points", secPoints.map((p) => p.join(",")).join(" "))
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 2.5)
      .attr("fill", "rgba(245, 158, 11, 0.24)")
      .attr("filter", "url(#glow-amber)");

    // Traditional points & numeric value badges
    tradPoints.forEach((p, i) => {
      const dim = COMPARISON_DATA[i];
      const isSelected = dim.id === activeId;
      const angle = i * angleSlice - Math.PI / 2;
      const isTradLead = dim.traditionalScore > dim.securitasScore;

      g.append("circle")
        .attr("cx", p[0])
        .attr("cy", p[1])
        .attr("r", isSelected ? 6.5 : 4.5)
        .attr("fill", isTradLead ? "#f87171" : "#ef4444")
        .attr("stroke", "#08080a")
        .attr("stroke-width", 1.5)
        .attr("class", "cursor-pointer")
        .on("click", () => handleSelect(dim.id))
        .on("mouseenter", () => setHoveredDimension(dim))
        .on("mouseleave", () => setHoveredDimension(null));

      // Numeric percentage text
      const offsetDist = isTradLead ? 12 : -12;
      const tx = p[0] + offsetDist * Math.cos(angle);
      const ty = p[1] + offsetDist * Math.sin(angle);

      g.append("text")
        .attr("x", tx)
        .attr("y", ty + 3)
        .attr("text-anchor", "middle")
        .attr("fill", isTradLead ? "#f87171" : "#fca5a5")
        .attr("font-size", isTradLead ? "9.5px" : "8px")
        .attr("font-weight", isTradLead ? "bold" : "normal")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${dim.traditionalScore}%`);
    });

    // Securitas points & numeric value badges
    secPoints.forEach((p, i) => {
      const dim = COMPARISON_DATA[i];
      const isSelected = dim.id === activeId;
      const angle = i * angleSlice - Math.PI / 2;
      const isSecLead = dim.securitasScore >= dim.traditionalScore;

      g.append("circle")
        .attr("cx", p[0])
        .attr("cy", p[1])
        .attr("r", isSelected ? 7 : 5)
        .attr("fill", isSelected ? "#ffffff" : "#fbbf24")
        .attr("stroke", "#f59e0b")
        .attr("stroke-width", 2)
        .attr("class", "cursor-pointer transition-all")
        .on("click", () => handleSelect(dim.id))
        .on("mouseenter", () => setHoveredDimension(dim))
        .on("mouseleave", () => setHoveredDimension(null));

      // Numeric percentage text
      const offsetDist = isSecLead ? 12 : -12;
      const sx = p[0] + offsetDist * Math.cos(angle);
      const sy = p[1] + offsetDist * Math.sin(angle);

      g.append("text")
        .attr("x", sx)
        .attr("y", sy + 3)
        .attr("text-anchor", "middle")
        .attr("fill", isSecLead ? "#fbbf24" : "#fde68a")
        .attr("font-size", isSecLead ? "9.5px" : "8px")
        .attr("font-weight", isSecLead ? "bold" : "normal")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${dim.securitasScore}%`);
    });

    // Center badge
    g.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 15)
      .attr("fill", "#101015")
      .attr("stroke", "rgba(255, 255, 255, 0.15)");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "3.5px")
      .attr("font-size", "7.5px")
      .attr("fill", "#a3a3a3")
      .attr("font-family", "CustomMonospace, monospace")
      .text("DELTA");
  }

  /* =====================================================================
     2. DIVERGING GAP & COMPARATIVE BAR CHART
     ===================================================================== */
  function renderBarChart(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    width: number,
    height: number,
  ) {
    const margin = { top: 30, right: 140, bottom: 40, left: 180 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    const yScale = d3
      .scaleBand()
      .domain(COMPARISON_DATA.map((d) => d.id))
      .range([0, chartHeight])
      .padding(0.35);

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, chartWidth]);

    // Grid lines
    [0, 25, 50, 75, 100].forEach((tick) => {
      g.append("line")
        .attr("x1", xScale(tick))
        .attr("y1", 0)
        .attr("x2", xScale(tick))
        .attr("y2", chartHeight)
        .attr("stroke", "rgba(255, 255, 255, 0.06)")
        .attr("stroke-dasharray", "3,3");

      g.append("text")
        .attr("x", xScale(tick))
        .attr("y", chartHeight + 18)
        .attr("text-anchor", "middle")
        .attr("fill", "#71717a")
        .attr("font-size", "9px")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${tick}%`);
    });

    const barHeight = yScale.bandwidth() / 2 - 2;

    COMPARISON_DATA.forEach((d) => {
      const y = yScale(d.id) ?? 0;
      const isSelected = d.id === activeId;
      const isSecuritasLead = d.securitasScore >= d.traditionalScore;

      // Group for interaction
      const rowG = g
        .append("g")
        .attr("class", "cursor-pointer")
        .on("click", () => handleSelect(d.id))
        .on("mouseenter", () => setHoveredDimension(d))
        .on("mouseleave", () => setHoveredDimension(null));

      // Row background highlight if selected
      if (isSelected) {
        rowG
          .append("rect")
          .attr("x", -margin.left + 10)
          .attr("y", y - 4)
          .attr("width", width - 20)
          .attr("height", yScale.bandwidth() + 8)
          .attr("rx", 6)
          .attr("fill", "rgba(245, 158, 11, 0.05)")
          .attr("stroke", "rgba(245, 158, 11, 0.2)");
      }

      // Dimension Label on Left
      rowG
        .append("text")
        .attr("x", -12)
        .attr("y", y + yScale.bandwidth() / 2 - 2)
        .attr("text-anchor", "end")
        .attr("fill", isSelected ? "#fbbf24" : "#e5e5e5")
        .attr("font-size", "11px")
        .attr("font-weight", isSelected ? "600" : "400")
        .attr("font-family", "CustomMonospace, monospace")
        .text(d.metricLabel);

      rowG
        .append("text")
        .attr("x", -12)
        .attr("y", y + yScale.bandwidth() / 2 + 10)
        .attr("text-anchor", "end")
        .attr("fill", "#71717a")
        .attr("font-size", "8.5px")
        .attr("font-family", "CustomMonospace, monospace")
        .text(d.advantage);

      // Track 1 (Securitas)
      rowG
        .append("rect")
        .attr("x", 0)
        .attr("y", y)
        .attr("width", chartWidth)
        .attr("height", barHeight)
        .attr("rx", 3)
        .attr("fill", "rgba(255, 255, 255, 0.03)");

      // Securitas Bar
      rowG
        .append("rect")
        .attr("x", 0)
        .attr("y", y)
        .attr("width", xScale(d.securitasScore))
        .attr("height", barHeight)
        .attr("rx", 3)
        .attr("fill", "url(#amber-bar-grad)")
        .attr("filter", isSelected ? "url(#glow-amber)" : "none");

      // Securitas Score Text
      rowG
        .append("text")
        .attr("x", xScale(d.securitasScore) - 6)
        .attr("y", y + barHeight / 2 + 3)
        .attr("text-anchor", "end")
        .attr("fill", "#000000")
        .attr("font-size", "8.5px")
        .attr("font-weight", "bold")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${d.securitasScore}%`);

      // Track 2 (Traditional)
      rowG
        .append("rect")
        .attr("x", 0)
        .attr("y", y + barHeight + 4)
        .attr("width", chartWidth)
        .attr("height", barHeight)
        .attr("rx", 3)
        .attr("fill", "rgba(255, 255, 255, 0.03)");

      // Traditional Bar
      rowG
        .append("rect")
        .attr("x", 0)
        .attr("y", y + barHeight + 4)
        .attr("width", xScale(d.traditionalScore))
        .attr("height", barHeight)
        .attr("rx", 3)
        .attr("fill", "url(#red-bar-grad)");

      // Traditional Score Text
      rowG
        .append("text")
        .attr("x", Math.max(xScale(d.traditionalScore) - 6, 26))
        .attr("y", y + barHeight + 4 + barHeight / 2 + 3)
        .attr("text-anchor", "end")
        .attr("fill", "#000000")
        .attr("font-size", "8.5px")
        .attr("font-weight", "bold")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${d.traditionalScore}%`);

      // Delta Badge on Right
      const badgeG = rowG
        .append("g")
        .attr("transform", `translate(${chartWidth + 12}, ${y + yScale.bandwidth() / 2 - 10})`);

      badgeG
        .append("rect")
        .attr("width", 115)
        .attr("height", 20)
        .attr("rx", 10)
        .attr("fill", isSecuritasLead ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)")
        .attr("stroke", isSecuritasLead ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)");

      badgeG
        .append("text")
        .attr("x", 57)
        .attr("y", 13)
        .attr("text-anchor", "middle")
        .attr("fill", isSecuritasLead ? "#fbbf24" : "#f87171")
        .attr("font-size", "9px")
        .attr("font-weight", "600")
        .attr("font-family", "CustomMonospace, monospace")
        .text(d.delta.split(" ")[0] + " " + d.delta.split(" ")[1]);
    });
  }

  /* =====================================================================
     3. ATTACK EXPOSURE VS CRYPTOGRAPHIC IMMUNITY MATRIX
     ===================================================================== */
  function renderMatrixChart(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    width: number,
    height: number,
  ) {
    const margin = { top: 40, right: 50, bottom: 60, left: 70 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, chartWidth]); // Exposure (0 = safe, 100 = leaked)
    const yScale = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]); // Immunity (100 = provable)

    // Quadrant Backgrounds
    // Top-Left: Zero-Trust Safe Zone (Securitas)
    g.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", chartWidth / 2)
      .attr("height", chartHeight / 2)
      .attr("fill", "rgba(16, 185, 129, 0.03)");

    g.append("text")
      .attr("x", 12)
      .attr("y", 20)
      .attr("fill", "rgba(52, 211, 153, 0.6)")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("font-family", "CustomMonospace, monospace")
      .text("ZERO-TRUST SOVEREIGN ZONE (Securitas)");

    // Bottom-Right: High Vulnerability Zone (Traditional Cloud)
    g.append("rect")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight / 2)
      .attr("width", chartWidth / 2)
      .attr("height", chartHeight / 2)
      .attr("fill", "rgba(239, 68, 68, 0.03)");

    g.append("text")
      .attr("x", chartWidth - 12)
      .attr("y", chartHeight - 12)
      .attr("text-anchor", "end")
      .attr("fill", "rgba(248, 113, 113, 0.5)")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("font-family", "CustomMonospace, monospace")
      .text("LEGACY EXPOSURE ZONE (Traditional)");

    // Center dividing crosshairs
    g.append("line")
      .attr("x1", chartWidth / 2)
      .attr("y1", 0)
      .attr("x2", chartWidth / 2)
      .attr("y2", chartHeight)
      .attr("stroke", "rgba(255, 255, 255, 0.08)")
      .attr("stroke-dasharray", "4,4");

    g.append("line")
      .attr("x1", 0)
      .attr("y1", chartHeight / 2)
      .attr("x2", chartWidth)
      .attr("y2", chartHeight / 2)
      .attr("stroke", "rgba(255, 255, 255, 0.08)")
      .attr("stroke-dasharray", "4,4");

    // Grid ticks
    [0, 25, 50, 75, 100].forEach((tick) => {
      // X ticks
      g.append("text")
        .attr("x", xScale(tick))
        .attr("y", chartHeight + 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#71717a")
        .attr("font-size", "8.5px")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${tick}%`);

      // Y ticks
      g.append("text")
        .attr("x", -10)
        .attr("y", yScale(tick) + 3)
        .attr("text-anchor", "end")
        .attr("fill", "#71717a")
        .attr("font-size", "8.5px")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`${tick}%`);
    });

    // Axis Labels
    g.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + 38)
      .attr("text-anchor", "middle")
      .attr("fill", "#a3a3a3")
      .attr("font-size", "11px")
      .attr("font-family", "CustomMonospace, monospace")
      .text("Plaintext Exposure & Attack Surface Risk → (Lower is Safer)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("fill", "#a3a3a3")
      .attr("font-size", "11px")
      .attr("font-family", "CustomMonospace, monospace")
      .text("Cryptographic Tamper Immunity → (Higher is Safer)");

    // Arrow marker for vectors
    svg
      .select("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 6)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 1 L 10 5 L 0 9 z")
      .attr("fill", "#f59e0b");

    // Plot dimension pairs and transition vectors
    COMPARISON_DATA.forEach((d) => {
      const isSelected = d.id === activeId;

      const tx = xScale(d.exposureTraditional);
      const ty = yScale(d.immunityTraditional);
      const sx = xScale(d.exposureSecuritas);
      const sy = yScale(d.immunitySecuritas);

      const nodeG = g
        .append("g")
        .attr("class", "cursor-pointer")
        .on("click", () => handleSelect(d.id))
        .on("mouseenter", () => setHoveredDimension(d))
        .on("mouseleave", () => setHoveredDimension(null));

      // Connecting transition vector (Traditional -> Securitas)
      nodeG
        .append("line")
        .attr("x1", tx)
        .attr("y1", ty)
        .attr("x2", sx)
        .attr("y2", sy)
        .attr("stroke", isSelected ? "#f59e0b" : "rgba(245, 158, 11, 0.35)")
        .attr("stroke-width", isSelected ? 2 : 1.2)
        .attr("stroke-dasharray", "4,3")
        .attr("marker-end", "url(#arrow)");

      // Traditional Node (Red)
      nodeG
        .append("circle")
        .attr("cx", tx)
        .attr("cy", ty)
        .attr("r", isSelected ? 6.5 : 4.5)
        .attr("fill", "#ef4444")
        .attr("stroke", "#08080a")
        .attr("stroke-width", 1.5)
        .attr("opacity", isSelected ? 1 : 0.7);

      // Traditional Label
      nodeG
        .append("text")
        .attr("x", tx + 8)
        .attr("y", ty + 3)
        .attr("fill", isSelected ? "#f87171" : "#71717a")
        .attr("font-size", "8.5px")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`[Legacy] ${d.metricLabel}`);

      // Securitas Node (Amber)
      nodeG
        .append("circle")
        .attr("cx", sx)
        .attr("cy", sy)
        .attr("r", isSelected ? 8 : 5.5)
        .attr("fill", isSelected ? "#ffffff" : "#fbbf24")
        .attr("stroke", "#f59e0b")
        .attr("stroke-width", 2)
        .attr("filter", isSelected ? "url(#glow-amber)" : "none");

      // Securitas Label
      nodeG
        .append("text")
        .attr("x", sx + 10)
        .attr("y", sy + 4)
        .attr("fill", isSelected ? "#fbbf24" : "#e5e5e5")
        .attr("font-size", isSelected ? "10.5px" : "9.5px")
        .attr("font-weight", isSelected ? "bold" : "500")
        .attr("font-family", "CustomMonospace, monospace")
        .text(`Securitas (${d.advantage})`);
    });
  }

  const displayedDim = hoveredDimension ?? activeDimension;

  return (
    <div className="space-y-6">
      {/* Top Controls: Graph Type Selector & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        {/* Graph Type Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 p-1">
          <button
            type="button"
            onClick={() => setGraphType("radar")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              graphType === "radar"
                ? "bg-white text-black shadow-md font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Radar size={14} />
            <span>Radar Benchmark</span>
          </button>

          <button
            type="button"
            onClick={() => setGraphType("bars")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              graphType === "bars"
                ? "bg-white text-black shadow-md font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <BarChart3 size={14} />
            <span>Comparative Gap</span>
          </button>

          <button
            type="button"
            onClick={() => setGraphType("matrix")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              graphType === "matrix"
                ? "bg-white text-black shadow-md font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <ScatterChart size={14} />
            <span>Exposure Matrix</span>
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
            <span className="text-amber-300 font-semibold">Securitas Zero-Trust</span>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 border border-amber-500/30">
              4 Sovereign Leads
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="text-red-300 font-semibold">Traditional Cloud</span>
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 border border-red-500/30">
              2 Convenience Leads
            </span>
          </div>
        </div>
      </div>

      {/* Main Plot Container */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101015] p-4 sm:p-6 shadow-2xl">
        {/* Subtle Ambient Background */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-red-500/5 blur-3xl" />

        {/* Graph Description Pill */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span>
              {graphType === "radar" &&
                "Organic Asymmetric Profile: Securitas leads in Cryptographic Proof & Custody; Traditional leads in Fuzzy Agility & Link Speed."}
              {graphType === "bars" &&
                "Side-by-Side Protection Index & Advantage Delta per Dimension"}
              {graphType === "matrix" &&
                "Vector Plot: Plaintext Exposure vs. Cryptographic Tamper Immunity"}
            </span>
          </div>
          <span className="text-[11px] text-neutral-500">
            Interactive: Click or hover nodes to inspect
          </span>
        </div>

        {/* The D3 SVG Element */}
        <div className="w-full overflow-x-auto">
          <svg
            ref={svgRef}
            viewBox="0 0 760 440"
            className="w-full max-w-full h-auto min-w-[640px] select-none"
            preserveAspectRatio="xMidYMid meet"
          />
        </div>

        {/* Dimension Quick-Select Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
          <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
            Inspect Dimension:
          </span>
          {COMPARISON_DATA.map((dim) => {
            const isSelected = dim.id === activeId;
            const isSecLead = dim.securitasScore >= dim.traditionalScore;
            return (
              <button
                key={dim.id}
                type="button"
                onClick={() => handleSelect(dim.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono transition flex items-center gap-1.5 ${
                  isSelected
                    ? isSecLead
                      ? "border border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold"
                      : "border border-red-500/40 bg-red-500/15 text-red-300 font-semibold"
                    : "border border-white/5 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isSecLead ? "bg-amber-400" : "bg-red-400"
                  }`}
                />
                <span>{dim.metricLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Detail Card for the Hovered / Active Dimension */}
      <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                displayedDim.securitasScore >= displayedDim.traditionalScore
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              <Shield size={20} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
                Dimension Breakdown
              </p>
              <h3 className="text-base font-medium text-white">
                {displayedDim.feature}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
                displayedDim.securitasScore >= displayedDim.traditionalScore
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              {displayedDim.delta}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Traditional Liability Box */}
          <div
            className={`rounded-xl border p-4 ${
              displayedDim.traditionalScore > displayedDim.securitasScore
                ? "border-red-500/40 bg-red-950/25"
                : "border-red-500/20 bg-red-950/15"
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-red-400">
              <div className="flex items-center gap-2">
                <XCircle size={15} />
                <span>Traditional Cloud Storage</span>
              </div>
              {displayedDim.traditionalScore > displayedDim.securitasScore && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300 font-mono">
                  Legacy Lead (+{displayedDim.traditionalScore - displayedDim.securitasScore}%)
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-300">
              {displayedDim.traditional}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-red-500/20 pt-2 text-[11px] font-mono text-red-300">
              <span>Agility / Index: {displayedDim.traditionalScore}%</span>
              <span>Exposure Risk: {displayedDim.exposureTraditional}%</span>
            </div>
          </div>

          {/* Securitas Guarantee Box */}
          <div
            className={`rounded-xl border p-4 ${
              displayedDim.securitasScore >= displayedDim.traditionalScore
                ? "border-emerald-500/30 bg-emerald-950/20"
                : "border-amber-500/20 bg-amber-950/10"
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>Securitas Zero-Trust</span>
              </div>
              {displayedDim.securitasScore >= displayedDim.traditionalScore && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 font-mono">
                  Securitas Lead (+{displayedDim.securitasScore - displayedDim.traditionalScore}%)
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-200">
              {displayedDim.securitas}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-emerald-500/20 pt-2 text-[11px] font-mono text-emerald-300">
              <span>Security Rating: {displayedDim.securitasScore}%</span>
              <span>Immunity Rating: {displayedDim.immunitySecuritas}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
