import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
            T
          </div>
          <h1 className="text-xl font-semibold">TaskMaster</h1>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
