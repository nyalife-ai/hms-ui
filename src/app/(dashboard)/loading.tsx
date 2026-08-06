export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-brand-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-2xl bg-white shadow-sm" />
        <div className="h-28 rounded-2xl bg-white shadow-sm" />
        <div className="h-28 rounded-2xl bg-white shadow-sm" />
      </div>
      <div className="h-64 rounded-2xl bg-white shadow-sm" />
    </div>
  );
}
