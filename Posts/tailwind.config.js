module.exports = {
  content: [
  "./src/app/**/*.{js,jsx,ts,tsx}",
  "./src/features/**/*.{js,jsx,ts,tsx}",
  "./src/shared/**/*.{js,jsx,ts,tsx}",
],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand
        primary:            "#4CAF50",
        primaryDark:        "#43A047",
        accentGreen:        "#16A34A",
        // Surfaces
        background:         "#F5F5F5",
        surfaceWhite:       "#FFFFFF",
        surfaceGray:        "#F2F2F2",
        surfaceGrayAlt:     "#EFEFEF",
        surfaceDark:        "#1A181B",
        surfaceMuted:       "#263238",
        headerLight:        "#F5F5F5",
        // Text
        textPrimary:        "#1A181B",
        textSecondary:      "#555555",
        textSecondaryLight: "#6B6B6B",
        textSecondaryDark:  "#AAAAAA",
        placeholderText:    "#7A7A7A",
        textWhite:          "#FFFFFF",
        white:              "#FFFFFF",
        black:              "#1A181B",
        // Borders
        borderDefault:      "#ECECEC",
        dividerLight:       "#E8E8E8",
        dividerDark:        "#333333",
        // States
        error:   "#EF4444",
        success: "#16A34A",
        warning: "#F59E0B",
        // Category pill badge (overlaid on post media, top-left)
        categoryBg:         "#DCFCE7",
        categoryText:       "#166534",
        // Icons
        iconLight: "#444444",
        iconDark:  "#CCCCCC",
      },
      fontFamily: {
        sans:         ["Poppins_400Regular"],
        poppins:      ["Poppins_400Regular"],
        "poppins-md": ["Poppins_500Medium"],
        "poppins-sb": ["Poppins_600SemiBold"],
        "poppins-bd": ["Poppins_700Bold"],
      },
      borderRadius: {
        card:  "24px",
        img:   "18px",
        pill:  "999px",
        input: "16px",
        sm:    "8px",
        md:    "12px",
        lg:    "16px",
      },
    },
  },
  plugins: [],
};