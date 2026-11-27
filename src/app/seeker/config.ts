/** True only on the Seeker deployment (VITE_SEEKER=1), whose diary database is dev. */
export const seekerOpen = import.meta.env.VITE_SEEKER === "1";
