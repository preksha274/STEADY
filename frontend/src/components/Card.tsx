import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = "", onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 sm:p-6 transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-blue-200" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};
