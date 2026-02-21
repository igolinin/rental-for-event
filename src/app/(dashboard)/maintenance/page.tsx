import { Metadata } from "next";

export const metadata: Metadata = {
  title: "",
};

export default function MaintenancePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Maintenance</h1>
      <p className="text-slate-500 text-sm">This module is under construction.</p>
    </div>
  );
}
