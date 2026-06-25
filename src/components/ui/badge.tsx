import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gray-800 text-gray-300",
        blue: "border-transparent bg-blue-500/10 text-blue-400",
        green: "border-transparent bg-emerald-500/10 text-emerald-400",
        amber: "border-transparent bg-amber-500/10 text-amber-400",
        orange: "border-transparent bg-orange-500/10 text-orange-400",
        red: "border-transparent bg-red-500/10 text-red-400",
        rose: "border-transparent bg-rose-500/10 text-rose-400",
        gray: "border-transparent bg-gray-500/10 text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
