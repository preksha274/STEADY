import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  fullWidth = false,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-2xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variantStyles = {
    primary:
      "bg-brand-gradient text-white hover:opacity-95 shadow-xs hover:shadow focus:ring-[#2563EB] active:scale-[0.99]",
    secondary:
      "bg-[#EFF6FF] text-[#2563EB] border-[0.5px] border-[#BFDBFE] hover:bg-blue-100/70 focus:ring-[#2563EB] active:scale-[0.99]",
    outline:
      "bg-white text-[#172554] border-[0.5px] border-[#E2E8F0] hover:bg-slate-50 hover:border-slate-300 focus:ring-[#2563EB] active:scale-[0.99]",
    danger:
      "bg-[#EF4444] text-white hover:bg-red-600 focus:ring-[#EF4444] shadow-xs active:scale-[0.99]",
    ghost:
      "bg-transparent text-[#64748B] hover:text-[#172554] hover:bg-slate-100 focus:ring-slate-400 active:scale-[0.99]",
  };

  const sizeStyles = {
    sm: "min-h-[44px] px-3.5 py-2 text-xs sm:text-sm gap-1.5",
    md: "min-h-[48px] px-4 py-2.5 text-sm sm:text-base gap-2",
    lg: "min-h-[52px] px-6 py-3.5 text-base sm:text-lg gap-2.5 rounded-2xl",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
