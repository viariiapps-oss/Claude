/** Chart tokens (mirror globals.css). Categorical slots validated for CVD separation on #0E1320. */
export const CHART = {
  accent: "#4DA3FF",
  grid: "#1a2233",
  axis: "#5d6882",
  text: "#8b97b3",
  surface: "#0E1320",
  series: ["#3987e5", "#d95926", "#199e70", "#c98500"] as const,
};

export function seriesColor(i: number): string {
  return CHART.series[i % CHART.series.length];
}
