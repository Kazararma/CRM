import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

const ErrorDisplay = ({ error }) => {
  if (!error) return null;

  const errorMessage = typeof error === "string" ? error : error.message;
  
  // Regex to find Firebase console links for index creation
  const urlRegex = /(https:\/\/console\.firebase\.google\.com[^\s]+)/g;
  const match = errorMessage.match(urlRegex);
  const indexUrl = match ? match[0] : null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 my-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="bg-red-100 p-2 rounded-full text-red-600">
          <AlertTriangle size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-red-800">System Error</h3>
          <p className="text-red-700/80 text-sm mt-1 mb-4 leading-relaxed">
            {errorMessage.split("https://")[0]}
          </p>

          {indexUrl && (
            <a
              href={indexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-red-700 transition-all shadow-lg active:scale-95 group"
            >
              Action Required: Click here to build the required Firebase Index
              <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;
