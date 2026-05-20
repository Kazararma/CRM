import React from "react";
import { useShift } from "../../contexts/ShiftContext";
import { Timer, Heart } from "lucide-react";

const HeartbeatConfirmModal = () => {
  const { heartbeatRequired, remainingGraceSeconds, confirmHeartbeat } = useShift();

  if (!heartbeatRequired) return null;

  const mins = Math.floor(remainingGraceSeconds / 60);
  const secs = remainingGraceSeconds % 60;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white p-4 shadow-2xl animate-bounce-subtle">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-2 rounded-full animate-pulse">
            <Heart className="fill-white" size={24} />
          </div>
          <div>
            <h3 className="font-black text-lg leading-none">Are you still there?</h3>
            <p className="text-white/80 text-sm mt-1">Please confirm your presence to keep your shift active.</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-2xl font-bold bg-black/20 px-4 py-2 rounded-xl">
            <Timer size={24} />
            {mins}:{secs.toString().padStart(2, "0")}
          </div>
          <button
            onClick={confirmHeartbeat}
            className="bg-white text-amber-600 px-8 py-3 rounded-xl font-black text-lg hover:bg-amber-50 transition-all shadow-lg active:scale-95"
          >
            I'M HERE
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeartbeatConfirmModal;
