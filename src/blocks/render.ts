import { escapeXml, textAttributes, thermalType, wrapText, type TextStyle } from "../receipt/layout";
import { renderThermalChart } from "../charts/thermal";
import type { PaperWidthDots, PrototypeBlockId, PrototypeDataMap, RenderedPrototype } from "./types";

export type PrototypePart = { markup: string; height: number };
type Part = PrototypePart;

const rule = (y: number, width: number, weight = 1) => `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#000" stroke-width="${weight}"/>`;

function lines(text: string, width: number, style: TextStyle, x: number, y: number, options: { weight?: number; max?: number; anchor?: "start" | "middle" | "end" } = {}) {
  const weight = options.weight ?? style.weight;
  const wrapped = wrapText(text, width, { ...style, weight }).slice(0, options.max ?? Number.POSITIVE_INFINITY);
  const anchor = options.anchor ?? "start";
  return {
    markup: wrapped.map((line, index) => `<text x="${x}" y="${y + style.size + index * style.lineHeight}" text-anchor="${anchor}" ${textAttributes(style, weight)}>${escapeXml(line)}</text>`).join(""),
    height: wrapped.length * style.lineHeight,
  };
}

function label(text: string, x: number, y: number, anchor: "start" | "middle" | "end" = "start") {
  return `<text x="${x}" y="${y + thermalType.label.size}" text-anchor="${anchor}" ${textAttributes(thermalType.label)}>${escapeXml(text.toUpperCase())}</text>`;
}

function emptyBox(x: number, y: number, size = 18) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="1" fill="#fff" stroke="#000" stroke-width="2"/>`;
}

function sectionTag(text: string, x: number, y: number) {
  const width = Math.max(58, text.length * 8 + 20);
  return `<rect x="${x}" y="${y}" width="${width}" height="25" fill="#000"/><text x="${x + 9}" y="${y + 17}" font-family="Inter,Arial,sans-serif" font-size="11" font-weight="760" letter-spacing=".8" fill="#fff">${escapeXml(text.toUpperCase())}</text>`;
}

function shortTeam(value: string) {
  if (value.length <= 14) return value;
  const words = value.split(/\s+/);
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 4).toUpperCase();
  return value.slice(0, 13);
}

function renderWeather(data: PrototypeDataMap["weather"], width: number): Part {
  let markup = label("Daily weather", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.updated)}</text>`;
  const heading = lines(data.condition, width, thermalType.heading, 0, 30, { weight: 760, max: 1 });
  const summary = lines(data.summary, width, thermalType.small, 0, 68, { max: 2 });
  const timelineTop = 68 + summary.height + 20;
  const cell = width / 3;
  markup += heading.markup + summary.markup;
  data.points.forEach((point, index) => {
    const center = cell * index + cell / 2;
    markup += label(point.label, center, timelineTop, "middle");
    markup += `<text x="${center}" y="${timelineTop + 40}" text-anchor="middle" ${textAttributes(thermalType.numeric)}>${Math.round(point.temperature)}°</text>`;
  });
  const chartTop = timelineTop + 53;
  const chart = renderThermalChart({ kind: "line", width, height: 70, values: data.temperatureTrend, fill: "hatch", guides: 2 });
  markup += `<g transform="translate(0 ${chartTop})">${chart.markup}</g>`;
  markup += `<text x="0" y="${chartTop + 88}" ${textAttributes(thermalType.label, 540)}>6 AM</text><text x="${width / 2}" y="${chartTop + 88}" text-anchor="middle" ${textAttributes(thermalType.label, 540)}>NOON</text><text x="${width}" y="${chartTop + 88}" text-anchor="end" ${textAttributes(thermalType.label, 540)}>8 PM</text>`;
  const kpiTop = chartTop + 101;
  const kpis = [["Rain", `${Math.round(data.precipitation)}%`], ["Max UV", `${data.uv}`], ["Sunset", data.sunset]];
  markup += rule(kpiTop, width) + rule(kpiTop + 65, width);
  kpis.forEach(([name, value], index) => {
    const x = cell * index;
    if (index) markup += `<line x1="${x}" y1="${kpiTop}" x2="${x}" y2="${kpiTop + 65}" stroke="#000"/>`;
    markup += label(name, x + (index ? 12 : 0), kpiTop + 9);
    markup += `<text x="${x + (index ? 12 : 0)}" y="${kpiTop + 51}" ${textAttributes(thermalType.section, 690)}>${escapeXml(value)}</text>`;
  });
  return { markup, height: kpiTop + 66 };
}

function renderAir(data: PrototypeDataMap["air"], width: number): Part {
  const leadWidth = width >= 480 ? 178 : 138;
  let markup = label("Air quality", 0, 0) + `<text x="0" y="79" ${textAttributes({ ...thermalType.numeric, size: 58, lineHeight: 62 }, 790)}>${data.aqi}</text>`;
  markup += `<text x="${leadWidth}" y="52" ${textAttributes(thermalType.heading, 760)}>${escapeXml(data.label)}</text>`;
  markup += `<text x="${leadWidth}" y="78" ${textAttributes(thermalType.small)}>${escapeXml(data.outlook)}</text>`;
  const railY = 104;
  const segmentGap = 5;
  const segmentWidth = (width - segmentGap * 5) / 6;
  const filled = Math.max(1, Math.min(6, Math.ceil(data.aqi / 50)));
  for (let index = 0; index < 6; index += 1) markup += `<rect x="${index * (segmentWidth + segmentGap)}" y="${railY}" width="${segmentWidth}" height="15" fill="${index < filled ? "#000" : "#fff"}" stroke="#000"/>`;
  markup += `<text x="0" y="${railY + 36}" ${textAttributes(thermalType.label, 560)}>GOOD</text><text x="${width}" y="${railY + 36}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>HAZARDOUS</text>`;
  const detailsTop = railY + 55;
  markup += rule(detailsTop, width);
  [["PM2.5", `${data.pm25} μg/m³`], ["UV now", `${data.uv}`]].forEach(([name, value], index) => {
    const x = index * width / 2;
    if (index) markup += `<line x1="${x}" y1="${detailsTop}" x2="${x}" y2="${detailsTop + 62}" stroke="#000"/>`;
    markup += label(name, x + (index ? 16 : 0), detailsTop + 10);
    markup += `<text x="${x + (index ? 16 : 0)}" y="${detailsTop + 48}" ${textAttributes(thermalType.section, 680)}>${escapeXml(value)}</text>`;
  });
  return { markup, height: detailsTop + 63 };
}

function renderSurf(data: PrototypeDataMap["surf"], width: number): Part {
  let markup = label("Surf window", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.location.toUpperCase())}</text>`;
  const summary = lines(data.summary, width, thermalType.small, 0, 30, { weight: 560, max: 2 });
  const chartTop = 30 + summary.height + 16;
  const chart = renderThermalChart({ kind: "line", width, height: 68, values: data.heightTrend, curve: "smooth", guides: 2 });
  markup += summary.markup + `<g transform="translate(0 ${chartTop})">${chart.markup}</g>`;
  markup += `<text x="0" y="${chartTop + 85}" ${textAttributes(thermalType.label, 540)}>MORNING</text><text x="${width}" y="${chartTop + 85}" text-anchor="end" ${textAttributes(thermalType.label, 540)}>EVENING</text>`;
  const top = chartTop + 98;
  const cell = width / 3;
  markup += rule(top, width) + rule(top + 103, width);
  data.windows.forEach((window, index) => {
    const x = index * cell;
    if (index) markup += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + 103}" stroke="#000"/>`;
    const inset = index ? 13 : 0;
    markup += label(window.time, x + inset, top + 10);
    markup += `<text x="${x + inset}" y="${top + 57}" ${textAttributes(thermalType.numeric, 760)}>${window.height.toFixed(1)}′</text>`;
    markup += `<text x="${x + inset}" y="${top + 84}" ${textAttributes(thermalType.small, 580)}>${window.period}s · ${escapeXml(window.direction)}</text>`;
  });
  return { markup, height: top + 104 };
}

function renderGames(data: PrototypeDataMap["games"], width: number): Part {
  let markup = label("Game board", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.league.toUpperCase())}</text>`;
  let y = 34;
  data.games.slice(0, 3).forEach((game) => {
    const rowHeight = 66;
    markup += rule(y, width);
    const teams = `${shortTeam(game.away)}  @  ${shortTeam(game.home)}`;
    markup += `<text x="0" y="${y + 27}" ${textAttributes(thermalType.body, 680)}>${escapeXml(teams)}</text>`;
    if (game.awayScore !== undefined && game.homeScore !== undefined) markup += `<text x="${width}" y="${y + 30}" text-anchor="end" ${textAttributes(thermalType.heading, 780)}>${game.awayScore}–${game.homeScore}</text>`;
    markup += `<text x="0" y="${y + 52}" ${textAttributes(thermalType.label, 560)}>${escapeXml(game.status.toUpperCase())}</text>`;
    y += rowHeight;
  });
  markup += rule(y, width);
  return { markup, height: y + 1 };
}

function renderMarkets(data: PrototypeDataMap["markets"], width: number): Part {
  let markup = label("Market pulse", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.base.toUpperCase())}</text>`;
  const lead = data.rows[0];
  const leadValue = lead.value >= 10 ? lead.value.toFixed(2) : lead.value.toFixed(4);
  markup += `<text x="0" y="58" ${textAttributes(thermalType.heading, 780)}>${escapeXml(lead.symbol)}</text><text x="${width}" y="58" text-anchor="end" ${textAttributes(thermalType.heading, 680)}>${leadValue}</text>`;
  markup += `<text x="${width}" y="83" text-anchor="end" ${textAttributes(thermalType.small, 700)}>${lead.change >= 0 ? "▲" : "▼"} ${Math.abs(lead.change).toFixed(2)}%</text>`;
  const hero = renderThermalChart({ kind: "line", width, height: 92, values: lead.history, fill: "hatch", guides: 3 });
  markup += `<g transform="translate(0 94)">${hero.markup}</g><text x="0" y="202" ${textAttributes(thermalType.label, 540)}>10-DAY DIRECTION</text>`;
  let y = 218;
  data.rows.slice(1).forEach((row) => {
    const chartWidth = width >= 480 ? 135 : 96;
    markup += rule(y, width);
    markup += `<text x="0" y="${y + 34}" ${textAttributes(thermalType.section, 760)}>${escapeXml(row.symbol)}</text>`;
    const value = row.value >= 10 ? row.value.toFixed(2) : row.value.toFixed(4);
    markup += `<text x="70" y="${y + 33}" ${textAttributes(thermalType.body, 620)}>${value}</text>`;
    markup += `<text x="${width - chartWidth - 15}" y="${y + 32}" text-anchor="end" ${textAttributes(thermalType.label, 680)}>${row.change >= 0 ? "▲" : "▼"} ${Math.abs(row.change).toFixed(2)}%</text>`;
    const smallChart = renderThermalChart({ kind: "line", width: chartWidth, height: 34, values: row.history, guides: 0 });
    markup += `<g transform="translate(${width - chartWidth} ${y + 9})">${smallChart.markup}</g>`;
    y += 55;
  });
  markup += rule(y, width);
  return { markup, height: y + 1 };
}

function renderNews(data: PrototypeDataMap["news"], width: number): Part {
  let markup = label("News brief", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>TOP STORIES</text>`;
  let y = 34;
  data.stories.slice(0, 3).forEach((story, index) => {
    const gutter = 38;
    const title = lines(story.title, width - gutter, thermalType.body, gutter, y + 8, { weight: 650, max: 2 });
    const rowHeight = Math.max(66, title.height + 33);
    markup += rule(y, width);
    markup += `<text x="0" y="${y + 37}" ${textAttributes(thermalType.heading, 780)}>${index + 1}</text>` + title.markup;
    markup += `<text x="${gutter}" y="${y + rowHeight - 10}" ${textAttributes(thermalType.label, 540)}>${escapeXml(story.source)} · ${story.score} POINTS · ${escapeXml(story.age)}</text>`;
    y += rowHeight;
  });
  markup += rule(y, width);
  return { markup, height: y + 1 };
}

function renderEarthquakes(data: PrototypeDataMap["earthquakes"], width: number): Part {
  let markup = label("Earthquake watch", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>PAST 24 HOURS</text>`;
  let y = 35;
  data.events.forEach((event) => {
    const magnitudeWidth = 72;
    const place = lines(event.place, width - magnitudeWidth - 12, thermalType.body, magnitudeWidth + 12, y + 5, { weight: 650, max: 2 });
    const rowHeight = Math.max(70, place.height + 31);
    markup += rule(y, width);
    markup += `<rect x="0" y="${y + 10}" width="${magnitudeWidth}" height="44" fill="#000"/><text x="${magnitudeWidth / 2}" y="${y + 42}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="27" font-weight="780" fill="#fff">M ${event.magnitude.toFixed(1)}</text>`;
    markup += place.markup + `<text x="${magnitudeWidth + 12}" y="${y + rowHeight - 9}" ${textAttributes(thermalType.label, 540)}>${event.depth} KM DEEP · ${escapeXml(event.age)} AGO</text>`;
    y += rowHeight;
  });
  markup += rule(y, width);
  return { markup, height: y + 1 };
}

function renderAgenda(data: PrototypeDataMap["agenda"], width: number): Part {
  let markup = label("Agenda", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.date.toUpperCase())}</text>`;
  const timeWidth = width >= 480 ? 96 : 80;
  let y = 38;
  data.events.forEach((event, index) => {
    const contentX = timeWidth + 14;
    const title = lines(event.title, width - contentX, thermalType.body, contentX, y, { weight: 680, max: 2 });
    const detailHeight = event.detail ? thermalType.label.lineHeight + 5 : 0;
    const rowHeight = Math.max(49, title.height + detailHeight + 10);
    markup += `<text x="0" y="${y + 20}" ${textAttributes(thermalType.small, 680)}>${escapeXml(event.start)}</text>`;
    if (event.end) markup += `<text x="0" y="${y + 41}" ${textAttributes(thermalType.label, 520)}>${escapeXml(event.end)}</text>`;
    markup += title.markup;
    if (event.detail) markup += `<text x="${contentX}" y="${y + title.height + 21}" ${textAttributes(thermalType.label, 540)}>${escapeXml(event.detail.toUpperCase())}</text>`;
    y += rowHeight;
    if (index < data.events.length - 1) markup += `<line x1="${contentX}" y1="${y}" x2="${width}" y2="${y}" stroke="#000"/>`;
    y += 11;
  });
  return { markup, height: y - 10 };
}

function renderDepartures(data: PrototypeDataMap["departures"], width: number): Part {
  let markup = label("Departures", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.station.toUpperCase())}</text>`;
  const platformX = width - (width >= 480 ? 145 : 105);
  let y = 34;
  data.rows.forEach((row) => {
    markup += rule(y, width);
    markup += `<text x="0" y="${y + 27}" ${textAttributes(thermalType.small, 700)}>${escapeXml(row.time)}</text>`;
    const destination = lines(row.destination, platformX - 62, thermalType.small, 58, y + 5, { weight: 650, max: 1 });
    markup += destination.markup;
    markup += `<text x="${platformX}" y="${y + 27}" ${textAttributes(thermalType.small, 680)}>P${escapeXml(row.platform)}</text>`;
    markup += `<text x="${width}" y="${y + 27}" text-anchor="end" ${textAttributes(thermalType.label, row.status === "On time" ? 540 : 760)}>${escapeXml(row.status.toUpperCase())}</text>`;
    y += 48;
  });
  markup += rule(y, width);
  return { markup, height: y + 1 };
}

function renderHome(data: PrototypeDataMap["home"], width: number): Part {
  let markup = label("Home pulse", 0, 0);
  const heading = lines(data.headline, width, thermalType.heading, 0, 29, { weight: 760, max: 1 });
  markup += heading.markup;
  let y = 29 + heading.height + 14;
  data.rows.filter((row) => row.label !== "Energy today").forEach((row) => {
    markup += rule(y, width);
    const marker = row.state === "attention" ? `<rect x="0" y="${y + 12}" width="12" height="12" fill="#000"/>` : `<circle cx="6" cy="${y + 18}" r="5" fill="none" stroke="#000" stroke-width="2"/>`;
    markup += marker + `<text x="25" y="${y + 27}" ${textAttributes(thermalType.body, row.state === "attention" ? 690 : 520)}>${escapeXml(row.label)}</text>`;
    markup += `<text x="${width}" y="${y + 27}" text-anchor="end" ${textAttributes(thermalType.body, 690)}>${escapeXml(row.value)}</text>`;
    y += 48;
  });
  markup += rule(y, width);
  const energy = data.rows.find((row) => row.label === "Energy today");
  markup += label("Energy today", 0, y + 14) + `<text x="${width}" y="${y + 26}" text-anchor="end" ${textAttributes(thermalType.body, 690)}>${escapeXml(energy?.value ?? "")}</text>`;
  const chart = renderThermalChart({ kind: "line", width, height: 58, values: data.energyHistory, curve: "step", guides: 2 });
  markup += `<g transform="translate(0 ${y + 42})">${chart.markup}</g>`;
  return { markup, height: y + 101 };
}

function renderHabit(data: PrototypeDataMap["habit"], width: number): Part {
  let markup = label("Habit matrix", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.period.toUpperCase())}</text>`;
  markup += `<text x="0" y="55" ${textAttributes(thermalType.heading, 760)}>${escapeXml(data.title)}</text>`;
  const gutter = width >= 480 ? 112 : 91;
  const chartWidth = width - gutter;
  const chartTop = 92;
  const chartHeight = data.rows.length * 38;
  const chart = renderThermalChart({ kind: "dots", width: chartWidth, height: chartHeight, columns: 7, values: data.rows.flatMap((row) => row.values) });
  const dayWidth = chartWidth / 7;
  ["M", "T", "W", "T", "F", "S", "S"].forEach((day, index) => { markup += `<text x="${gutter + dayWidth * index + dayWidth / 2}" y="80" text-anchor="middle" ${textAttributes(thermalType.label, 560)}>${day}</text>`; });
  markup += `<line x1="${gutter - 10}" y1="69" x2="${gutter - 10}" y2="${chartTop + chartHeight}" stroke="#000"/>`;
  data.rows.forEach((row, index) => {
    const center = chartTop + chartHeight / data.rows.length * index + chartHeight / data.rows.length / 2;
    markup += `<text x="0" y="${center + 4}" ${textAttributes(thermalType.small, 620)}>${escapeXml(row.label)}</text>`;
    if (index) markup += `<line x1="${gutter - 10}" y1="${chartTop + chartHeight / data.rows.length * index}" x2="${width}" y2="${chartTop + chartHeight / data.rows.length * index}" stroke="#000" stroke-dasharray="2 6"/>`;
  });
  markup += `<g transform="translate(${gutter} ${chartTop})">${chart.markup}</g>`;
  const footerTop = chartTop + chartHeight + 14;
  markup += rule(footerTop, width) + `<text x="0" y="${footerTop + 24}" ${textAttributes(thermalType.label, 560)}>FILL ONE CIRCLE EACH DAY</text><circle cx="${width - 63}" cy="${footerTop + 19}" r="6" fill="#000"/><text x="${width}" y="${footerTop + 23}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>DONE</text>`;
  return { markup, height: footerTop + 28 };
}

function renderDailyPlan(data: PrototypeDataMap["dailyPlan"], width: number): Part {
  let markup = label("Daily plan", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.dateLabel)}</text>`;
  markup += `<text x="0" y="57" ${textAttributes(thermalType.heading, 780)}>${escapeXml(data.title ?? "Today")}</text>`;
  let y = 79;
  markup += sectionTag(data.prioritiesLabel ?? "Top three", 0, y);
  y += 39;
  for (let index = 0; index < 3; index += 1) {
    markup += `<circle cx="13" cy="${y + 13}" r="12" fill="#fff" stroke="#000" stroke-width="2"/><text x="13" y="${y + 17}" text-anchor="middle" ${textAttributes(thermalType.label, 700)}>${index + 1}</text><line x1="38" y1="${y + 19}" x2="${width}" y2="${y + 19}" stroke="#000"/>`;
    y += 42;
  }
  markup += sectionTag(data.scheduleLabel ?? "Schedule", 0, y);
  y += 39;
  ["8", "10", "12", "2", "4", "6"].forEach((time) => {
    markup += `<text x="0" y="${y + 17}" ${textAttributes(thermalType.label, 650)}>${time}</text><line x1="31" y1="${y + 18}" x2="${width}" y2="${y + 18}" stroke="#000" stroke-dasharray="2 5"/>`;
    y += 32;
  });
  markup += sectionTag(data.rememberLabel ?? "Remember", 0, y + 2) + `<line x1="0" y1="${y + 54}" x2="${width}" y2="${y + 54}" stroke="#000"/><line x1="0" y1="${y + 87}" x2="${width}" y2="${y + 87}" stroke="#000"/>`;
  return { markup, height: y + 89 };
}

function renderGroupedChecklist(data: PrototypeDataMap["groupedChecklist"], width: number): Part {
  let markup = label("Grouped checklist", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.dateLabel)}</text>`;
  markup += `<text x="0" y="57" ${textAttributes(thermalType.heading, 780)}>Get it done</text>`;
  let y = 79;
  ["Must", "Should", "Could"].forEach((group) => {
    markup += sectionTag(group, 0, y);
    y += 34;
    for (let index = 0; index < 3; index += 1) {
      markup += emptyBox(0, y + 2) + `<line x1="31" y1="${y + 18}" x2="${width}" y2="${y + 18}" stroke="#000"/>`;
      y += 34;
    }
    y += 11;
  });
  markup += rule(y, width, 2) + `<text x="0" y="${y + 25}" ${textAttributes(thermalType.label, 600)}>DONE</text><text x="${width}" y="${y + 25}" text-anchor="end" ${textAttributes(thermalType.section, 680)}>____ / 9</text>`;
  return { markup, height: y + 30 };
}

function renderWorkoutLog(data: PrototypeDataMap["workoutLog"], width: number): Part {
  let markup = label("Workout log", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.dateLabel)}</text>`;
  markup += `<text x="0" y="57" ${textAttributes(thermalType.heading, 780)}>Training session</text>`;
  markup += `<text x="0" y="88" ${textAttributes(thermalType.label, 600)}>FOCUS</text><line x1="52" y1="86" x2="${width * .58}" y2="86" stroke="#000"/><text x="${width * .63}" y="88" ${textAttributes(thermalType.label, 600)}>TIME</text><line x1="${width * .76}" y1="86" x2="${width}" y2="86" stroke="#000"/>`;
  const top = 108;
  const columns = [0, width * .49, width * .65, width * .79, width];
  const headings = ["Exercise", "Sets", "Reps", "Load"];
  markup += `<rect x="0" y="${top}" width="${width}" height="31" fill="#000"/>`;
  headings.forEach((heading, index) => { markup += `<text x="${columns[index] + 7}" y="${top + 20}" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="720" letter-spacing=".5" fill="#fff">${heading.toUpperCase()}</text>`; });
  let y = top + 31;
  for (let row = 0; row < 5; row += 1) {
    markup += `<rect x="0" y="${y}" width="${width}" height="39" fill="#fff" stroke="#000"/>`;
    columns.slice(1, -1).forEach((x) => { markup += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 39}" stroke="#000"/>`; });
    y += 39;
  }
  markup += `<text x="0" y="${y + 30}" ${textAttributes(thermalType.label, 600)}>FINISH</text>`;
  [["Warm up", 60], ["Cool down", width * .43], ["Notes", width * .76]].forEach(([text, x]) => { markup += emptyBox(Number(x), y + 15, 16) + `<text x="${Number(x) + 23}" y="${y + 28}" ${textAttributes(thermalType.label, 560)}>${String(text).toUpperCase()}</text>`; });
  return { markup, height: y + 37 };
}

function renderWeatherJournal(data: PrototypeDataMap["weatherJournal"], width: number): Part {
  let markup = label("Weather journal", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.dateLabel)}</text>`;
  markup += `<text x="0" y="57" ${textAttributes(thermalType.heading, 780)}>Observe the day</text>`;
  const top = 78;
  const cell = width / 3;
  ["Morning", "Noon", "Evening"].forEach((time, index) => {
    const x = index * cell;
    if (index) markup += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + 76}" stroke="#000"/>`;
    markup += label(time, x + (index ? 12 : 0), top + 9) + `<text x="${x + (index ? 12 : 0)}" y="${top + 57}" ${textAttributes(thermalType.heading, 680)}>____°</text>`;
  });
  markup += rule(top, width) + rule(top + 76, width);
  markup += `<text x="0" y="${top + 103}" ${textAttributes(thermalType.label, 580)}>CIRCLE</text><text x="58" y="${top + 103}" ${textAttributes(thermalType.small, 560)}>○ CLEAR   ○ CLOUD   ○ RAIN   ○ WIND</text>`;
  const graphTop = top + 125;
  markup += label("Plot temperature", 0, graphTop);
  const frameTop = graphTop + 24;
  markup += `<rect x="0" y="${frameTop}" width="${width}" height="105" fill="#fff" stroke="#000"/>`;
  [1, 2, 3].forEach((index) => { markup += `<line x1="0" y1="${frameTop + index * 105 / 4}" x2="${width}" y2="${frameTop + index * 105 / 4}" stroke="#000" stroke-dasharray="2 6"/>`; });
  markup += `<text x="7" y="${frameTop + 98}" ${textAttributes(thermalType.label, 540)}>6 AM</text><text x="${width / 2}" y="${frameTop + 98}" text-anchor="middle" ${textAttributes(thermalType.label, 540)}>NOON</text><text x="${width - 7}" y="${frameTop + 98}" text-anchor="end" ${textAttributes(thermalType.label, 540)}>8 PM</text>`;
  const notesTop = frameTop + 124;
  markup += label("What changed?", 0, notesTop) + `<line x1="0" y1="${notesTop + 37}" x2="${width}" y2="${notesTop + 37}" stroke="#000"/><line x1="0" y1="${notesTop + 69}" x2="${width}" y2="${notesTop + 69}" stroke="#000"/>`;
  return { markup, height: notesTop + 71 };
}

function renderMealPlan(data: PrototypeDataMap["mealPlan"], width: number): Part {
  let markup = label("Meal plan", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.dateLabel)}</text>`;
  markup += `<text x="0" y="57" ${textAttributes(thermalType.heading, 780)}>What are we eating?</text>`;
  let y = 82;
  ["Breakfast", "Lunch", "Dinner"].forEach((meal) => {
    markup += sectionTag(meal, 0, y) + `<line x1="0" y1="${y + 53}" x2="${width}" y2="${y + 53}" stroke="#000"/><line x1="0" y1="${y + 82}" x2="${width}" y2="${y + 82}" stroke="#000"/>`;
    y += 98;
  });
  markup += rule(y, width, 2) + label("Prep before 5", 0, y + 13);
  [["Defrost", 0], ["Pack", width * .34], ["Chop", width * .62], ["Soak", width * .84]].forEach(([text, x]) => { markup += emptyBox(Number(x), y + 37, 15) + `<text x="${Number(x) + 21}" y="${y + 49}" ${textAttributes(thermalType.label, 540)}>${String(text).toUpperCase()}</text>`; });
  return { markup, height: y + 58 };
}

function renderMeetingNotes(data: PrototypeDataMap["meetingNotes"], width: number): Part {
  let markup = label("Meeting notes", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.dateLabel)}</text>`;
  markup += `<text x="0" y="55" ${textAttributes(thermalType.label, 600)}>TOPIC</text><line x1="50" y1="53" x2="${width}" y2="53" stroke="#000"/><text x="0" y="83" ${textAttributes(thermalType.label, 600)}>WITH</text><line x1="50" y1="81" x2="${width}" y2="81" stroke="#000"/>`;
  let y = 103;
  markup += sectionTag("Decisions", 0, y);
  y += 39;
  for (let index = 0; index < 3; index += 1) { markup += `<line x1="0" y1="${y + 19}" x2="${width}" y2="${y + 19}" stroke="#000"/>`; y += 35; }
  markup += sectionTag("Actions", 0, y + 2);
  y += 41;
  const ownerX = width * .7;
  const dueX = width * .87;
  markup += `<text x="31" y="${y + 12}" ${textAttributes(thermalType.label, 560)}>NEXT MOVE</text><text x="${ownerX}" y="${y + 12}" ${textAttributes(thermalType.label, 560)}>OWNER</text><text x="${dueX}" y="${y + 12}" ${textAttributes(thermalType.label, 560)}>DUE</text>`;
  y += 21;
  for (let index = 0; index < 3; index += 1) {
    markup += emptyBox(0, y + 9, 16) + `<rect x="24" y="${y}" width="${width - 24}" height="36" fill="#fff" stroke="#000"/><line x1="${ownerX}" y1="${y}" x2="${ownerX}" y2="${y + 36}" stroke="#000"/><line x1="${dueX}" y1="${y}" x2="${dueX}" y2="${y + 36}" stroke="#000"/>`;
    y += 36;
  }
  markup += sectionTag("Parking lot", 0, y + 15) + `<line x1="0" y1="${y + 65}" x2="${width}" y2="${y + 65}" stroke="#000"/><line x1="0" y1="${y + 97}" x2="${width}" y2="${y + 97}" stroke="#000"/>`;
  return { markup, height: y + 99 };
}

function renderPackingList(data: PrototypeDataMap["packingList"], width: number): Part {
  let markup = label("Packing list", 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.dateLabel)}</text>`;
  markup += `<text x="0" y="57" ${textAttributes(thermalType.heading, 780)}>Ready to go</text><text x="0" y="87" ${textAttributes(thermalType.label, 600)}>TRIP</text><line x1="42" y1="85" x2="${width}" y2="85" stroke="#000"/>`;
  const gap = 18;
  const columnWidth = (width - gap) / 2;
  const groups = [["Clothes", "Carry-on"], ["Toiletries", "Last check"]];
  let y = 108;
  groups.forEach((pair) => {
    pair.forEach((group, column) => {
      const x = column * (columnWidth + gap);
      markup += sectionTag(group, x, y);
      for (let index = 0; index < 4; index += 1) markup += emptyBox(x, y + 37 + index * 34, 16) + `<line x1="${x + 25}" y1="${y + 52 + index * 34}" x2="${x + columnWidth}" y2="${y + 52 + index * 34}" stroke="#000"/>`;
    });
    y += 189;
  });
  markup += `<rect x="0" y="${y + 2}" width="${width}" height="46" fill="#000"/>`;
  const essentials = ["Keys", "Wallet", "Phone", "ID"];
  essentials.forEach((item, index) => {
    const x = index * width / essentials.length + 10;
    markup += `<rect x="${x}" y="${y + 16}" width="14" height="14" fill="#fff" stroke="#fff"/><text x="${x + 20}" y="${y + 28}" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="680" letter-spacing=".4" fill="#fff">${item.toUpperCase()}</text>`;
  });
  return { markup, height: y + 50 };
}

function renderDelivery(data: PrototypeDataMap["delivery"], width: number): Part {
  let markup = label(data.carrier, 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>TRACKING</text>`;
  const heading = lines(data.status, width, thermalType.heading, 0, 31, { weight: 770, max: 1 });
  markup += heading.markup + `<text x="0" y="${31 + heading.height + 23}" ${textAttributes(thermalType.small, 560)}>Expected ${escapeXml(data.eta)}</text>`;
  const railY = 31 + heading.height + 47;
  markup += `<rect x="0" y="${railY}" width="${width}" height="14" fill="none" stroke="#000" stroke-width="2"/><rect x="2" y="${railY + 2}" width="${Math.max(0, (width - 4) * data.progress)}" height="10" fill="#000"/>`;
  const top = railY + 40;
  const cell = width / data.checkpoints.length;
  markup += `<line x1="20" y1="${top + 8}" x2="${width - 20}" y2="${top + 8}" stroke="#000"/>`;
  data.checkpoints.forEach((checkpoint, index) => {
    const center = cell * index + cell / 2;
    markup += `<circle cx="${center}" cy="${top + 8}" r="7" fill="${checkpoint.complete ? "#000" : "#fff"}" stroke="#000" stroke-width="2"/>`;
    markup += label(checkpoint.label, center, top + 25, "middle");
  });
  return { markup, height: top + 48 };
}

function renderCountdown(data: PrototypeDataMap["countdown"], width: number): Part {
  let markup = label(data.label, 0, 0) + `<text x="${width}" y="${thermalType.label.size}" text-anchor="end" ${textAttributes(thermalType.label, 560)}>${escapeXml(data.date.toUpperCase())}</text>`;
  const valueY = 91;
  markup += `<text x="0" y="${valueY}" font-family="Inter,Arial,sans-serif" font-size="78" font-weight="820" letter-spacing="-3" fill="#000">${data.days}</text>`;
  markup += `<text x="${width}" y="65" text-anchor="end" ${textAttributes(thermalType.heading, 760)}>${escapeXml(data.event)}</text><text x="${width}" y="91" text-anchor="end" ${textAttributes(thermalType.label, 600)}>DAYS TO GO</text>`;
  const railTop = 122;
  const cell = width / data.milestones.length;
  markup += `<line x1="20" y1="${railTop}" x2="${width - 20}" y2="${railTop}" stroke="#000"/>`;
  data.milestones.forEach((milestone, index) => {
    const center = cell * index + cell / 2;
    markup += `<rect x="${center - 6}" y="${railTop - 6}" width="12" height="12" fill="${milestone.complete ? "#000" : "#fff"}" stroke="#000" stroke-width="2"/>`;
    markup += label(milestone.label, center, railTop + 18, "middle");
  });
  return { markup, height: railTop + 41 };
}

const renderers: { [K in PrototypeBlockId]: (data: PrototypeDataMap[K], width: number) => Part } = {
  weather: renderWeather,
  air: renderAir,
  surf: renderSurf,
  games: renderGames,
  markets: renderMarkets,
  news: renderNews,
  earthquakes: renderEarthquakes,
  agenda: renderAgenda,
  departures: renderDepartures,
  home: renderHome,
  habit: renderHabit,
  dailyPlan: renderDailyPlan,
  groupedChecklist: renderGroupedChecklist,
  workoutLog: renderWorkoutLog,
  weatherJournal: renderWeatherJournal,
  mealPlan: renderMealPlan,
  meetingNotes: renderMeetingNotes,
  packingList: renderPackingList,
  delivery: renderDelivery,
  countdown: renderCountdown,
};

export function renderPrototypePart<K extends PrototypeBlockId>(id: K, data: PrototypeDataMap[K], width: number): PrototypePart {
  return renderers[id](data as never, width);
}

export function renderPrototypeBlock<K extends PrototypeBlockId>(id: K, data: PrototypeDataMap[K], width: PaperWidthDots): RenderedPrototype {
  const padding = width === 576 ? 28 : 22;
  const contentWidth = width - padding * 2;
  const part = renderPrototypePart(id, data, contentWidth);
  const height = Math.max(120, Math.ceil(part.height + padding * 2));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(id)} block preview" data-prototype="${id}"><rect width="${width}" height="${height}" fill="#fff"/><g transform="translate(${padding} ${padding})">${part.markup}</g></svg>`;
  return { svg, width, height };
}
