import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  id?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "", onClick, id }) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-white rounded-[18px] border-[0.5px] border-[#E2E8F0] shadow-xs p-4 sm:p-5 transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-[#2563EB]/40 active:scale-[0.99]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};
