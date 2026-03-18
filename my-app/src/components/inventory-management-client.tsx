"use client";

import { useSearchParams } from "next/navigation";

import type { InventoryManagementItem } from "@/lib/medivance/db";

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

function formatQuantity(value: number) {
  return Number(value.toFixed(4));
}

function toPercent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function InventoryManagementClient({
  items,
  initialToast,
}: {
  items: InventoryManagementItem[];
  initialToast?: string | null;
}) {
  const searchParams = useSearchParams();
  const toast = searchParams.get("toast") ?? initialToast ?? null;

  return (
    <div className="space-y-6">
      {toast ? <p className="rounded-lg bg-white border border-slate-200 px-4 py-3 text-sm text-slate-700">{toast}</p> : null}

      <div className="liquid-glass rounded-xl p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Add New Chemical</h2>
        <form action="/api/inventory" method="post" className="grid gap-3 md:grid-cols-6 md:items-end">
          <input type="hidden" name="action" value="upsert" />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Chemical</label>
            <input
              type="text"
              name="ingredientName"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="availableQuantity"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
            <select
              name="unit"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="mg">mg</option>
              <option value="g">g</option>
              <option value="mL">mL</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Low-stock Threshold</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="lowStockThreshold"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              name="notes"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              placeholder="Adjustment notes (required)"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Source document</label>
            <input
              type="text"
              name="sourceDocument"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              placeholder="PO / receiving doc / adjustment note (optional)"
            />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-semibold"
            >
              Save Chemical
            </button>
          </div>
        </form>
      </div>

      <div className="liquid-glass rounded-xl p-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Inventory</h2>
          <span className="text-xs text-slate-500">Rows: {items.length}</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left p-3">Chemical</th>
                <th className="text-left p-3">Current Quantity</th>
                <th className="text-left p-3">Threshold</th>
                <th className="text-left p-3">Earliest Expiry</th>
                <th className="text-left p-3">Last Updated</th>
                <th className="text-right p-3">Update Quantity / Threshold</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLowStock =
                  item.lowStockThreshold > 0 && item.availableQuantity <= item.lowStockThreshold;
                const progress = toPercent(item.availableQuantity, item.lowStockThreshold || item.availableQuantity);
                return (
                  <tr key={item.ingredientName} className={isLowStock ? "bg-amber-50/70" : ""}>
                    <td className="p-3 font-semibold text-slate-900">
                      <div className="flex flex-col">
                        <span>{item.ingredientName}</span>
                        {isLowStock ? <span className="text-amber-700 text-xs">Low stock</span> : null}
                      </div>
                    </td>
                    <td className="p-3 text-slate-700">
                      {formatQuantity(item.availableQuantity)} {item.unit}
                      {item.lowStockThreshold > 0 ? (
                        <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-700"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-slate-700">
                      {item.lowStockThreshold > 0
                        ? `${formatQuantity(item.lowStockThreshold)} ${item.unit}`
                        : "No threshold"}
                    </td>
                    <td className="p-3 text-slate-700">
                      {formatDate(item.earliestExpiryOn) ?? "Not set"}
                    </td>
                    <td className="p-3 text-slate-700">
                      {formatDate(item.lastUpdated) ?? "Unknown"}
                    </td>
                    <td className="p-3">
                      <form action="/api/inventory" method="post" className="flex gap-2 justify-end">
                        <input type="hidden" name="action" value="upsert" />
                        <input type="hidden" name="ingredientName" value={item.ingredientName} />
                        <input type="hidden" name="unit" value={item.unit} />
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              name="availableQuantity"
                              required
                              defaultValue={formatQuantity(item.availableQuantity)}
                              className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              name="lowStockThreshold"
                              required
                              defaultValue={item.lowStockThreshold}
                              className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              name="notes"
                              required
                              className="w-52 rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white"
                              placeholder="Adjustment notes (required)"
                            />
                            <input
                              type="text"
                              name="sourceDocument"
                              className="w-52 rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white"
                              placeholder="PO / receiving doc (optional)"
                            />
                          </div>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500 text-sm">
                    No inventory records found. Add your first chemical to get started.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
