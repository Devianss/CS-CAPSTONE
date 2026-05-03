import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { COMLAB_IDS, type ComlabId } from "../data/comlabs";

type AdminLabContextValue = {
  labId: ComlabId;
  setLabId: (id: ComlabId) => void;
};

const AdminLabContext = createContext<AdminLabContextValue | null>(null);

export function AdminLabProvider({ children }: { children: ReactNode }) {
  const [labId, setLabIdState] = useState<ComlabId>("08");
  const setLabId = useCallback((id: ComlabId) => {
    if (COMLAB_IDS.includes(id)) setLabIdState(id);
  }, []);
  const value = useMemo(() => ({ labId, setLabId }), [labId, setLabId]);
  return <AdminLabContext.Provider value={value}>{children}</AdminLabContext.Provider>;
}

export function useAdminLab(): AdminLabContextValue {
  const v = useContext(AdminLabContext);
  if (!v) throw new Error("useAdminLab must be used within AdminLabProvider");
  return v;
}
