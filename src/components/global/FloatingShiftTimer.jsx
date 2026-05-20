import React, { useState, useEffect, useRef, memo } from "react";
import { useShift } from "../../contexts/ShiftContext";
import { Play, Square, GripVertical, Clock, Briefcase, AlertTriangle } from "lucide-react";
import EndShiftModal from "./EndShiftModal";
import { LOCAL_STORAGE_TIMER_POS_KEY } from "../../config/shiftConfig";
import { useProjects } from "../../hooks/useProjects";

// Separate Timer Display to prevent the entire container from re-rendering every second
const TimerDisplay = memo(({ isActive, heartbeatRequired }) => {
  const { elapsedSeconds } = useShift();
  
  const formatElapsed = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <Clock size={16} className={isActive || heartbeatRequired ? "text-white" : "text-blue-500"} />
      <span className="font-mono font-bold text-lg leading-none">
        {isActive ? formatElapsed(elapsedSeconds) : "00:00:00"}
      </span>
    </div>
  );
});

const FloatingShiftTimer = () => {
  const { shiftState, startShift, heartbeatRequired } = useShift();
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const containerRef = useRef(null);
  const posRef = useRef({ x: 20, y: 20 });
  const isDraggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize position
  useEffect(() => {
    const savedPos = localStorage.getItem(LOCAL_STORAGE_TIMER_POS_KEY);
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        posRef.current = parsed;
        if (containerRef.current && !isMobile) {
          containerRef.current.style.left = `${parsed.x}px`;
          containerRef.current.style.top = `${parsed.y}px`;
        }
      } catch (e) {
        console.error("Failed to load timer position", e);
      }
    }
  }, [isMobile]);

  const handleMouseDown = (e) => {
    if (isMobile) return;
    isDraggingRef.current = true;
    
    const rect = containerRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    document.body.style.userSelect = "none"; // Prevent text selection
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    
    const newX = e.clientX - offsetRef.current.x;
    const newY = e.clientY - offsetRef.current.y;
    
    // Smoothly update DOM directly using requestAnimationFrame for 60fps movement
    requestAnimationFrame(() => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const boundedX = Math.max(10, Math.min(newX, window.innerWidth - containerRef.current.offsetWidth - 10));
      const boundedY = Math.max(10, Math.min(newY, window.innerHeight - containerRef.current.offsetHeight - 10));
      
      containerRef.current.style.left = `${boundedX}px`;
      containerRef.current.style.top = `${boundedY}px`;
      posRef.current = { x: boundedX, y: boundedY };
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    document.body.style.userSelect = "auto";
    localStorage.setItem(LOCAL_STORAGE_TIMER_POS_KEY, JSON.stringify(posRef.current));
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const isActive = !!shiftState;

  useEffect(() => {
    if (!isActive) setSelectedProjectId("");
    else if (shiftState.projectId) setSelectedProjectId(shiftState.projectId);
  }, [isActive, shiftState?.projectId]);

  // Handle z-index and styles based on state
  const getThemeClasses = () => {
    if (heartbeatRequired) return "bg-amber-500 border-amber-400 animate-pulse text-white shadow-amber-500/20";
    if (isActive) return "bg-blue-600 border-blue-500 text-white shadow-blue-500/20";
    return "bg-white border-gray-200 text-gray-700 shadow-xl";
  };

  return (
    <>
      <div
        ref={containerRef}
        style={isMobile ? { top: '5rem', left: '50%', transform: 'translateX(-50%)' } : { left: `${posRef.current.x}px`, top: `${posRef.current.y}px` }}
        className="fixed z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        <div className={`flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-2xl border transition-all duration-300 pointer-events-auto shadow-2xl ${
          isMobile ? "w-[calc(100vw-1.5rem)] max-w-[400px]" : "min-w-[320px] max-w-[500px]"
        } ${getThemeClasses()}`}>
          {!isMobile && (
            <div 
              onMouseDown={handleMouseDown}
              className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-black/10 rounded-lg transition-colors flex-shrink-0"
            >
              <GripVertical size={20} className={isActive || heartbeatRequired ? "text-white/50" : "text-gray-300"} />
            </div>
          )}

          <div className="flex flex-col pr-1 sm:pr-2 flex-1 min-w-0">
            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider leading-none ${isActive || heartbeatRequired ? "text-white/60" : "text-gray-400"}`}>
              {isActive ? "Shift Active" : "Shift Offline"}
            </span>
            <TimerDisplay isActive={isActive} heartbeatRequired={heartbeatRequired} />
          </div>

          {isActive ? (
            <button
              onClick={() => setIsEndModalOpen(true)}
              className="p-2.5 sm:p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 flex-shrink-0"
            >
              <Square size={18} sm:size={20} fill="white" />
              <span className="font-bold text-[10px] sm:text-xs">Stop Shift</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
              <div className="relative flex-1 sm:w-32 lg:w-48">
                <Briefcase size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full pl-7 pr-1 sm:pr-2 py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer truncate"
                >
                  <option value="">Project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => startShift(selectedProjectId)}
                disabled={!selectedProjectId}
                className={`p-1.5 sm:p-2 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 flex-shrink-0 ${
                  !selectedProjectId 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <Play size={14} sm:size={16} fill={!selectedProjectId ? "#cbd5e1" : "white"} />
                <span className="font-bold text-[10px] sm:text-xs">Start</span>
              </button>
            </div>
          )}

          {/* Collapsible Trigger */}
          <div className="flex-shrink-0 ml-0.5 sm:ml-1">
            <button 
              type="button"
              onClick={() => setIsInfoOpen(!isInfoOpen)}
              className={`p-1.5 sm:p-2 rounded-full transition-all duration-300 ${isInfoOpen ? "bg-red-100 rotate-180 scale-110" : "bg-white shadow-sm border border-gray-100 hover:bg-gray-50"}`}
            >
              <AlertTriangle size={18} sm:size={20} className={isInfoOpen ? "text-red-600" : "text-red-500 animate-pulse"} />
            </button>
          </div>
        </div>

        {/* Notice Panel */}
        {isInfoOpen && (
          <div className={`p-2.5 sm:p-3 rounded-xl border text-[9px] font-bold leading-tight shadow-2xl transition-all animate-in slide-in-from-top-2 fade-in duration-200 pointer-events-auto ${
            isMobile ? "w-[calc(100vw-1.5rem)] max-w-[400px]" : "w-full max-w-[500px]"
          } ${
            isActive 
              ? "bg-amber-600 border-amber-500 text-white" 
              : "bg-white border-red-100 text-gray-700"
          }`}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded uppercase text-[8px] font-black shrink-0 ${isActive ? "bg-white text-amber-600" : "bg-red-600 text-white"}`}>
                  Required
                </span>
                <span className="font-black">PAYROLL NOTICE</span>
              </div>
              <p>
                To log hours, you <span className="underline decoration-2 text-red-600 font-black">MUST</span> update a "Work Log" in the project dashboard. 
              </p>
              <div className={`p-2 rounded-lg ${isActive ? "bg-white/10" : "bg-gray-50 border border-gray-100"}`}>
                <span className="block text-[8px] uppercase font-black mb-1">How to Switch Projects:</span>
                <p className="text-[8px] leading-tight opacity-90">
                  1. Submit current Work Log<br/>
                  2. <span className="font-black underline">End Current Shift</span><br/>
                  3. Select New Project<br/>
                  4. Start New Shift
                </p>
              </div>
              <div className={`mt-1 pt-1 border-t ${isActive ? "border-white/20" : "border-red-50"}`}>
                <span className={isActive ? "text-amber-200" : "text-red-600"}>* You cannot switch projects without ending the current shift.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <EndShiftModal isOpen={isEndModalOpen} onClose={() => setIsEndModalOpen(false)} />
    </>
  );
};

export default FloatingShiftTimer;
