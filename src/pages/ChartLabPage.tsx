import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { renderThermalChart, type ThermalChartSpec } from "../charts/thermal";
import { Brand } from "../components/Brand";
import { PaperSurface } from "../components/PaperSurface";
import { escapeXml, textAttributes, thermalType } from "../receipt/layout";
import type { PaperWidthDots } from "../blocks/types";

type StudyId = ThermalChartSpec["kind"];

const studies: Array<{ id: StudyId; index: string; name: string; description: string; use: string }> = [
  { id: "line", index: "01", name: "Trend line", description: "A continuous shape with optional one-bit hatching and a directly marked latest value.", use: "Markets · temperature · tides · energy" },
  { id: "bars", index: "02", name: "Bars & lollipops", description: "Discrete quantities with enough mass to survive a fast thermal head.", use: "Rain · standings · spending · splits" },
  { id: "range", index: "03", name: "Range rails", description: "Low, high, and current position without introducing a fragile axis.", use: "Weather · sleep · delays · delivery windows" },
  { id: "dots", index: "04", name: "Labeled dot matrix", description: "Named rows and open marks turn a compact chart into something the human can finish by hand.", use: "Habits · inspections · routines · attendance" },
  { id: "timeline", index: "05", name: "Event timeline", description: "Past, current, and future states on one physical route.", use: "Packages · games · deployments · medication" },
];

function studySpec(id: StudyId, width: number, height: number): ThermalChartSpec {
  if (id === "line") return { kind: "line", width, height, values: [62, 64, 63, 68, 71, 69, 74, 73, 76], fill: "hatch", guides: 3 };
  if (id === "bars") return { kind: "bars", width, height, values: [3, 7, 11, 8, 16, 12, 6, 4] };
  if (id === "range") return { kind: "range", width, height, values: [{ low: 54, high: 76, value: 71 }, { low: 57, high: 73, value: 68 }, { low: 60, high: 78, value: 74 }] };
  if (id === "dots") return { kind: "dots", width, height, columns: 7, values: [2, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1] };
  return { kind: "timeline", width, height, values: [{ position: 0, state: "past" }, { position: 0.3, state: "past" }, { position: 0.66, state: "current" }, { position: 1, state: "future" }] };
}

function renderStudy(id: StudyId, width: PaperWidthDots) {
  const padding = width === 576 ? 28 : 22;
  const contentWidth = width - padding * 2;
  const chartHeight = id === "dots" ? 112 : id === "range" ? 120 : 94;
  const top = id === "dots" ? 92 : 80;
  const dotGutter = width === 576 ? 100 : 82;
  const chartWidth = id === "range" ? contentWidth - 76 : id === "dots" ? contentWidth - dotGutter : contentWidth;
  const chart = renderThermalChart(studySpec(id, chartWidth, chartHeight));
  let heading = "";
  let annotation = "";
  if (id === "line") {
    heading = `<text x="0" y="55" ${textAttributes(thermalType.heading, 780)}>76°</text><text x="${contentWidth}" y="55" text-anchor="end" ${textAttributes(thermalType.section, 650)}>▲ 4.2%</text>`;
    annotation = `<text x="0" y="${top + chartHeight + 20}" ${textAttributes(thermalType.label, 540)}>6 AM</text><text x="${contentWidth}" y="${top + chartHeight + 20}" text-anchor="end" ${textAttributes(thermalType.label, 540)}>NOW</text>`;
  } else if (id === "bars") {
    heading = `<text x="0" y="55" ${textAttributes(thermalType.heading, 780)}>Rain by hour</text>`;
    annotation = `<text x="0" y="${top + chartHeight + 20}" ${textAttributes(thermalType.label, 540)}>8 AM</text><text x="${contentWidth / 2}" y="${top + chartHeight + 20}" text-anchor="middle" ${textAttributes(thermalType.label, 540)}>NOON</text><text x="${contentWidth}" y="${top + chartHeight + 20}" text-anchor="end" ${textAttributes(thermalType.label, 540)}>4 PM</text>`;
  } else if (id === "range") {
    heading = `<text x="0" y="55" ${textAttributes(thermalType.heading, 780)}>Daily range</text>`;
    const rowHeight = chartHeight / 3;
    annotation = ["TODAY", "TYPICAL", "GOAL"].map((value, index) => `<text x="0" y="${top + rowHeight * index + rowHeight / 2 + 4}" ${textAttributes(thermalType.label, 560)}>${value}</text>`).join("");
  } else if (id === "dots") {
    heading = `<text x="0" y="55" ${textAttributes(thermalType.heading, 780)}>Weekly habits</text>`;
    const dayWidth = chartWidth / 7;
    annotation = ["M", "T", "W", "T", "F", "S", "S"].map((day, index) => `<text x="${dotGutter + dayWidth * index + dayWidth / 2}" y="${top - 9}" text-anchor="middle" ${textAttributes(thermalType.label, 540)}>${day}</text>`).join("");
    annotation += ["MOVE", "WATER", "READ", "SLEEP"].map((row, index) => `<text x="0" y="${top + chartHeight / 4 * index + chartHeight / 8 + 4}" ${textAttributes(thermalType.label, 600)}>${row}</text>`).join("");
    annotation += `<line x1="${dotGutter - 9}" y1="${top - 20}" x2="${dotGutter - 9}" y2="${top + chartHeight}" stroke="#000"/>`;
  } else {
    heading = `<text x="0" y="55" ${textAttributes(thermalType.heading, 780)}>Out for delivery</text>`;
    annotation = `<text x="10" y="${top + chartHeight / 2 + 30}" ${textAttributes(thermalType.label, 540)}>SHIPPED</text><text x="${contentWidth * 0.66}" y="${top + chartHeight / 2 + 30}" text-anchor="middle" ${textAttributes(thermalType.label, 650)}>BROOKLYN</text><text x="${contentWidth - 10}" y="${top + chartHeight / 2 + 30}" text-anchor="end" ${textAttributes(thermalType.label, 540)}>YOUR STOP</text>`;
  }
  const chartX = id === "range" ? 76 : id === "dots" ? dotGutter : 0;
  const height = Math.ceil(top + chartHeight + 44 + padding * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(id)} thermal chart at ${width} dots" data-chart-study="${id}"><rect width="${width}" height="${height}" fill="#fff"/><g transform="translate(${padding} ${padding})"><text x="0" y="${thermalType.label.size}" ${textAttributes(thermalType.label)}>THERMAL CHART STUDY</text><text x="${contentWidth}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 540)}>${width} DOTS</text>${heading}<g transform="translate(${chartX} ${top})">${chart.markup}</g>${annotation}</g></svg>`;
}

function StudyPaper({ id, width }: { id: StudyId; width: PaperWidthDots }) {
  const svg = renderStudy(id, width);
  const height = Number(svg.match(/height="(\d+)"/)?.[1] ?? 1);
  return <PaperSurface className={`chart-study-paper ${width === 420 ? "paper-narrow" : ""}`} style={{ aspectRatio: `${width} / ${height}` }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ChartLabPage() {
  return <main className="chart-lab-page">
    <header className="blocks-header"><Brand compact /><div className="blocks-header-note"><span>Experimental surface</span><strong>Thermal chart lab</strong></div><Link className="text-button" to="/blocks"><ArrowLeft size={14} />Back to blocks</Link></header>
    <section className="chart-lab-intro"><span className="kicker">A visual grammar for one-bit ink</span><h1>Charts made<br />for paper.</h1><p>Five compact primitives create a shared language for markets, weather, routines, movement, and everything else we turn into a receipt.</p></section>
    <section className="chart-study-list" aria-label="Thermal chart studies">
      {studies.map((study) => <article className="chart-study" key={study.id}>
        <header><div><span>{study.index} · Primitive</span><h2>{study.name}</h2></div><p>{study.description}</p><strong>{study.use}</strong></header>
        <div className="chart-study-widths"><figure><figcaption>80 mm · 576 dots</figcaption><div className="chart-study-stage"><StudyPaper id={study.id} width={576} /></div></figure><figure><figcaption>58 mm · 420 dots</figcaption><div className="chart-study-stage narrow"><StudyPaper id={study.id} width={420} /></div></figure></div>
      </article>)}
    </section>
    <footer className="blocks-footer"><strong>PETE’S PRINTER</strong><span>One geometry engine. Browser preview and physical paper.</span><Link to="/blocks">Return to block playground</Link></footer>
  </main>;
}
