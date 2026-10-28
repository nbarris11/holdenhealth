export default function WorkoutIcon({
  name,
}: {
  name: "play" | "pause" | "next" | "back" | "check" | "clock";
}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "play" && (
        <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />
      )}
      {name === "pause" && (
        <>
          <path d="M8 5v14M16 5v14" strokeWidth="3" />
        </>
      )}
      {name === "next" && <path d="M4 12h16m-6-6 6 6-6 6" />}
      {name === "back" && <path d="M20 12H4m6-6-6 6 6 6" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
    </svg>
  );
}
