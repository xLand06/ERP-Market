// PostCSS pipeline for the frontend.
// Note: Tailwind v4 is wired through @tailwindcss/vite (enforce: "pre"), so the
// plugins below run on the generated stylesheet, not on the raw source file.
const isProduction = process.env.NODE_ENV === 'production';

export default {
    plugins: {
        autoprefixer: {},
        // cssnano only in production builds; dev keeps CSS readable for debugging.
        ...(isProduction
            ? {
                  cssnano: {
                      preset: ['default', { discardComments: { removeAll: true } }],
                  },
              }
            : {}),
    },
};
