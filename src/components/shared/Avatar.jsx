import React, { useState } from "react";

const Avatar = ({ src, name, size = "md" }) => {
  const [imageError, setImageError] = useState(false);
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getColorFromName = (name) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-indigo-500",
      "bg-pink-500",
      "bg-teal-500",
      "bg-orange-500",
    ];
    if (!name) return colors[0];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${sizes[size]} rounded-full object-cover border border-gray-200`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} ${getColorFromName(
        name
      )} rounded-full flex items-center justify-center text-white font-bold border border-white/20`}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
