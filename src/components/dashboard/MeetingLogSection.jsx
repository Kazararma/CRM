import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { addMeetingLog } from "../../firebase/projectService";
import { useAuth } from "../../hooks/useAuth";
import { Video, Calendar, Clock, MapPin, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

const MeetingLogSection = ({ projectId, logs }) => {
  const { currentUser, userProfile } = useAuth();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  const [expandedLog, setExpandedLog] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const onSubmit = async (data) => {
    setSubmitError(null);
    try {
      await addMeetingLog(projectId, {
        ...data,
        loggedBy: currentUser.uid,
        loggedByName: userProfile.displayName
      });
      reset();
    } catch (error) {
      console.error("Firebase Write Error:", error);
      setSubmitError("Failed to add meeting log. You may not have permission.");
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case "video-call": return <Video size={14} />;
      case "phone-call": return <Clock size={14} />;
      default: return <MapPin size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
        <MessageSquare size={18} className="text-purple-600" />
        Meeting Logs
      </div>

      {/* Log List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {logs.length > 0 ? logs.map(log => (
          <div key={log.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden hover:border-purple-100 transition-colors">
            <div 
              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              className="p-3 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 text-purple-600 p-2 rounded-lg">
                  {getModeIcon(log.mode)}
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900">{log.topic}</h5>
                  <p className="text-[10px] text-slate-400">
                    {log.date} @ {log.time} · Logged by {log.loggedByName}
                  </p>
                </div>
              </div>
              {expandedLog === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            
            {expandedLog === log.id && (
              <div className="p-4 bg-purple-50/30 border-t border-purple-50">
                <h6 className="text-[10px] font-bold text-purple-600 uppercase mb-2">Meeting Minutes</h6>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{log.minutes}</p>
              </div>
            )}
          </div>
        )) : (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400 italic">No meetings logged yet.</p>
          </div>
        )}
      </div>

      {/* Add Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        {submitError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
            {submitError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
            <input
              type="date"
              {...register("date", { required: true })}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none text-slate-900"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Time</label>
            <input
              type="time"
              {...register("time", { required: true })}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none text-slate-900"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mode</label>
          <select
            {...register("mode", { required: true })}
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none text-slate-900"
          >
            <option value="in-person">In-Person</option>
            <option value="video-call">Video Call</option>
            <option value="phone-call">Phone Call</option>
          </select>
        </div>

        <div className="mb-3">
          <input
            {...register("topic", { required: true })}
            placeholder="Meeting Topic"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none font-bold text-slate-900"
          />
        </div>

        <div className="mb-3">
          <textarea
            {...register("minutes", { required: true })}
            placeholder="Enter minutes/notes here..."
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none min-h-[80px] text-slate-900"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-all disabled:bg-purple-300 shadow-sm"
          >
            {isSubmitting ? "Saving..." : "Log Meeting"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MeetingLogSection;
