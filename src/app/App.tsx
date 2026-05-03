/**
 * App.tsx  (updated for Electron)
 *
 * Wraps the entire app in a flex-column layout:
 *   ┌──────────────────────┐
 *   │  TitleBar (36px)     │  ← custom window chrome
 *   ├──────────────────────┤
 *   │  Router outlet       │  ← all existing pages unchanged
 *   └──────────────────────┘
 */
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./routes";
import { TitleBar } from "./components/TitleBar";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: "hidden" }}>
        <RouterProvider router={router} />
      </div>
      <Toaster richColors position="bottom-right" theme="dark" closeButton />
    </div>
  );
}
