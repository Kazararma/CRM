import React, { useState, useEffect } from "react";
import Badge from "../shared/Badge";
import ProjectEditForm from "./ProjectEditForm";
import ConfirmModal from "../shared/ConfirmModal";
import { deleteProject } from "../../firebase/projectService";
import { useAuth } from "../../hooks/useAuth";
import { ChevronDown, ChevronUp, Users, IndianRupee, Trash2, Receipt, Wallet, PieChart, AlertCircle } from "lucide-react";
import { useProjectFinancials } from "../../hooks/useProjectFinancials";
import { collectionGroup, query, where, onSnapshot, writeBatch, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";

const ProjectAdminCard = ({ project, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { currentUser, userProfile } = useAuth();
  const [pendingShifts, setPendingShifts] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [liveFinancials, setLiveFinancials] = useState(null);

  // REFACTORED: Use reactive financials hook with correct projectId
  const { liveProject, baseExpenses, totalLaborCost, grandTotal, loading } = useProjectFinancials(project.id);
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "super_admin";

  const displayBaseExpenses = liveFinancials ? liveFinancials.baseExpenses : baseExpenses;
  const displayLaborCost = liveFinancials ? liveFinancials.laborCost : totalLaborCost;
  const displayGrandTotal = liveFinancials ? liveFinancials.grandTotal : grandTotal;

  // Use liveProject data if available for instant UI updates
  const displayProject = liveProject || project;
  const totalMembers = (displayProject.assignedWorkers?.length || 0) + (displayProject.assignedAdmins?.length || 0);

  // Listen for unvalidated shifts for this project
  useEffect(() => {
    if (!isAdmin || !project?.id) return;

    const q = query(
      collectionGroup(db, "shifts"),
      where("projectId", "==", project.id),
      where("isValidated", "==", false),
      where("status", "in", ["completed", "expired"])
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setPendingShifts(snap.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() })));
    }, (error) => {
      console.error("DEBUG: ProjectAdminCard Shift Listener Error:", error);
    });

    return () => unsubscribe();
  }, [project?.id, isAdmin]);

  const handleValidateAll = async () => {
    if (pendingShifts.length === 0) return;
    setIsValidating(true);
    try {
      const batch = writeBatch(db);
      pendingShifts.forEach(shift => {
        batch.update(shift.ref, { isValidated: true });
      });
      await batch.commit();
      console.log(`Successfully validated ${pendingShifts.length} shifts for project: ${project.id}`);
    } catch (error) {
      console.error("Validation failed", error);
      alert("Validation failed. You may not have permission.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProject(project.id, project.title, {
        uid: currentUser.uid,
        displayName: userProfile?.displayName || currentUser.displayName || "Admin"
      });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Failed to delete project", error);
      setIsDeleting(false);
    }
  };

  const handleConfirmProject = async (e) => {
    e.stopPropagation(); // prevent toggling expanded state
    try {
      await updateDoc(doc(db, "projects", project.id), {
        status: "ongoing",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to confirm project", err);
      alert("Failed to confirm project. Check permissions.");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit">
            <Users size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate text-base md:text-lg">{displayProject.title}</h3>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
              <Badge type={displayProject.status}>{displayProject.status}</Badge>
              <div className="flex items-center gap-3">
                <span className="text-[10px] md:text-xs text-gray-400 flex items-center gap-1">
                  <Users size={12} />
                  {totalMembers}
                </span>
                <span className="text-[10px] md:text-xs text-blue-600 font-bold flex items-center gap-1">
                  <IndianRupee size={12} />
                  ₹{Number(displayProject.amountPaid || 0).toLocaleString('en-IN')} / ₹{Number(displayProject.totalBilling || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 ml-4">
          {displayProject.status === 'pending' && isAdmin && (
            <button 
              onClick={handleConfirmProject}
              className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              Confirm Project
            </button>
          )}
          {isExpanded ? <ChevronUp size={20} className="text-gray-400 shrink-0" /> : <ChevronDown size={20} className="text-gray-400 shrink-0" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-gray-100 bg-gray-50/30">
          
          {displayProject.status === 'pending' && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
              <div>
                <h4 className="text-sm font-bold text-emerald-900">Project Pending Confirmation</h4>
                <p className="text-xs text-emerald-700">This project was converted from a lead. Please review the details below and assign workers before confirming.</p>
              </div>
              <button 
                onClick={handleConfirmProject}
                className="w-full sm:w-auto px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                Confirm as Active
              </button>
            </div>
          )}

          {/* Financial Overview (Admin Only) */}
          {isAdmin && (
            <div className="mb-8 space-y-6">
              <div>
                <h4 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <PieChart size={16} /> Financial Overview
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm transition-all duration-300">
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-1">
                      <Receipt size={12} className="text-blue-500" /> Overhead
                    </p>
                    <p className="text-base md:text-lg font-black text-gray-900">
                      {loading && !liveFinancials ? "..." : `₹${Number(displayBaseExpenses || 0).toLocaleString('en-IN')}`}
                    </p>
                  </div>
                  <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm transition-all duration-300">
                    <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5 mb-1">
                      <Users size={12} className="text-purple-500" /> Labor
                    </p>
                    <p className="text-base md:text-lg font-black text-gray-900">
                      {loading && !liveFinancials ? "..." : `₹${Number(displayLaborCost || 0).toLocaleString('en-IN')}`}
                    </p>
                  </div>
                  <div className="bg-blue-600 p-3 md:p-4 rounded-xl shadow-md shadow-blue-100 sm:col-span-2 lg:col-span-1 transition-all duration-300">
                    <p className="text-[9px] md:text-[10px] font-bold text-blue-100 uppercase flex items-center gap-1.5 mb-1">
                      <Wallet size={12} /> Est. Total Cost
                    </p>
                    <p className="text-base md:text-lg font-black text-white">
                      {loading && !liveFinancials ? "..." : `₹${Number(displayGrandTotal || 0).toLocaleString('en-IN')}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Validation Alert for Admins */}
              {pendingShifts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-full">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">{pendingShifts.length} Shifts Awaiting Validation</p>
                      <p className="text-xs text-amber-600">Validating these shifts will update the labor costs in real-time.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleValidateAll}
                    disabled={isValidating}
                    className="w-full md:w-auto px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                  >
                    {isValidating ? "Validating..." : "Confirm All Work Hours"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-gray-900">Edit Project Details</h4>
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
            >
              <Trash2 size={16} />
              Delete Project
            </button>
          </div>
          <ProjectEditForm 
            project={displayProject} 
            onLivePreview={setLiveFinancials}
            onComplete={() => {
              setIsExpanded(false);
              setLiveFinancials(null);
            }} 
          />
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${displayProject.title}"? This action cannot be undone and will remove the project from all views. Connected logs will be orphaned.`}
        confirmText={isDeleting ? "Deleting..." : "Delete Project"}
        type="danger"
      />
    </div>
  );
};

export default ProjectAdminCard;
