import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { addWorkLog } from "../../firebase/projectService";
import { useAuth } from "../../hooks/useAuth";
import Avatar from "../shared/Avatar";
import { Briefcase, Send, CheckCircle, Paperclip, AlertCircle, FileText, Image as ImageIcon } from "lucide-react";
import { uploadWorklogAttachment } from "../../services/storageService";

const WorkLogSection = ({ projectId, logs, associatedShiftId = null }) => {
  const { currentUser, userProfile, role } = useAuth();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  const [submitError, setSubmitError] = useState(null);
  
  const fileInputRef = useRef(null);
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedAttachment, setStagedAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState(null);

  const handleFileStaged = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    if (!['application/pdf', 'image/png'].includes(file.type)) {
      setFileError('Only PDF or PNG files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File must be 5MB or less.');
      return;
    }

    setStagedFile(file);
    setStagedAttachment(null);
  };

  const onSubmit = async (data) => {
    setSubmitError(null);
    let attachmentData = null;

    if (!stagedFile && !stagedAttachment) {
      setFileError("An attachment is required to validate your work.");
      return;
    }

    if (stagedFile && !stagedAttachment) {
      setIsUploading(true);
      try {
        attachmentData = await uploadWorklogAttachment(
          stagedFile,
          projectId,
          currentUser.uid,
          setUploadProgress
        );
        setStagedAttachment(attachmentData);
      } catch (err) {
        setFileError(err.message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    } else if (stagedAttachment) {
      attachmentData = stagedAttachment;
    }

    try {
      // 1. Add the work log
      await addWorkLog(projectId, {
        ...data,
        authorUid: currentUser.uid,
        authorName: userProfile.displayName,
        authorRole: role,
        associatedShiftId: associatedShiftId,
        attachmentUrl: attachmentData?.downloadUrl ?? null,
        attachmentType: attachmentData?.attachmentType ?? null,
        attachmentFileName: attachmentData?.attachmentFileName ?? null,
      });

      // 2. AUTO-VALIDATION: If there is an active shift, validate it based on this log
      if (associatedShiftId) {
        const { doc, updateDoc } = await import("firebase/firestore");
        const { db } = await import("../../firebase/config");
        const shiftRef = doc(db, "users", currentUser.uid, "shifts", associatedShiftId);
        await updateDoc(shiftRef, {
          isValidated: !!attachmentData?.downloadUrl,
          projectId: projectId, // Sync project ID in case it was a general shift
          taskHeading: data.heading,
          taskDescription: data.description,
          validatedAt: new Date().toISOString(),
          validationMethod: "auto_work_log"
        });
      }

      reset();
      setStagedFile(null);
      setStagedAttachment(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
              {log.attachmentUrl && (
                <div className="mt-2 flex items-center gap-2">
                  {log.attachmentType === 'pdf' ? (
                    <FileText size={14} className="text-red-500 flex-shrink-0" />
                  ) : (
                    <ImageIcon size={14} className="text-blue-500 flex-shrink-0" />
                  )}
                  <a
                    href={log.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
                    title={log.attachmentFileName ?? 'View Attachment'}
                  >
                    {log.attachmentFileName ?? 'View Proof'}
                  </a>
                  <span className="text-xs text-gray-400 uppercase">
                    {log.attachmentType}
                  </span>
                </div>
              )}
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
          <div className="flex flex-col gap-2 mt-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.png"
              className="hidden"
              onChange={handleFileStaged}
            />

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSubmitting}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${stagedFile ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
              >
                {stagedFile ? (
                  <>
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <span className="truncate max-w-[120px]" title={stagedFile.name}>
                      {stagedFile.name}
                    </span>
                  </>
                ) : (
                  <>
                    <Paperclip size={16} />
                    <span>Attach Proof</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all disabled:bg-blue-300 shadow-sm"
              >
                <Send size={16} />
                {isSubmitting ? "Logging..." : isUploading ? "Uploading..." : "Add Work Log"}
              </button>
            </div>

            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {fileError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {fileError}
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default WorkLogSection;
