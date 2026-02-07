export function Navbar() {
  return (
    <div className="navbar w-full bg-base-300">
      <div className="flex-none lg:hidden">
        <label
          htmlFor="app-drawer"
          aria-label="open sidebar"
          className="btn btn-square btn-ghost"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="inline-block size-6 stroke-current"
          >
            <title>Menu</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </label>
      </div>
      <div className="px-4 font-bold text-lg">Flux</div>
    </div>
  );
}
