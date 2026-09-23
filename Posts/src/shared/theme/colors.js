// 🌿 KRISHIVERSE REACT NATIVE APPLICATION
const COLORS = {
  primary:            "#4CAF50",
  primaryDark:        "#43A047",
  accentGreen:        "#16A34A",
  background:         "#F5F5F5",
  surfaceWhite:       "#FFFFFF",
  surfaceGray:        "#F2F2F2",
  surfaceGrayAlt:     "#EFEFEF",
  surfaceDark:        "#1A181B",
  surfaceMuted:       "#263238",
  headerLight:        "#F5F5F5",
  textPrimary:        "#1A181B",
  textSecondary:      "#555555",
  // Was referenced 9x across the app (ProfileScreen, PostDetailScreen,
  // CommentRow) but never actually defined — every one of those usages was
  // silently rendering as undefined -> RN's default black text instead of
  // the lighter secondary tone clearly intended. Added here between
  // textSecondary (#555555) and placeholderText (#7A7A7A).
  textSecondaryLight: "#6B6B6B",
  textSecondaryDark:  "#AAAAAA",
  placeholderText:    "#7A7A7A",
  textWhite:          "#FFFFFF",
  white:              "#FFFFFF",
  black:              "#1A181B",
  borderDefault:      "#ECECEC",
  dividerLight:       "#E8E8E8",
  dividerDark:        "#333333",
  // Was referenced in EditPostScreen.jsx's loading placeholders but never
  // defined — every usage silently rendered as undefined backgroundColor
  // (a transparent box, not the intended gray placeholder). Matches the
  // tone SkeletonCard.jsx/CommentSkeleton.jsx already use for the same
  // purpose (dividerLight) so all loading states look consistent.
  skeleton:           "#E8E8E8",
  error:              "#EF4444",
  success:            "#16A34A",
  warning:            "#F59E0B",
  iconLight:          "#444444",
  iconDark:           "#CCCCCC",

  // Category pill badge (overlaid on post media, top-left)
  categoryBg:         "#DCFCE7",
  categoryText:       "#166534",

  gradients: {
    main:   ["#16A34A", "#15803D", "#14532D"],
    button: ["#0D491F", "#126D30", "#15803D"],

    // Soft premium header gradient
    header: ["#F4FBF5", "#E8F7EC", "#F9F9F7"],

    // Light green header banner used behind TopBar in index.jsx
    headerGreen: ["#DCF5E3", "#C3EDCF", "#F5F5F5"],
  },
};

export default COLORS;