"use client";

import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/** Set after the first page mounts in this browser tab. Never set on the server, so server HTML has no fade. */
let mountedBefore = false;

// Page entrance for client-side navigations. The first page a visitor lands on renders without it: its content is
// visible in the server HTML from the first paint (an opacity-0 wrapper there would hold back every page's LCP).
export default function Template({ children }: { children: ReactNode }) {
  const [first] = useState(() => !mountedBefore);
  useEffect(() => {
    mountedBefore = true;
  }, []);
  return (
    <motion.div initial={first ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
