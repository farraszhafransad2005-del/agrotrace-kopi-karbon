import React from "react";
import { motion } from "framer-motion";

export default function GlassCard({
  children,
  className = "",
  hover = false,
  delay = 0,
  onClick,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hover ? { y: -2, transition: { duration: 0.18 } } : undefined}
      onClick={onClick}
      className={`glass-card rounded-2xl p-5 transition-colors duration-200 ${
        hover ? "hover:border-amber-500/35 hover:shadow-glow" : ""
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
