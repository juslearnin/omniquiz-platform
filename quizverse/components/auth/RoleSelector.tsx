"use client";

import { motion } from "framer-motion";

const roles = [
  {
    title: "School Student",
    value: "SCHOOL_STUDENT",
    tagline: "Start your quizzing journey early.",
  },
  {
    title: "College Student",
    value: "COLLEGE_STUDENT",
    tagline: "Compete, collaborate, dominate.",
  },
  {
    title: "Quizmaster",
    value: "QM",
    tagline: "Host brilliance. Build reputation.",
  },
  {
    title: "Pub / Party Host",
    value: "PUB_HOST",
    tagline: "Turn nights into quiz experiences.",
  },
  {
    title: "Independent Quizzer",
    value: "QUIZZER",
    tagline: "For the love of the game.",
  },
  {
    title: "Quiz Club / Circuit",
    value: "QUIZ_CLUB",
    tagline: "Build communities around curiosity.",
  },
];
export default function RoleSelector({
  selectedRole,
  setSelectedRole,
}: {
  selectedRole: string;
  setSelectedRole: (role: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">

      {roles.map((role) => (
        <motion.button
          whileHover={{
            scale: 1.03,
          }}
          whileTap={{
            scale: 0.98,
          }}
          key={role.value}
          onClick={() =>
            setSelectedRole(role.value)
          }
          className={`rounded-3xl border p-5 text-left transition ${
            selectedRole === role.value
              ? "border-purple-500 bg-purple-500/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >

          <h3 className="text-xl font-bold text-white">
            {role.title}
          </h3>

          <p className="mt-2 text-sm text-gray-400">
            {role.tagline}
          </p>

        </motion.button>
      ))}

    </div>
  );
}