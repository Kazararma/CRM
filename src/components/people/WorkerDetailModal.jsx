import React, { useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { X, ShieldCheck, ShieldAlert, History, Video, ExternalLink } from "lucide-react";
import Avatar from "../shared/Avatar";
import Badge from "../shared/Badge";
import { getWorkLogsByUser, getMeetingLogsByUser, updateUserRole, updateWorkerSalarySettings, updateMonthlyPaymentStatus, updateUserProfile } from "../../firebase/userService";
import { calculateHourlyPay, calculateMonthlyProgress, calculateProjectPay } from "../../utils/salaryUtils";
import { format } from "date-fns";
import ConfirmModal from "../shared/ConfirmModal";
import { useAuth } from "../../hooks/useAuth";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config";

const WorkerDetailModal = ({ isOpen, onClose, worker, onUpdate }) => {
  const { currentUser, role: currentUserRole } = useAuth();
  const [workLogs, setWorkLogs] = useState([]);
  const [meetingLogs, setMeetingLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingMeetingLogs, setLoadingMeetingLogs] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newRole, setNewRole] = useState(null);
  const [jobTitle, setJobTitle] = useState(worker?.jobTitle || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [salaryType, setSalaryType] = useState(worker?.salaryType || "hourly");
  const [hourlyRate, setHourlyRate] = useState(worker?.hourlyRate || 0);
  const [monthlySalary, setMonthlySalary] = useState(worker?.monthlySalary || 0);
  const [projectRate, setProjectRate] = useState(worker?.projectRate || 0);
  const [projectExpectedHours, setProjectExpectedHours] = useState(worker?.projectExpectedHours || 160);
  const [projectOvertimeRate, setProjectOvertimeRate] = useState(worker?.projectOvertimeRate || 0);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [salaryData, setSalaryData] = useState(null);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!isOpen || !worker?.uid) return;
    setLoadingSalary(true);
    const shiftsRef = collection(db, "users", worker.uid, "shifts");
    const q = query(shiftsRef, where("isValidated", "==", true));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        let result;
        if (worker?.salaryType === "hourly") {
          result = await calculateHourlyPay(worker.uid, currentMonth, currentYear);
        } else if (worker?.salaryType === "monthly") {
          result = await calculateMonthlyProgress(worker.uid, currentMonth, currentYear);
        } else if (worker?.salaryType === "project") {
          result = await calculateProjectPay(worker.uid, currentMonth, currentYear);
        }
        setSalaryData(result);
      } catch (error) {
        console.error("Real-time Salary Sync Error:", error);
      } finally {
        setLoadingSalary(false);
      }
    });
    return () => unsubscribe();
  }, [isOpen, worker?.uid, worker?.salaryType, currentMonth, currentYear]);

  useEffect(() => {
    if (!isOpen || !worker?.uid) return;
    const fetchPaymentStatus = async () => {
      try {
        const targetId = worker.uid;
        const paymentId = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const paymentRef = doc(db, "users", targetId, "payments", paymentId);
        const paymentSnap = await getDoc(paymentRef);
        setPaymentStatus(paymentSnap.exists() ? paymentSnap.data().status : "unpaid");
      } catch (error) {
        console.error("Payment Status Fetch Error:", error);
      }
    };
    fetchPaymentStatus();
  }, [isOpen, worker?.uid, currentMonth, currentYear]);

  useEffect(() => {
    if (isOpen && worker) {
      setJobTitle(worker.jobTitle || "");
      if (worker.uid || worker.id) {
        const targetUid = worker.uid || worker.id;
        setSalaryType(worker.salaryType || "hourly");
        setHourlyRate(worker.hourlyRate || 0);
        setMonthlySalary(worker.monthlySalary || 0);
        setProjectRate(worker.projectRate || 0);
        setProjectExpectedHours(worker.projectExpectedHours || 160);
        setProjectOvertimeRate(worker.projectOvertimeRate || 0);
        setLoadingLogs(true);
        setLoadingMeetingLogs(true);
        fetchWorkLogs(targetUid);
        fetchMeetingLogs(targetUid);
      }
    }
  }, [isOpen, worker]);

  const fetchWorkLogs = async (uid) => {
    setLoadingLogs(true);
    try {
      const logs = await getWorkLogsByUser(uid);
      const grouped = {};
      logs.forEach(log => {
        if (!grouped[log.projectId]) {
          grouped[log.projectId] = { projectId: log.projectId, projectName: log.projectName || "Unknown Project", logs: [] };
        }
        grouped[log.projectId].logs.push(log);
      });
      setWorkLogs(Object.values(grouped));
    } catch (error) { console.error("Error fetching work logs", error); } finally { setLoadingLogs(false); }
  };

  const fetchMeetingLogs = async (uid) => {
    setLoadingMeetingLogs(true);
    try {
      const logs = await getMeetingLogsByUser(uid);
      const grouped = {};
      logs.forEach(log => {
        if (!grouped[log.projectId]) {
          grouped[log.projectId] = { projectId: log.projectId, projectName: log.projectName || "Unknown Project", logs: [] };
        }
        grouped[log.projectId].logs.push(log);
      });
      setMeetingLogs(Object.values(grouped));
    } catch (error) { console.error("Error fetching meeting logs", error); } finally { setLoadingMeetingLogs(false); }
  };

  const handleProfileUpdate = async () => {
    setIsUpdatingProfile(true);
    try {
      await updateUserProfile(worker.uid || worker.id, { jobTitle });
      if (onUpdate) onUpdate();
    } catch (error) { console.error("Error updating profile", error); } finally { setIsUpdatingProfile(false); }
  };

  const handleRoleChange = (role) => {
    setNewRole(role);
    setConfirmOpen(true);
  };

  const confirmRoleChange = async () => {
    try {
      await updateUserRole(worker.uid || worker.id, newRole);
      onUpdate();
      onClose();
    } catch (error) { console.error("Error updating role", error); }
  };

  const handleSettingsUpdate = async () => {
    setIsUpdatingSettings(true);
    try {
      await updateWorkerSalarySettings(worker.uid || worker.id, {
        salaryType, hourlyRate, monthlySalary, projectRate,
        projectExpectedHours: Number(projectExpectedHours || 0),
        projectOvertimeRate: Number(projectOvertimeRate || 0)
      });
      onUpdate();
    } catch (error) { console.error("Error updating salary settings", error); } finally { setIsUpdatingSettings(false); }
  };

  const isSuperAdmin = currentUserRole === "super_admin";
  const isAdmin = currentUserRole === "admin" || isSuperAdmin;

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={onClose}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-white p-0 text-left align-middle shadow-xl transition-all">
                  {/* Header */}
                  <div className="bg-slate-900 p-6 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <Avatar src={worker?.photoURL} name={worker?.displayName} size="lg" />
                      <div>
                        <h3 className="text-xl font-bold text-white">{worker?.displayName}</h3>
                        <p className="text-slate-400 text-sm mb-2">{worker?.email}</p>
                        <div className="flex items-center gap-2">
                          <Badge type={worker?.role}>{worker?.role?.replace("_", " ")}</Badge>
                          {worker?.jobTitle && (
                            <span className="bg-blue-900/50 text-blue-200 text-[10px] font-black px-2 py-0.5 rounded border border-blue-700 uppercase tracking-wider">
                              {worker.jobTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Left: Actions */}
                      <div className="space-y-8">
                        {isAdmin && (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Professional Profile</h4>
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Job Title / Role</label>
                                <input 
                                  type="text"
                                  value={jobTitle}
                                  onChange={(e) => setJobTitle(e.target.value)}
                                  placeholder="e.g. Backend Architect"
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
                                />
                              </div>
                              <button onClick={handleProfileUpdate} disabled={isUpdatingProfile} className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-lg hover:bg-slate-800 transition-all uppercase tracking-wider disabled:opacity-50">
                                {isUpdatingProfile ? "Updating..." : "Update Title"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Access Control</h4>
                          <div className="space-y-3">
                            {worker?.role === "worker" && isAdmin && (
                              <button onClick={() => handleRoleChange("admin")} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
                                <ShieldCheck size={20} /> Promote to Admin
                              </button>
                            )}
                            {worker?.role === "admin" && isSuperAdmin && (
                              <button onClick={() => handleRoleChange("worker")} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition-colors">
                                <ShieldAlert size={20} /> Revoke Admin Access
                              </button>
                            )}
                            
                            {isAdmin && (
                              <div className="mt-6 p-6 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Payroll Summary</h4>
                                  <Link to="/salary" className="text-[10px] font-black text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all uppercase tracking-wider">
                                    Manage Payroll
                                  </Link>
                                </div>
                                <div className="space-y-4">
                                  <div className="flex justify-between items-end">
                                    <div>
                                      <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Estimated Accrued</p>
                                      <p className="text-2xl font-black text-blue-900">
                                        {typeof salaryData === 'object' && salaryData !== null ? Number(salaryData.totalPay || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : "₹0.00"}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Model</p>
                                      <span className="px-2 py-0.5 bg-white rounded text-[10px] font-black text-blue-600 border border-blue-100 uppercase">
                                        {worker?.salary?.type || worker?.salaryType || 'Not Set'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Work Log History */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <History size={16} /> Recent Work Logs
                          </h4>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                          {loadingLogs ? <p className="text-sm text-gray-500 italic">Loading logs...</p> : workLogs.length > 0 ? (
                            workLogs.map((group) => (
                              <div key={group.projectId} className="mb-4">
                                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{group.projectName}</h5>
                                <div className="space-y-3">
                                  {group.logs.map((log) => (
                                    <div key={log.id} className="border-l-2 border-blue-500 pl-4 py-1">
                                      <p className="text-sm font-bold text-gray-900">{log.heading}</p>
                                      <p className="text-xs text-gray-500 whitespace-pre-wrap">{log.description}</p>
                                      <p className="text-[10px] text-gray-400 mt-1">{log.createdAt ? format(log.createdAt.toDate(), "MMM d, yyyy · HH:mm") : "Just now"}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : <p className="text-sm text-gray-500 italic">No work logs found for this user.</p>}
                        </div>
                      </div>

                      {/* Right: Meeting Log History */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Video size={16} /> Recent Meetings
                          </h4>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                          {loadingMeetingLogs ? <p className="text-sm text-gray-500 italic">Loading logs...</p> : meetingLogs.length > 0 ? (
                            meetingLogs.map((group) => (
                              <div key={group.projectId} className="mb-4">
                                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{group.projectName}</h5>
                                <div className="space-y-3">
                                  {group.logs.map((log) => (
                                    <div key={log.id} className="border-l-2 border-purple-500 pl-4 py-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-bold text-gray-900">{log.topic}</p>
                                        <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">{log.mode}</span>
                                      </div>
                                      <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-3">{log.minutes}</p>
                                      <p className="text-[10px] text-gray-400 mt-1">{log.date} @ {log.time}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : <p className="text-sm text-gray-500 italic">No meeting logs found for this user.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ConfirmModal
        isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={confirmRoleChange}
        title={newRole === "admin" ? "Promote to Admin" : "Revoke Admin Access"}
        message={newRole === "admin" ? `Are you sure you want to promote ${worker?.displayName} to Admin?` : `Are you sure you want to demote ${worker?.displayName} back to Worker?`}
        confirmText={newRole === "admin" ? "Promote" : "Revoke"} type={newRole === "admin" ? "primary" : "danger"}
      />
    </>
  );
};

export default WorkerDetailModal;
