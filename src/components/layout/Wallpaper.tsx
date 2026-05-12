export function Wallpaper() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 opacity-50 bg-cover bg-center bg-no-repeat bg-[url('/wallpaper.png')] pointer-events-none"
    />
  );
}
