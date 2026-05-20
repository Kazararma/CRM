import React from "react";
import ConfirmModal from "../shared/ConfirmModal";
import { useShift } from "../../contexts/ShiftContext";

const EndShiftModal = ({ isOpen, onClose }) => {
  const { endShift, elapsedSeconds } = useShift();

  const formatElapsed = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={endShift}
      title="End Your Shift"
      message={`You have been on shift for ${formatElapsed(elapsedSeconds)}. Are you sure you want to end your shift now?`}
      confirmText="End Shift"
      type="danger"
    />
  );
};

export default EndShiftModal;
