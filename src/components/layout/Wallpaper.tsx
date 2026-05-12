export function Wallpaper() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 bg-main pointer-events-none"
    >
      <div className="absolute inset-0 opacity-30 bg-cover bg-center bg-no-repeat bg-[url('/wallpaper.png')]" />
    </div>
  );
}
