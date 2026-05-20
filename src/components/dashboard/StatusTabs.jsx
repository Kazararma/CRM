import React from "react";
import { Tab } from "@headlessui/react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

const StatusTabs = ({ projects, onTabChange }) => {
  const categories = ["Ongoing", "Completed", "Cancelled"];

  const getCount = (category) => {
    return projects.filter((p) => p.status === category.toLowerCase()).length;
  };

  return (
    <div className="w-full mb-8">
      <Tab.Group onChange={(index) => onTabChange(categories[index].toLowerCase())}>
        <Tab.List className="flex space-x-1 rounded-xl bg-slate-100 p-1">
          {categories.map((category) => (
            <Tab
              key={category}
              className={({ selected }) =>
                classNames(
                  "w-full rounded-lg py-2.5 text-sm font-bold leading-5 transition-all outline-none",
                  selected
                    ? "bg-white text-blue-700 shadow"
                    : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                )
              }
            >
              <div className="flex items-center justify-center gap-2">
                {category}
                <span className={`px-2 py-0.5 rounded-full text-[10px] ?{
                  getCount(category) > 0 ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-400"
                }`}>
                  {getCount(category)}
                </span>
              </div>
            </Tab>
          ))}
        </Tab.List>
      </Tab.Group>
    </div>
  );
};

export default StatusTabs;
