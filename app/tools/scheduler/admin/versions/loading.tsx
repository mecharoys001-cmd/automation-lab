export default function VersionsLoading() {
  return (
    <div className="space-y-6 p-6 lg:p-8 overflow-y-auto h-full bg-slate-50 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-slate-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
