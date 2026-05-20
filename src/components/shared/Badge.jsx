import React from "react";

const Badge = ({ children, type }) => {
  const styles = {
    super_admin: "bg-purple-100 text-purple-800 border-purple-200",
    admin: "bg-blue-100 text-blue-800 border-blue-200",
    worker: "bg-gray-100 text-gray-800 border-gray-200",
    ongoing: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };

  const currentStyle = styles[type] || "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStyle}`}>
      {children}
    </span>
  );
};

export default Badge;
