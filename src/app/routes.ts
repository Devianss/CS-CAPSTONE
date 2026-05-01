import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { LoginPage } from "./components/LoginPage";
import { Dashboard } from "./components/Dashboard";
import { StudentDashboard } from "./components/StudentDashboard";
import { AccessCodePage } from "./components/AccessCodePage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: LoginPage },
      { path: "access-code", Component: AccessCodePage },
      { path: "dashboard", Component: Dashboard },
      { path: "student-dashboard", Component: StudentDashboard },
    ],
  },
]);
