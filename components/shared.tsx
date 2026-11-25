"use client";

import { createContext, useContext, type ReactNode } from "react";
import { PackageOpen } from "lucide-react";
import { statusLabel, type OrderStatus } from "../lib/models";

export const ActionContext = createContext<(action: () => void, message?: string) => boolean>(() => false);
export const useAction = () => useContext(ActionContext);

export function Status({ value }: { value: OrderStatus }) {
  return <span className={`status status-${value}`}>{statusLabel[value]}</span>;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><PackageOpen size={30} aria-hidden /><p>{children}</p>{action}</div>;
}
