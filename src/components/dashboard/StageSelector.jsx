import React, { useState } from "react";
import { updateProject, addStageChangeLog } from "../../firebase/projectService";
import { useAuth } from "../../hooks/useAuth";
import ConfirmModal from "../shared/ConfirmModal";
import { Activity } from "lucide-react";

const StageSelector = ({ project }) => {
  const { currentUser, userProfile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(project.status);
  const [submitError, setSubmitError] = useState(null);

  const statuses = ["ongoing", "completed", "cancelled"];

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (newStatus === project.status) return;
    
    setPendingStatus(newStatus);
    setIsModalOpen(true);
  };

  const confirmChange = async () => {
    setSubmitError(null);
    try {
      await Promise.all([
        addStageChangeLog(project.id, {
          changedBy: currentUser.uid,
          changedByName: userProfile.displayName,
          previousStatus: project.status,
          newStatus: pendingStatus
        }),
        updateProject(project.id, {
          status: pendingStatus
        })
      ]);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Firebase Write Error:", error);
      setSubmitError("Failed to update stage. Permission denied.");
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
        <Activity size={18} />
      </div>
      <div className="flex-1">
        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Project Stage</label>
        <select
          value={project.status}
          onChange={handleStatusChange}
          className="w-full bg-transparent border-none text-sm font-bold text-slate-900 focus:ring-0 p-0 cursor-pointer capitalize"
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {submitError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-600 text-[10px] rounded font-medium">
            {submitError}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmChange}
        title="Confirm Stage Change"
        message={`Are you sure you want to move this project to "${pendingStatus}"? This will be logged in the project audit trail.`}
        confirmText="Change Stage"
        type="primary"
      />
    </div>
  );
};

export default StageSelector;
