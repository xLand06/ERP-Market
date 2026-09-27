// PostCSS pipeline for the frontend.
// Tailwind v4 is wired through @tailwindcss/vite (enforce: "pre"), so the
// plugins below run on the generated stylesheet, not on the raw source file.
export default {
    plugins: {
        autoprefixer: {},
    },
};
