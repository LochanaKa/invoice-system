/**
 * components/StatCard.jsx
 * Reusable metric card — themed to Creative Computers brand.
 * Colors: blue = cc-blue, green = cc-green, amber/red/purple unchanged.
 */
export default function StatCard({ title, value, subtitle, icon: Icon, color = "blue" }) {
  const palette = {
    blue: {
      icon:  "text-cc-blue-600",
      bg:    "bg-cc-blue-50",
      border: "border-cc-blue-100",
      bar:   "#1F3C8A",
    },
    green: {
      icon:  "text-cc-green-600",
      bg:    "bg-cc-green-50",
      border: "border-cc-green-100",
      bar:   "#27AE60",
    },
    amber: {
      icon:  "text-amber-600",
      bg:    "bg-amber-50",
      border: "border-amber-100",
      bar:   "#d97706",
    },
    red: {
      icon:  "text-red-600",
      bg:    "bg-red-50",
      border: "border-red-100",
      bar:   "#dc2626",
    },
    purple: {
      icon:  "text-purple-600",
      bg:    "bg-purple-50",
      border: "border-purple-100",
      bar:   "#7c3aed",
    },
  };

  const c = palette[color] || palette.blue;

  return (
    <div className={`bg-white rounded-2xl border ${c.border} shadow-cc-sm p-5
                     hover:shadow-cc transition-shadow duration-200 group`}>
      {/* Top accent bar */}
      <div className="h-0.5 rounded-full mb-4 opacity-60"
           style={{ background: c.bar }} />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5 leading-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className={`p-2.5 rounded-xl ${c.bg} ${c.icon} flex-shrink-0 ml-3
                           group-hover:scale-110 transition-transform duration-200`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}
