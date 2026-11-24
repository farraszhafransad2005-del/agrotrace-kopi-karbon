import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function EChartBox({ option, className = "h-80 w-full", onEvents }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (chartRef.current && !chartRef.current.isDisposed()) {
        chartRef.current.resize();
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      if (chartRef.current && !chartRef.current.isDisposed()) {
        chartRef.current.dispose();
      }
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed() || !option) return;

    chart.setOption(
      {
        backgroundColor: "transparent",
        textStyle: {
          color: "#d6d3d1",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        tooltip: {
          backgroundColor: "rgba(20, 16, 14, 0.94)",
          borderColor: "rgba(212, 163, 115, 0.3)",
          borderWidth: 1,
          textStyle: { color: "#f5f5f4", fontSize: 12 },
          ...(option.tooltip || {}),
        },
        ...option,
      },
      { notMerge: true }
    );
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed() || !onEvents) return;

    const entries = Object.entries(onEvents);
    entries.forEach(([eventName, handler]) => {
      chart.on(eventName, handler);
    });

    return () => {
      if (!chart.isDisposed()) {
        entries.forEach(([eventName, handler]) => {
          chart.off(eventName, handler);
        });
      }
    };
  }, [onEvents]);

  return <div ref={containerRef} className={className} />;
}
