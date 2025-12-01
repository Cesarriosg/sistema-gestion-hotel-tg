export default function AccionModal({
  open,
  onClose,
  data,
  allowWalkIn,
  onReserva,
  onWalkIn,
}) {
  if (!open) return null;

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>Acciones sobre la selección</h3>
        <p style={{ marginBottom: 8 }}>
          <b>Habitación:</b> {data?.habNumero}
        </p>
        <p style={{ marginTop: 0, marginBottom: 16 }}>
          <b>Rango:</b> {data?.inicio} → {data?.fin}
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <button style={btnPrimary} onClick={onReserva}>
            Crear reserva
          </button>

          <button
            style={{ ...btnSecondary, opacity: allowWalkIn ? 1 : 0.5, cursor: allowWalkIn ? "pointer" : "not-allowed" }}
            onClick={allowWalkIn ? onWalkIn : undefined}
            title={allowWalkIn ? "" : "El Walk-In solo está disponible para la fecha operativa"}
          >
            Registrar Walk-In
          </button>
        </div>

        <button style={btnGhost} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modalStyle = {
  width: 420,
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};

const btnPrimary = {
  background: "#1d6eca",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 600,
};

const btnSecondary = {
  background: "#3fa34d",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 600,
};

const btnGhost = {
  background: "transparent",
  color: "#333",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: "8px 12px",
  marginTop: 6,
};
