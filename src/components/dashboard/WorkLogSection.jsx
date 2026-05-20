import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { addWorkLog } from "../../firebase/projectService";
import { useAuth } from "../../hooks/useAuth";
import Avatar from "../shared/Avatar";
import { Briefcase, Send } from "lucide-react";

const WorkLogSection = ({ projectId, logs, associatedShiftId = null }) => {
  const { currentUser, userProfile, role } = useAuth();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  const [submitError, setSubmitError] = useState(null);

  const onSubmit = async (data) => {
    setSubmitError(null);
    try {
      // 1. Add the work log
      await addWorkLog(projectId, {
        ...data,
        authorUid: currentUser.uid,
        authorName: userProfile.displayName,
        authorRole: role,
        associatedShiftId: associatedShiftId
      });

      // 2. AUTO-VALIDATION: If there is an active shift, validate it based on this log
      if (associatedShiftId) {
        const { doc, updateDoc } = await import("firebase/firestore");
        const { db } = await import("../../firebase/config");
        const shiftRef = doc(db, "users", currentUser.uid, "shifts", associatedShiftId);
        await updateDoc(shiftRef, {
          isValidated: true,
          projectId: projectId, // Sync project ID in case it was a general shift
          taskHeading: data.heading,
          taskDescription: data.description,
          validatedAt: new Date().toISOString(),
          validationMethod: "auto_work_log"
        });
      }

      reset();
    } catch (error) {
      console.error("Firebase Write Error:", error);
      setSubmitError("Failed to add log. You may not have permission.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
        <Briefcase size={18} className="text-blue-600" />
        Work Logs
      </div>

      {/* Log List */}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {logs.length > 0 ? logs.map(log => (
          <div key={log.id} className="flex gap-3 group">
            <Avatar src={null} name={log.authorName} size="sm" />
            <div className="flex-1 bg-white border border-slate-100 p-3 rounded-xl group-hover:border-blue-100 transition-colors">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs font-bold text-slate-900">{log.authorName}</p>
                <p className="text-[10px] text-slate-400">
                  {log.createdAt ? format(log.createdAt.toDate(), "MMM d, HH:mm") : "..."}
                </p>
              </div>
              <h5 className="text-sm font-bold text-slate-700 mb-1">{log.heading}</h5>
              <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{log.description}</p>
            </div>
          </div>
        )) : (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400 italic">No work logs yet. Start the conversation!</p>
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
        <div className="space-y-3">
          <input
            {...register("heading", { required: true })}
            placeholder="Log Heading (e.g., UI Fixes)"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
          />
          <textarea
            {...register("description", { required: true })}
            placeholder="What did you work on today?"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] text-slate-900"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all disabled:bg-blue-300 shadow-sm"
            >
              <Send size={16} />
              {isSubmitting ? "Logging..." : "Add Work Log"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default WorkLogSection;
