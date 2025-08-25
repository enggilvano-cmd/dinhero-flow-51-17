import { useState, useEffect } from "react";

export interface ChartDimensions {
  containerHeight: string;
  outerRadius: number;
  fontSize: number;
  tickFontSize: number;
  margins: { top: number; right: number; bottom: number; left: number };
  showLabels: boolean;
  showLegend: boolean;
  angleRotation: number;
  textAnchor: "start" | "middle" | "end";
  axisHeight: number;
  strokeWidth: number;
  dotRadius: number;
  activeDotRadius: number;
}

export type ScreenSize = "mobile" | "tablet" | "desktop";

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

export function useChartResponsive(): {
  screenSize: ScreenSize;
  chartConfig: ChartDimensions;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  const [screenSize, setScreenSize] = useState<ScreenSize>("desktop");

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      
      if (width < MOBILE_BREAKPOINT) {
        setScreenSize("mobile");
      } else if (width < TABLET_BREAKPOINT) {
        setScreenSize("tablet");
      } else {
        setScreenSize("desktop");
      }
    };

    updateScreenSize();
    
    const mediaQuery = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT}px)`);
    const mobileQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    
    const handleChange = () => updateScreenSize();
    
    mediaQuery.addEventListener("change", handleChange);
    mobileQuery.addEventListener("change", handleChange);
    
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      mobileQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const getChartConfig = (): ChartDimensions => {
    const configs = {
      mobile: {
        containerHeight: "min-h-[220px]",
        outerRadius: 50,
        fontSize: 10,
        tickFontSize: 9,
        margins: { top: 10, right: 10, bottom: 40, left: 10 },
        showLabels: false,
        showLegend: true,
        angleRotation: -45,
        textAnchor: "end" as const,
        axisHeight: 50,
        strokeWidth: 2,
        dotRadius: 3,
        activeDotRadius: 4,
      },
      tablet: {
        containerHeight: "min-h-[280px]",
        outerRadius: 70,
        fontSize: 11,
        tickFontSize: 10,
        margins: { top: 15, right: 20, bottom: 30, left: 15 },
        showLabels: true,
        showLegend: true,
        angleRotation: -30,
        textAnchor: "end" as const,
        axisHeight: 40,
        strokeWidth: 2.5,
        dotRadius: 3.5,
        activeDotRadius: 5,
      },
      desktop: {
        containerHeight: "min-h-[800px]",
        outerRadius: 192,
        fontSize: 12,
        tickFontSize: 12,
        margins: { top: 20, right: 30, bottom: 20, left: 20 },
        showLabels: true,
        showLegend: false,
        angleRotation: 0,
        textAnchor: "middle" as const,
        axisHeight: 30,
        strokeWidth: 3,
        dotRadius: 4,
        activeDotRadius: 6,
      },
    };
    return configs[screenSize];
  };

  const chartConfig = getChartConfig();

  return {
    screenSize,
    chartConfig,
    isMobile: screenSize === "mobile",
    isTablet: screenSize === "tablet", 
    isDesktop: screenSize === "desktop",
  };
}