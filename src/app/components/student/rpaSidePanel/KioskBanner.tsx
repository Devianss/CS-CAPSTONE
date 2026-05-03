export function KioskBanner() {
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ background: "#2a1810", borderColor: "#e8821a55" }}
    >
      <p className="text-[#e8a83a] text-[10px] leading-relaxed">
        <strong>Kiosk:</strong> launcher rail is read-only. Vault automation rules still apply.
      </p>
    </div>
  );
}
